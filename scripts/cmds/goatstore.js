const fs     = require("fs");
const path   = require("path");
const axios  = require("axios");
const crypto = require("crypto");

const LOCAL_CFG = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), "goatstore_config.json"), "utf8")); }
  catch (_) { return {}; }
})();

const CONFIG = {
  API_URL: "https://hridoy-api.vercel.app",

  ADMIN_USER: process.env.GOATSTORE_ADMIN_USER || LOCAL_CFG.ADMIN_USER || "",
  ADMIN_PASS: process.env.GOATSTORE_ADMIN_PASS || LOCAL_CFG.ADMIN_PASS || "",

  UPDATE_CHECK_INTERVAL: 1000 * 60 * 30,

  PASTEBIN_API_KEY: process.env.GOATSTORE_PASTEBIN_KEY || LOCAL_CFG.PASTEBIN_API_KEY || "",

  AUTO_SYNC: true,
  AUTO_SYNC_INTERVAL: 1000 * 60 * 60,
  AUTO_SYNC_WATCH: true,

  CATEGORIES: ["economy", "fun", "moderation", "games", "utility", "ai"],
  MAX_EDITS_PER_MESSAGE: 5,
};

const RESERVED_NAMES = ["goatstore", "autosync"];
const GS_PATH = "/api/gs";
function gsApi(p) { return `${CONFIG.API_URL}${GS_PATH}${p}`; }

const SYNC_CACHE_PATH = path.join(process.cwd(), "goatstore_sync_cache.json");
const DIR_CACHE_PATH  = path.join(process.cwd(), "goatstore_dircache.json");

const userSeenNoti      = new Map();
let   _updateCheckCache = null;
let   _autoupdateInFlight = false;

function isAllowed(senderID) {
  const adminUIDs = global.GoatBot?.config?.adminBot;
  if (!Array.isArray(adminUIDs)) return false;
  return adminUIDs.map(String).includes(String(senderID));
}

function getPrefix(threadData) {
  try {
    if (threadData?.data?.prefix) return threadData.data.prefix;
    if (global.GoatBot?.config?.prefix) return global.GoatBot.config.prefix;
  } catch (_) {}
  return "!";
}

function loadJson(filePath, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch { return fallback; }
}

function saveJson(filePath, data) {
  try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); }
  catch (_) {}
}

const EVENTS_PATTERNS = ["events", "event"];
const SKIP_DIRS       = new Set(["node_modules", ".git", ".cache", "dist", "build"]);

let _dirCache = loadJson(DIR_CACHE_PATH, {});

function scanForDir(startDir, patterns, maxDepth = 2) {
  const queue = [{ dir: startDir, depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (_) { continue; }
    for (const ent of entries) {
      if (!ent.isDirectory() || SKIP_DIRS.has(ent.name) || ent.name.startsWith(".")) continue;
      const full  = path.join(dir, ent.name);
      if (patterns.includes(ent.name.toLowerCase())) return full;
      if (depth < maxDepth) queue.push({ dir: full, depth: depth + 1 });
    }
  }
  return null;
}

function getCmdsDir(forceRescan = false) {
  if (!forceRescan && _dirCache.cmdsDir && fs.existsSync(_dirCache.cmdsDir))
    return _dirCache.cmdsDir;
  const dir = __dirname;
  _dirCache.cmdsDir = dir;
  saveJson(DIR_CACHE_PATH, _dirCache);
  return dir;
}

function getEventsDir(forceRescan = false) {
  if (!forceRescan && _dirCache.eventsDir && fs.existsSync(_dirCache.eventsDir))
    return _dirCache.eventsDir;
  const parent = path.dirname(getCmdsDir(forceRescan));
  const dir    = scanForDir(parent, EVENTS_PATTERNS, 2) || path.join(parent, "events");
  _dirCache.eventsDir = dir;
  saveJson(DIR_CACHE_PATH, _dirCache);
  return dir;
}

function parseVer(v) { return String(v).split(".").map(n => parseInt(n) || 0); }
function cmpVer(a, b) {
  const pa = parseVer(a), pb = parseVer(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

function hashContent(content) {
  return crypto.createHash("sha1").update(String(content)).digest("hex");
}

function detectFramework(code) {
  const isGoat =
    /module\.exports\s*=\s*\{/.test(code) &&
    /onStart\s*[:(]|onChat\s*[:(]|onLoad\s*[:(]/.test(code) &&
    /\bauthor\s*:/.test(code);
  return isGoat ? "goat" : "other";
}

function extractMeta(code, fallbackName = "unknown", preferLongDesc = false) {
  const cfgIdx = code.search(/\bconfig\s*[:=]\s*\{/);
  const scoped = cfgIdx >= 0 ? code.slice(cfgIdx, cfgIdx + 6000) : code;
  const pick = (key) => {
    const rx = new RegExp(
      String.raw`(?:^|[\s,{"'])` + key + String.raw`["']?\s*:\s*(["'\x60])((?:\\.|(?!\1)[^\\\n])*)\1`, "m");
    return (scoped.match(rx) || code.match(rx) || [])[2];
  };
  const rawCat = String(pick("category") || "utility").trim().toLowerCase();
  return {
    name:        (pick("name") || fallbackName).trim(),
    author:      (pick("author") || "Unknown").trim(),
    version:     (pick("version") || "1.0.0").trim(),
    category:    rawCat,
    description: ((preferLongDesc && pick("longDescription")) || pick("shortDescription") || pick("longDescription") || "No description").trim(),
  };
}

function adminHeaders() {
  return {
    "Content-Type": "application/json",
    "user": CONFIG.ADMIN_USER,
    "pass": CONFIG.ADMIN_PASS,
  };
}

function displayId(cmd) {
  if (cmd?.seq != null) return String(cmd.seq);
  return cmd?._id || cmd?.id || "N/A";
}

async function apiSearch(q = "", category = "", limit = 0, kind = "", author = "") {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (author && !q) params.set("author", author);
  if (category && category !== "all") params.set("category", category);
  if (kind) params.set("kind", kind);
  if (limit) params.set("limit", limit);
  const res = await axios.get(gsApi(`/commands?${params.toString()}`));
  return Array.isArray(res.data) ? res.data : [];
}

async function apiTrending(limit = 10) {
  const res = await axios.get(gsApi(`/commands/trending?limit=${limit}`));
  const data = Array.isArray(res.data) ? res.data : [];
  return data.slice(0, limit);
}

function cleanId(id) { return encodeURIComponent(String(id).trim().replace(/^#/, "")); }

async function apiGetOne(id) {
  let res;
  try {
    res = await axios.get(gsApi(`/commands/${cleanId(id)}`), { timeout: 15000, validateStatus: () => true });
  } catch (err) {
    const e = new Error(err.code === "ECONNABORTED" ? "Request timed out." : (err.message || "Network error."));
    e.status = 0;
    throw e;
  }
  if (res.status === 404) return null;
  if (res.status >= 400) {
    const apiMsg = (res.data && typeof res.data === "object" && res.data.error) || `Store API returned HTTP ${res.status}`;
    const e = new Error(apiMsg);
    e.status = res.status;
    throw e;
  }
  const d = res.data;
  return d && typeof d === "object" && !Array.isArray(d) ? d : null;
}

async function apiUpload({ name, category, description, author, code, kind, version }) {
  const headers = { "Content-Type": "application/json" };
  if (RESERVED_NAMES.includes(String(name).toLowerCase()) && CONFIG.ADMIN_USER && CONFIG.ADMIN_PASS) {
    headers.user = CONFIG.ADMIN_USER;
    headers.pass = CONFIG.ADMIN_PASS;
  }
  const res = await axios.post(
    gsApi(`/commands`),
    { name, category, description, author, code, kind, version },
    { headers, timeout: 30000, validateStatus: () => true }
  );
  const data = res.data && typeof res.data === "object" ? res.data : {};
  const out  = { ...data, _status: res.status, _created: res.status === 201, _duplicate: res.status === 409 && data._duplicate === true };
  if (res.status >= 400 && !out.error) out.error = `Store API returned HTTP ${res.status}`;
  return out;
}

async function apiLike(id, visitorId) {
  const res = await axios.post(
    gsApi(`/commands/${cleanId(id)}/like`),
    { visitor_id: visitorId },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data;
}

async function apiDelete(id) {
  const res = await axios.delete(
    gsApi(`/commands/${cleanId(id)}`),
    { headers: adminHeaders() }
  );
  return res.data;
}

async function uploadToPastebin(code, pasteName = "GoatBot Command") {
  if (!CONFIG.PASTEBIN_API_KEY) return null;
  try {
    const params = new URLSearchParams();
    params.set("api_dev_key",       CONFIG.PASTEBIN_API_KEY);
    params.set("api_option",        "paste");
    params.set("api_paste_code",    code);
    params.set("api_paste_name",    pasteName);
    params.set("api_paste_format",  "javascript");
    params.set("api_paste_expire_date", "N");
    params.set("api_paste_private", "0");

    const res = await axios.post(
      "https://pastebin.com/api/api_post.php",
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 10000 }
    );

    const pasteUrl = (res.data || "").trim();
    if (!pasteUrl.startsWith("https://pastebin.com/")) return null;

    const pasteKey = pasteUrl.replace("https://pastebin.com/", "");
    return `https://pastebin.com/raw/${pasteKey}`;
  } catch (_) {
    return null;
  }
}

async function apiCountInstall(id) {
  try { await axios.post(gsApi(`/commands/${cleanId(id)}/install`), {}, { timeout: 8000 }); }
  catch (_) {}
}

async function apiRawLink(id) {
  try {
    const res = await axios.post(gsApi(`/commands/${cleanId(id)}/rawlink`), {}, { timeout: 20000 });
    const u = res.data?.url;
    return typeof u === "string" && u.startsWith("http") ? u : null;
  } catch (_) { return null; }
}

async function getRawLink(cmd) {
  if (cmd.pastebin_url) return cmd.pastebin_url;
  const id = cmd._id || cmd.id;
  let url = id ? await apiRawLink(id) : null;
  if (!url && cmd.code && CONFIG.PASTEBIN_API_KEY) {
    url = await uploadToPastebin(cmd.code, cmd.name || "GoatBot Command");
    if (url && id) await apiSetPastebin(id, url);
  }
  return url;
}

async function apiSetPastebin(id, rawUrl) {
  try {
    await axios.patch(
      gsApi(`/commands/${cleanId(id)}/pastebin`),
      { url: rawUrl },
      { headers: adminHeaders() }
    );
  } catch (_) {}
}

let _visitorId = null;
function getVisitorId() {
  if (_visitorId) return _visitorId;
  const cachePath = path.join(process.cwd(), "goatstore_visitor.json");
  const cache     = loadJson(cachePath, {});
  if (cache.id) { _visitorId = cache.id; return _visitorId; }
  _visitorId = `bot_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  saveJson(cachePath, { id: _visitorId });
  return _visitorId;
}

// 🔥 EXTREME ATTITUDE EGO ANIMATIONS WITH ☠️ EMOJI
async function animateInstall(api, threadID, name) {
  const steps = [
    { text: `⚡ 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀\n▰▰▰▱▱▱▱▱▱▱ 20%\n☠️ 𝙄𝙣𝙞𝙩𝙞𝙖𝙡𝙞𝙯𝙞𝙣𝙜 [ ${name} ]...`, delay: 500 },
    { text: `⚡ 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀\n▰▰▰▰▰▱▱▱▱▱ 40%\n☠️ 𝙁𝙚𝙩𝙘𝙝𝙞𝙣𝙜 𝙎𝙤𝙪𝙧𝙘𝙚 𝙋𝙖𝙘𝙠𝙖𝙜𝙚...`, delay: 600 },
    { text: `⚡ 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀\n▰▰▰▰▰▰▰▱▱▱ 60%\n☠️ 𝙑𝙚𝙧𝙞𝙛𝙮𝙞𝙣𝙜 𝙎𝙚𝙘𝙪𝙧𝙞𝙩𝙮...`, delay: 700 },
    { text: `⚡ 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀\n▰▰▰▰▰▰▰▰▰▱ 80%\n☠️ 𝙒𝙧𝙞𝙩𝙞𝙣𝙜 𝙈𝙤𝙙𝙪𝙡𝙚 𝙩𝙤 𝘿𝙞𝙨𝙠...`, delay: 600 },
    { text: `⚡ 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀\n▰▰▰▰▰▰▰▰▰▰ 100%\n☠️ 𝙄𝙣𝙨𝙩𝙖𝙡𝙡𝙖𝙩𝙞𝙤𝙣 𝘾𝙤𝙢𝙥𝙡𝙚𝙩𝙚!`, delay: 500 },
  ];
  const info = await api.sendMessage(`⚡ 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀\n▰▱▱▱▱▱▱▱▱▱ 0%\n☠️ 𝙋𝙧𝙚𝙥𝙖𝙧𝙞𝙣𝙜 𝙄𝙣𝙨𝙩𝙖𝙡𝙡𝙖𝙩𝙞𝙤𝙣...`, threadID);
  for (let i = 0; i < steps.length; i++) {
    await new Promise(r => setTimeout(r, steps[i].delay));
    await api.editMessage(steps[i].text, info.messageID);
  }
  return info.messageID;
}

async function animateUpload(api, threadID, name) {
  const steps = [
    { text: `👑 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀\n▰▰▰▱▱▱▱▱▱▱ 30%\n☠️ 𝘼𝙣𝙖𝙡𝙮𝙯𝙞𝙣𝙜 𝙎𝙤𝙪𝙧𝙘𝙚...`, delay: 500 },
    { text: `👑 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀\n▰▰▰▰▰▰▰▱▱▱ 70%\n☠️ 𝙎𝙮𝙣𝙘𝙞𝙣𝙜 𝙬𝙞𝙩𝙝 𝘾𝙡𝙤𝙪𝙙...`, delay: 700 },
    { text: `👑 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀\n▰▰▰▰▰▰▰▰▰▰ 100%\n☠️ 𝙐𝙥𝙡𝙤𝙖𝙙 𝙍𝙚𝙜𝙞𝙨𝙩𝙚𝙧𝙚𝙙!`, delay: 500 },
  ];
  const info = await api.sendMessage(`👑 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀\n▰▱▱▱▱▱▱▱▱▱ 0%\n☠️ 𝙋𝙧𝙚𝙥𝙖𝙧𝙞𝙣𝙜 𝙐𝙥𝙡𝙤𝙖𝙙...`, threadID);
  for (let i = 0; i < steps.length; i++) {
    await new Promise(r => setTimeout(r, steps[i].delay));
    await api.editMessage(steps[i].text, info.messageID);
  }
  return info.messageID;
}

function autoloadCommand(filePath) {
  try {
    delete require.cache[require.resolve(filePath)];
    const cmd = require(filePath);
    if (cmd?.config?.name) {
      const name = cmd.config.name.toLowerCase();
      global.GoatBot.commands.set(name, cmd);
      if (Array.isArray(cmd.config.aliases))
        cmd.config.aliases.forEach(a => global.GoatBot.commands.set(a.toLowerCase(), cmd));
      if (typeof cmd.onLoad === "function") cmd.onLoad({});
      return { success: true, name };
    }
    return { success: false, reason: "Missing config.name." };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

const CAT_ICONS = {
  economy: "💎", fun: "🎭", moderation: "🛡️",
  games: "🎮", utility: "⚙️", ai: "🤖",
};
function catBadge(cmd) {
  const icon = CAT_ICONS[cmd.category] || "☠️";
  return `${icon} ${cmd.category || "uncategorized"}`;
}

async function doInstall(api, threadID, id, forceKind = null) {
  let cmd = null;
  try {
    cmd = await apiGetOne(id);
  } catch (err) {
    return api.sendMessage(
      `🚫 𝙁𝙖𝙞𝙡𝙚𝙙 𝙩𝙤 𝙛𝙚𝙩𝙘𝙝 𝙞𝙩𝙚𝙢.\n` +
      `╭─‣ 𝙄𝘿 : ${id}\n` +
      `├‣ 𝙍𝙚𝙖𝙨𝙤𝙣 : ${err.message}${err.status ? ` (HTTP ${err.status})` : ""}\n` +
      `╰──────────────◊`,
      threadID
    );
  }

  if (!cmd) return api.sendMessage(`🚫 𝘾𝙤𝙢𝙢𝙖𝙣𝙙 𝙣𝙤𝙩 𝙛𝙤𝙪𝙣𝙙 𝙛𝙤𝙧 𝙄𝘿: ${id}`, threadID);
  if (!cmd.code && !cmd.pastebin_url)
    return api.sendMessage("⚠️ 𝘾𝙤𝙢𝙢𝙖𝙣𝙙 𝙝𝙖𝙨 𝙣𝙤 𝙘𝙤𝙙𝙚 𝙤𝙧 𝙋𝙖𝙨𝙩𝙚𝙗𝙞𝙣 𝙡𝙞𝙣𝙠.", threadID);

  const isEvent = forceKind ? forceKind === "event" : cmd.kind === "event";

  let code = cmd.code || "";
  if (!code && cmd.pastebin_url) {
    try {
      const pbRes = await axios.get(cmd.pastebin_url, { timeout: 10000, responseType: "text" });
      code = typeof pbRes.data === "string" ? pbRes.data : String(pbRes.data);
    } catch (_) {
      return api.sendMessage(
        `🚫 𝙁𝙖𝙞𝙡𝙚𝙙 𝙩𝙤 𝙛𝙚𝙩𝙘𝙝 𝙘𝙤𝙙𝙚 𝙛𝙧𝙤𝙢 𝙋𝙖𝙨𝙩𝙚𝙗𝙞𝙣.\n` +
        `╭─‣ 𝙐𝙍𝙇: ${cmd.pastebin_url}\n╰──────────────◊\n`,
        threadID
      );
    }
  }

  if (code) {
    try { new Function(code); }
    catch (err) { return api.sendMessage(`⚠️ 𝙎𝙮𝙣𝙩𝙖𝙭 𝙚𝙧𝙧𝙤𝙧 𝙞𝙣 𝙧𝙚𝙢𝙤𝙩𝙚 𝙘𝙤𝙙𝙚:\n${err.message}`, threadID); }
  }

  const displayName = cmd.name || `gs_${id}`;
  let pid;
  try { pid = await animateInstall(api, threadID, displayName); } catch (_) {}

  const installDir = isEvent ? getEventsDir() : getCmdsDir();
  const safeName = String(displayName).replace(/[^\w\-. ]+/g, "").trim().replace(/\s+/g, "_").replace(/^\.+/, "") || `gs_${id}`;
  const fileName = safeName + ".js";
  const filePath = path.join(installDir, fileName);
  const locLabel = path.relative(process.cwd(), filePath);

  try {
    if (path.dirname(path.resolve(filePath)) !== path.resolve(installDir)) throw new Error("Unsafe file name.");
    if (!fs.existsSync(installDir)) fs.mkdirSync(installDir, { recursive: true });

    if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") !== code)
      fs.copyFileSync(filePath, filePath + ".bak");
    fs.writeFileSync(filePath, code, "utf-8");
  } catch (err) {
    if (pid) api.unsendMessage(pid).catch(() => {});
    return api.sendMessage(`🚫 𝙁𝙖𝙞𝙡𝙚𝙙 𝙩𝙤 𝙬𝙧𝙞𝙩𝙚 𝙛𝙞𝙡𝙚:\n${err.message}`, threadID);
  }

  const load = isEvent ? { success: false } : autoloadCommand(filePath);
  apiCountInstall(cmd._id || id);

  // ☠️ Boss Attitude Font Message After Successful Install
  const msg =
    `☠️ 𝘽𝙊𝙎𝙎 𝘼𝙋𝙉𝘼𝙍 𝙁𝙄𝙇𝙀 𝙄𝙉𝙎𝙏𝘼𝙇𝙇 𝙃𝙊𝙄𝘾𝙀! 👑\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `╭─‣ 𝙁𝙞𝙡𝙚 𝙉𝙖𝙢𝙚 : ${cmd.name || "Unknown"}\n` +
    `├‣ 𝘼𝙪𝙩𝙝𝙤𝙧 : ${cmd.author || "Unknown"}\n` +
    `├‣ 𝘾𝙖𝙩𝙚𝙜𝙤𝙧𝙮 : ${catBadge(cmd)}\n` +
    `├‣ 𝙄𝘿 : ${displayId(cmd)}\n` +
    `├‣ 𝙇𝙤𝙘𝙖𝙩𝙞𝙤𝙣 : ${locLabel}\n` +
    `╰──────────────◊\n` +
    (load.success
      ? `🔥 "${load.name}" 𝙞𝙨 𝙣𝙤𝙬 𝙡𝙞𝙫𝙚 𝙖𝙣𝙙 𝙧𝙚𝙖𝙙𝙮 𝙩𝙤 𝙧𝙤𝙘𝙠, 𝘽𝙤𝙨𝙨!`
      : isEvent
      ? `⚠️ 𝙀𝙫𝙚𝙣𝙩 𝙨𝙖𝙫𝙚𝙙. 𝙍𝙚𝙨𝙩𝙖𝙧𝙩 𝙗𝙤𝙩 𝙩𝙤 𝙖𝙥𝙥𝙡𝙮.`
      : `⚠️ 𝘼𝙪𝙩𝙤𝙡𝙤𝙖𝙙 𝙛𝙖𝙞𝙡𝙚𝙙: ${load.reason}`);

  if (pid) {
    try {
      await api.editMessage(msg, pid);
    } catch (_) { api.sendMessage(msg, threadID); }
  } else {
    api.sendMessage(msg, threadID);
  }
}

async function doUpload(api, threadID, filePath, kind = "command") {
  let code;
  try { code = fs.readFileSync(filePath, "utf8"); }
  catch (err) { return api.sendMessage(`🚫 𝙍𝙚𝙖𝙙 𝙛𝙖𝙞𝙡𝙚𝙙:\n${err.message}`, threadID); }

  try { new Function(code); }
  catch (err) { return api.sendMessage(`⚠️ 𝙎𝙮𝙣𝙩𝙖𝙭 𝙀𝙧𝙧𝙤𝙧:\n${err.message}`, threadID); }

  const { name, author, description, category, version } = extractMeta(code, path.basename(filePath, ".js"), true);

  let pid;
  try { pid = await animateUpload(api, threadID, name); } catch (_) {}

  try {
    const result = await apiUpload({ name, category, description, author, code, kind, version });

    if (result._duplicate) {
      if (pid) api.unsendMessage(pid).catch(() => {});
      return api.sendMessage(
        `☠️ 𝘾𝙤𝙢𝙢𝙖𝙣𝙙 𝘼𝙡𝙧𝙚𝙖𝙙𝙮 𝙀𝙭𝙞𝙨𝙩𝙨, 𝘽𝙤𝙨𝙨!\n` +
        `╭─‣ 𝙉𝙖𝙢𝙚 : ${name}\n` +
        `├‣ 𝘼𝙪𝙩𝙝𝙤𝙧 : ${author}\n` +
        `├‣ 𝙑𝙚𝙧𝙨𝙞𝙤𝙣 : v${version}\n` +
        `├‣ 𝙄𝘿 : ${displayId(result)}\n` +
        `╰──────────────◊`,
        threadID
      );
    }

    if (result.error) {
      if (pid) api.unsendMessage(pid).catch(() => {});
      return api.sendMessage(
        `🚫 𝙐𝙥𝙡𝙤𝙖𝙙 𝙁𝙖𝙞𝙡𝙚𝙙!\n╭─‣ 𝙉𝙖𝙢𝙚 : ${name}\n├‣ 𝙀𝙧𝙧𝙤𝙧 : ${result.error}\n╰──────────────◊`,
        threadID
      );
    }

    const isUpdated = result._updated === true;
    const newId     = result._id || result.id;

    let rawUrl = result.pastebin_url || null;
    if (!rawUrl && newId && code) rawUrl = await getRawLink({ ...result, code });

    const msg =
      `☠️ 𝘽𝙊𝙎𝙎 𝙐𝙋𝙇𝙊𝘼𝘿 𝙎𝙐𝘾𝘾𝙀𝙎𝙎𝙁𝙐𝙇! 🔥\n` +
      `╭─‣ 𝙉𝙖𝙢𝙚 : ${name}\n` +
      `├‣ 𝘾𝙖𝙩𝙚𝙜𝙤𝙧𝙮 : ${catBadge({ category })}\n` +
      `├‣ 𝘼𝙪𝙩𝙝𝙤𝙧 : ${author}\n` +
      `├‣ 𝙑𝙚𝙧𝙨𝙞𝙤𝙣 : v${version}\n` +
      `├‣ 𝙄𝘿 : ${displayId(result) !== "N/A" ? displayId(result) : (newId || "N/A")}\n` +
      (rawUrl ? `├‣ 𝙍𝙖𝙬 𝙇𝙞𝙣𝙠 : ${rawUrl}\n` : "") +
      `╰──────────────◊`;

    if (pid) {
      try { await api.editMessage(msg, pid); }
      catch (_) { api.sendMessage(msg, threadID); }
    } else {
      api.sendMessage(msg, threadID);
    }
  } catch (err) {
    if (pid) api.unsendMessage(pid).catch(() => {});
    api.sendMessage(
      `🚫 𝘼𝙋𝙄 𝘾𝙖𝙡𝙡 𝙁𝙖𝙞𝙡𝙚𝙙!\n├‣ 𝙀𝙧𝙧𝙤𝙧 : ${err.message || "Unknown error"}\n╰──────────────◊`,
      threadID
    );
  }
}

async function checkSelfUpdate() {
  const now = Date.now();
  if (_updateCheckCache && (now - _updateCheckCache.checkedAt) < CONFIG.UPDATE_CHECK_INTERVAL)
    return _updateCheckCache.result;
  try {
    const cmds = await apiSearch("goatstore");
    const myAuthor = String(module.exports.config.author || "").trim().toLowerCase();
    const match = cmds.find(c =>
      String(c.name || "").trim().toLowerCase() === "goatstore" &&
      (c.kind || "command") === "command" &&
      String(c.author || "").trim().toLowerCase() === myAuthor);
    if (!match) { _updateCheckCache = { checkedAt: now, result: null }; return null; }
    const current = module.exports.config.version;
    const latest  = match.version || "0.0.0";
    const result = {
      hasUpdate:      cmpVer(latest, current) > 0,
      currentVersion: current,
      latestVersion:  latest,
      latestId:       match._id || match.id,
      description:    match.description || "",
    };
    _updateCheckCache = { checkedAt: now, result };
    return result;
  } catch (_) { return null; }
}

async function doSelfUpdateSilent(api, threadID, selfUpdate) {
  try {
    const cmd = await apiGetOne(selfUpdate.latestId);
    if (!cmd?.code) return false;
    try { new Function(cmd.code); } catch (_) { return false; }
    if (detectFramework(cmd.code) !== "goat") return false;
    try { fs.copyFileSync(__filename, __filename + ".bak"); } catch (_) {}
    fs.writeFileSync(__filename, cmd.code, "utf-8");
    const load = autoloadCommand(__filename);
    if (api && threadID) {
      const msg =
        `♻️ 𝘼𝙪𝙩𝙤-𝙐𝙥𝙙𝙖𝙩𝙚𝙙 𝙀𝙂𝙊 𝙂𝙤𝙖𝙩𝙎𝙩𝙤𝙧𝙚!\n` +
        `╭─‣ 𝙑𝙚𝙧𝙨𝙞𝙤𝙣 : v${cmd.version || selfUpdate.latestVersion}\n` +
        `╰──────────────◊\n`;
      api.sendMessage(msg, threadID).catch(() => {});
    }
    return true;
  } catch (_) { return false; }
}

async function maybeAutoUpdate(api, threadID) {
  if (_autoupdateInFlight) return;
  const info = await checkSelfUpdate();
  if (!info?.hasUpdate) return;
  _autoupdateInFlight = true;
  try { await doSelfUpdateSilent(api, threadID, info); }
  finally { _autoupdateInFlight = false; }
}

let _syncRunning = false;

async function runAutoSync() {
  const summary = { uploaded: 0, updated: 0, duplicates: 0, unchanged: 0, errors: 0, busy: false };
  if (_syncRunning) { summary.busy = true; return summary; }
  _syncRunning = true;
  try {
    const folders = [
      { dir: getCmdsDir(),    kind: "command" },
      { dir: getEventsDir(),  kind: "event" },
    ].filter(f => f.dir && fs.existsSync(f.dir));
    if (!folders.length) return summary;
    const cache = loadJson(SYNC_CACHE_PATH, {});

    for (const { dir, kind } of folders) {
      let files = [];
      try { files = fs.readdirSync(dir).filter(f => f.endsWith(".js")); } catch (_) { continue; }
      for (const file of files) {
        const fullPath = path.join(dir, file);
        let code;
        try { code = fs.readFileSync(fullPath, "utf8"); } catch (_) { continue; }
        try { new Function(code); } catch (_) { continue; }
        if (detectFramework(code) !== "goat") continue;

        const { name, author, description, category, version } = extractMeta(code, path.basename(file, ".js"));
        const hash = hashContent(code);
        const cacheKey = `${kind}:${file}:${version}`;
        if (cache[cacheKey]?.hash === hash) { summary.unchanged++; continue; }

        try {
          const result = await apiUpload({ name, category, description, author, code, kind, version });
          if (result._duplicate) {
            cache[cacheKey] = { hash, id: result._id || result.id };
            summary.duplicates++;
          } else if (!result.error) {
            cache[cacheKey] = { hash, id: result._id || result.id };
            if (result._updated) summary.updated++; else summary.uploaded++;
          } else {
            summary.errors++;
          }
        } catch (_) { summary.errors++; }
        await new Promise(r => setTimeout(r, 600));
      }
    }
    saveJson(SYNC_CACHE_PATH, cache);
    return summary;
  } finally {
    _syncRunning = false;
  }
}

let _watchDebounce = null;
let _watchersStarted = false;

function startAutoSyncWatcher() {
  if (_watchersStarted) return;
  _watchersStarted = true;
  const dirs = [getCmdsDir(), getEventsDir()].filter(d => d && fs.existsSync(d));
  for (const dir of dirs) {
    try {
      fs.watch(dir, { persistent: false }, (_, filename) => {
        if (!filename || !filename.endsWith(".js")) return;
        clearTimeout(_watchDebounce);
        _watchDebounce = setTimeout(() => { runAutoSync().catch(() => {}); }, 3000);
      });
    } catch (_) {}
  }
}

async function getTodayUpdates() {
  try {
    const all   = await apiSearch("");
    const today = new Date().toDateString();
    return all.filter(c => new Date(c.createdAt || c.updatedAt || 0).toDateString() === today);
  } catch (_) { return []; }
}

function paginateArray(arr, page, limit) {
  const total      = arr.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset     = (page - 1) * limit;
  const slice      = arr.slice(offset, offset + limit);
  return { items: slice, total, totalPages };
}

function renderCmdRow(cmd) {
  return (
    `╭─‣ ${cmd.kind === "event" ? "⚡" : "☠️"} 𝙁𝙞𝙡𝙚 : ${cmd.name} 〄\n` +
    `├‣ 𝙄𝘿 : ${displayId(cmd)}\n` +
    `├‣ 𝘼𝙪𝙩𝙝𝙤𝙧 : ${cmd.author || "Unknown"}\n` +
    `├‣ 𝘾𝙖𝙩𝙚𝙜𝙤𝙧𝙮 : ${catBadge(cmd)}\n` +
    `├‣ 𝙇𝙞𝙠𝙚𝙨 : 🔥 ${cmd.likes || 0}\n` +
    `╰──────────────◊\n` +
    ` ✰ 𝘼𝙙𝙙𝙚𝙙 : ${new Date(cmd.createdAt || Date.now()).toDateString()}\n\n`
  );
}

async function sendListPage(api, threadID, senderID, category, page, limit, prefix) {
  try {
    const all  = await apiSearch("", category);
    const { items, total, totalPages } = paginateArray(all, page, limit);
    if (!items.length) return api.sendMessage("🚫 𝙉𝙤 𝙘𝙤𝙢𝙢𝙖𝙣𝙙𝙨 𝙛𝙤𝙪𝙣𝙙.", threadID);

    const label = category ? `📁 𝘾𝙖𝙩𝙚𝙜𝙤𝙧𝙮: ${category}` : "📁 𝘼𝙡𝙡 𝘾𝙤𝙢𝙢𝙖𝙣𝙙𝙨";
    let msg = `⚡ 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀 — ${label} [𝙋𝙖𝙜𝙚 ${page}/${totalPages}] (${total} 𝙩𝙤𝙩𝙖𝙡)\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    items.forEach(cmd => { msg += renderCmdRow(cmd); });
    if (totalPages > 1)
      msg += `💬 𝙍𝙚𝙥𝙡𝙮 "page <number>" 𝙤𝙧 𝙧𝙚𝙖𝙘𝙩 ➡\n` +
             `🗑️ 𝙍𝙚𝙥𝙡𝙮 "delete <id>" 𝙩𝙤 𝙧𝙚𝙢𝙤𝙫𝙚 (admin).`;

    const sent = await api.sendMessage(msg.trim(), threadID);
    if (totalPages > 1) {
      const h = {
        commandName: "goatstore", messageID: sent.messageID,
        mode: "list", category, page, totalPages, limit, senderID, editCount: 0,
      };
      global.GoatBot.onReply.set(sent.messageID, h);
      global.GoatBot.onReaction.set(sent.messageID, h);
    }
  } catch (_) { api.sendMessage("🚫 𝙇𝙞𝙨𝙩 𝘼𝙋𝙄 𝙀𝙧𝙧𝙤𝙧.", threadID); }
}

function searchTitle(query, category, kind, author) {
  if (query)  return `🔍 𝙎𝙚𝙖𝙧𝙘𝙝: "${query}"`;
  if (author) return `👤 𝘼𝙪𝙩𝙝𝙤𝙧: ${author}`;
  if (kind)   return `${kind === "event" ? "⚡ 𝙀𝙫𝙚𝙣𝙩𝙨" : "☠️ 𝘾𝙤𝙢𝙢𝙖𝙣𝙙𝙨"}${category ? ` — ${category}` : ""}`;
  return `📂 𝘾𝙖𝙩𝙚𝙜𝙤𝙧𝙮: ${category || "all"}`;
}

async function sendSearchPage(api, threadID, senderID, query, category, page, limit, prefix, kind = "", author = "") {
  try {
    const all  = await apiSearch(query, category, 0, kind, author);
    const { items, total, totalPages } = paginateArray(all, page, limit);
    if (!items.length)
      return api.sendMessage(`🚫 𝙉𝙤 𝙧𝙚𝙨𝙪𝙡𝙩𝙨 𝙛𝙤𝙪𝙣𝙙.`, threadID);

    const title = searchTitle(query, category, kind, author);
    let msg = `⚡ 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀 — ${title} (${total} 𝙛𝙤𝙪𝙣𝙙)\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    items.forEach(cmd => { msg += renderCmdRow(cmd); });
    if (totalPages > 1)
      msg += `𝙋𝙖𝙜𝙚 ${page}/${totalPages}\n💬 𝙍𝙚𝙥𝙡𝙮 "page <number>" 𝙤𝙧 𝙧𝙚𝙖𝙘𝙩 ➡\n`;
    msg += `🗑️ 𝙍𝙚𝙥𝙡𝙮 "delete <id>" 𝙩𝙤 𝙧𝙚𝙢𝙤𝙫𝙚 (admin).`;

    const sent = await api.sendMessage(msg.trim(), threadID);
    const h = {
      commandName: "goatstore", messageID: sent.messageID,
      mode: "search", query, category, kind, author, page, totalPages, limit, senderID, editCount: 0,
    };
    global.GoatBot.onReply.set(sent.messageID, h);
    if (totalPages > 1) global.GoatBot.onReaction.set(sent.messageID, h);
  } catch (_) { api.sendMessage("🚫 𝙎𝙚𝙖𝙧𝙘𝙝 𝘼𝙋𝙄 𝙀𝙧𝙧𝙤𝙧.", threadID); }
}

async function renderListInto(category, page, limit) {
  const all  = await apiSearch("", category);
  const { items, total, totalPages } = paginateArray(all, page, limit);
  if (!items.length) return null;
  const label = category ? `📁 𝘾𝙖𝙩𝙚𝙜𝙤𝙧𝙮: ${category}` : "📁 𝘼𝙡𝙡 𝘾𝙤𝙢𝙢𝙖𝙣𝙙𝙨";
  let msg = `⚡ 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀 — ${label} [𝙋𝙖𝙜𝙚 ${page}/${totalPages}] (${total} 𝙩𝙤𝙩𝙖𝙡)\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  items.forEach(cmd => { msg += renderCmdRow(cmd); });
  if (totalPages > 1) msg += `React ➡ next page.`;
  return { text: msg.trim(), totalPages };
}

async function renderSearchInto(query, category, page, limit, kind = "", author = "") {
  const all  = await apiSearch(query, category, 0, kind, author);
  const { items, total, totalPages } = paginateArray(all, page, limit);
  if (!items.length) return null;
  const title = searchTitle(query, category, kind, author);
  let msg = `⚡ 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀 — ${title} (${total} 𝙛𝙤𝙪𝙣𝙙)\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  items.forEach(cmd => { msg += renderCmdRow(cmd); });
  if (totalPages > 1) msg += `Page ${page}/${totalPages}\nReact ➡ next page.`;
  return { text: msg.trim(), totalPages };
}

function buildMenu(prefix) {
  const p = `${prefix}gs`;
  return (
    `👑 ━━━✦☠️ **𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀** ☠️✦━━━ 👑\n` +
    `   🔥 𝙐𝙡𝙩𝙞𝙢𝙖𝙩𝙚 𝘾𝙤𝙢𝙢𝙖𝙣𝙙 𝙈𝙖𝙧𝙠𝙚𝙩𝙥𝙡𝙖𝙘𝙚 🔥\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `• ${p}               — 𝙈𝙚𝙣𝙪 / 𝙉𝙤𝙩𝙞𝙛𝙞𝙘𝙖𝙩𝙞𝙤𝙣𝙨\n` +
    `• ${p} n             — 𝙏𝙤𝙙𝙖𝙮'𝙨 𝙉𝙚𝙬 𝙐𝙥𝙙𝙖𝙩𝙚𝙨\n` +
    `• ${p} list [page]   — 𝘽𝙧𝙤𝙬𝙨𝙚 𝘼𝙡𝙡 𝘾𝙤𝙢𝙢𝙖𝙣𝙙𝙨\n` +
    `• ${p} list <cat>    — 𝘽𝙧𝙤𝙬𝙨𝙚 𝙗𝙮 𝘾𝙖𝙩𝙚𝙜𝙤𝙧𝙮\n` +
    `• ${p} events        — 𝘽𝙧𝙤𝙬𝙨𝙚 𝙀𝙫𝙚𝙣𝙩𝙨 𝙊𝙣𝙡𝙮\n` +
    `• ${p} commands      — 𝘽𝙧𝙤𝙬𝙨𝙚 𝘾𝙤𝙢𝙢𝙖𝙣𝙙𝙨 𝙊𝙣𝙡𝙮\n` +
    `• ${p} <name/id>     — 𝙎𝙚𝙖𝙧𝙘𝙝 𝙗𝙮 𝙉𝙖𝙢𝙚 / 𝙄𝘿\n` +
    `• ${p} author <n>    — 𝘼𝙡𝙡 𝙗𝙮 𝘼𝙪𝙩𝙝𝙤𝙧\n` +
    `• ${p} install <id>  — 𝙄𝙣𝙨𝙩𝙖𝙡𝙡 𝘾𝙤𝙢𝙢𝙖𝙣𝙙\n` +
    `• ${p} event install — 𝙄𝙣𝙨𝙩𝙖𝙡𝙡 𝙀𝙫𝙚𝙣𝙩\n` +
    `• ${p} like <id>     — 𝙇𝙞𝙠𝙚 / 𝙐𝙣𝙡𝙞𝙠𝙚\n` +
    `• ${p} trending      — 𝙏𝙤𝙥 𝙏𝙧𝙚𝙣𝙙𝙞𝙣𝙜 𝙄𝙩𝙚𝙢𝙨\n` +
    `• ${p} upload <file> — 𝙐𝙥𝙡𝙤𝙖𝙙 𝘾𝙤𝙢𝙢𝙖𝙣𝙙\n` +
    `• ${p} update <file> — 𝙊𝙫𝙚𝙧𝙬𝙧𝙞𝙩𝙚 / 𝙐𝙥𝙙𝙖𝙩𝙚\n` +
    `• ${p} rawlink <id>  — 𝙂𝙚𝙩 𝙋𝙖𝙨𝙩𝙚𝙗𝙞𝙣 𝙇𝙞𝙣𝙠\n` +
    `• ${p} delete <id>   — 𝘿𝙚𝙡𝙚𝙩𝙚 (𝘼𝙙𝙢𝙞𝙣)\n` +
    `• ${p} owner         — 𝙂𝙤𝙖𝙩𝙨𝙩𝙤𝙧𝙚 𝙊𝙬𝙣𝙚𝙧 𝘾𝙤𝙫𝙚𝙧\n` +
    `• ${p} sync          — 𝙈𝙖𝙣𝙪𝙖𝙡 𝙎𝙮𝙣𝙘\n\n` +
    `✨ 𝘾𝙖𝙩𝙚𝙜𝙤𝙧𝙞𝙚𝙨: ${CONFIG.CATEGORIES.join(", ")}\n` +
    `💡 𝙍𝙚𝙥𝙡𝙮 "page <n>" 𝙤𝙧 𝙧𝙚𝙖𝙘𝙩 ➡ 𝙩𝙤 𝙣𝙖𝙫𝙞𝙜𝙖𝙩𝙚.`
  );
}

module.exports = {
  config: {
    name:             "goatstore",
    aliases:          ["gs", "store", "cmdstore"],
    version:          "1.6.0",
    author:           "Hridoy Hossen",
    countDown:        3,
    role:             0,
    shortDescription: "𝙀𝙂𝙊 𝙂𝙤𝙖𝙩𝙎𝙩𝙤𝙧𝙚 — 𝙋𝙧𝙚𝙢𝙞𝙪𝙢 𝙈𝙖𝙧𝙠𝙚𝙩𝙥𝙡𝙖𝙘𝙚",
    longDescription:  "Full-featured EGO GoatStore command suite with custom animations, bold fonts, cool icons and auto-sync.",
    category:         "System",
    guide: {
      en:
        "{pn} — Menu\n" +
        "{pn} n — Today's updates\n" +
        "{pn} list [page] — All commands\n" +
        "{pn} owner — Owner cover image\n" +
        "{pn} install <id> — Install\n" +
        "{pn} upload <file> — Upload\n" +
        "{pn} sync — Manual sync",
    },
    autoSync: CONFIG.AUTO_SYNC,
  },

  onLoad: function () {
    if (global.__goatstoreStarted) return;
    global.__goatstoreStarted = true;

    setTimeout(() => {
      maybeAutoUpdate(null, null).catch(() => {});
      setInterval(() => maybeAutoUpdate(null, null).catch(() => {}), CONFIG.UPDATE_CHECK_INTERVAL);
    }, 6000);

    if (module.exports.config.autoSync) {
      setTimeout(() => {
        runAutoSync().catch(() => {});
        setInterval(() => runAutoSync().catch(() => {}), CONFIG.AUTO_SYNC_INTERVAL);
      }, 10000);

      if (CONFIG.AUTO_SYNC_WATCH) startAutoSyncWatcher();
    }
  },

  onReply: async function ({ api, event, Reply }) {
    const { threadID, senderID } = event;
    const body = String(event.body || "");
    if (!isAllowed(senderID)) return;

    const delMatch = body.match(/^delete\s+(\S+)/i);
    if (delMatch) {
      const rawId = delMatch[1];
      const id = rawId.replace(/^#/, "");
      try {
        await apiDelete(id);
        return api.sendMessage(`🗑️ 𝘿𝙚𝙡𝙚𝙩𝙚𝙙 𝙎𝙪𝙘𝙘𝙚𝙨𝙨𝙛𝙪𝙡𝙡𝙮! 𝙄𝘿: ${rawId}`, threadID);
      } catch (err) {
        const e = err.response?.data?.error || err.message;
        return api.sendMessage(`🚫 𝘿𝙚𝙡𝙚𝙩𝙚 𝙁𝙖𝙞𝙡𝙚𝙙: ${e}`, threadID);
      }
    }

    const { mode, query, category, kind = "", author = "", page, totalPages, limit, senderID: origSender } = Reply;
    if (String(senderID) !== String(origSender)) return;

    const match = body.match(/^page\s+(\d+)$/i);
    if (!match) return;
    const newPage = parseInt(match[1]);
    if (newPage < 1 || newPage > totalPages)
      return api.sendMessage(`🚫 𝙋𝙖𝙜𝙚 𝙢𝙪𝙨𝙩 𝙗𝙚 𝙗𝙚𝙩𝙬𝙚𝙚𝙣 1 𝙖𝙣𝙙 ${totalPages}.`, threadID);

    api.unsendMessage(Reply.messageID).catch(() => {});
    const prefix = getPrefix(event.threadData);
    if (mode === "list")
      await sendListPage(api, threadID, senderID, category, newPage, limit, prefix);
    else
      await sendSearchPage(api, threadID, senderID, query, category, newPage, limit, prefix, kind, author);
  },

  onReaction: async function ({ api, event, Reaction }) {
    const { threadID, userID } = event;
    if (!isAllowed(userID)) return;

    const { mode, query, category, kind = "", author = "", page, totalPages, limit, senderID, messageID, editCount = 0 } = Reaction;
    if (String(userID) !== String(senderID)) return;
    if (page >= totalPages)
      return api.sendMessage("✨ 𝘼𝙡𝙧𝙚𝙖𝙙𝙮 𝙤𝙣 𝙩𝙝𝙚 𝙡𝙖𝙨𝙩 𝙥𝙖𝙜𝙚.", threadID);

    const nextPage = page + 1;
    try {
      const rendered = mode === "list"
        ? await renderListInto(category, nextPage, limit)
        : await renderSearchInto(query, category, nextPage, limit, kind, author);

      if (!rendered) return api.sendMessage("🚫 𝙉𝙤 𝙧𝙚𝙨𝙪𝙡𝙩𝙨 𝙛𝙤𝙪𝙣𝙙.", threadID);

      if (editCount >= CONFIG.MAX_EDITS_PER_MESSAGE) {
        const sent = await api.sendMessage(rendered.text, threadID);
        const h = { commandName: "goatstore", messageID: sent.messageID, mode, query, category, kind, author, page: nextPage, totalPages: rendered.totalPages, limit, senderID, editCount: 0 };
        global.GoatBot.onReply.set(sent.messageID, h);
        global.GoatBot.onReaction.set(sent.messageID, h);
      } else {
        await api.editMessage(rendered.text, messageID);
        const h = { commandName: "goatstore", messageID, mode, query, category, kind, author, page: nextPage, totalPages: rendered.totalPages, limit, senderID, editCount: editCount + 1 };
        global.GoatBot.onReply.set(messageID, h);
        global.GoatBot.onReaction.set(messageID, h);
      }
    } catch (_) {
      api.unsendMessage(messageID).catch(() => {});
      const prefix = getPrefix(event.threadData);
      if (mode === "list")
        await sendListPage(api, threadID, senderID, category, nextPage, limit, prefix);
      else
        await sendSearchPage(api, threadID, senderID, query, category, nextPage, limit, prefix, kind, author);
    }
  },

  onStart: async function ({ api, event, args, threadData }) {
    const { threadID, senderID } = event;

    if (!isAllowed(senderID))
      return api.sendMessage("🚫 𝙔𝙤𝙪 𝙖𝙧𝙚 𝙣𝙤𝙩 𝙖𝙡𝙡𝙤𝙬𝙚𝙙 𝙩𝙤 𝙪𝙨𝙚 𝙩𝙝𝙞𝙨 𝙘𝙤𝙢𝙢𝙖𝙣𝙙.", threadID, event.messageID);

    const prefix = getPrefix(threadData || event?.threadData);
    const sub    = args[0]?.toLowerCase() || null;

    maybeAutoUpdate(api, threadID).catch(() => {});

    if (!sub) {
      const updates = await getTodayUpdates();
      if (updates.length && !userSeenNoti.get(senderID)) {
        let n = `🔔 [ 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀 𝙉𝙊𝙏𝙄𝙁𝙄𝘾𝘼𝙏𝙄𝙊𝙉 ]\n𝙏𝙤𝙙𝙖𝙮 ${updates.length} 𝙣𝙚𝙬 𝙞𝙩𝙚𝙢𝙨 𝙙𝙧𝙤𝙥𝙥𝙚𝙙!\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
        updates.forEach(c => { n += ` ‣ ${c.name} (ID: ${displayId(c)})\n`; });
        n += `\n(Type "${prefix}gs n" for details)`;
        userSeenNoti.set(senderID, true);
        return api.sendMessage(n, threadID);
      }
      return api.sendMessage(buildMenu(prefix), threadID);
    }

    if (sub === "owner" || sub === "admin" || sub === "creator") {
      const coverText = "Goatstore Owner Of Ego";
      const roboticsBannerUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent("Futuristic cybernetic robotics elite control room, neon blue and gold glowing circuits, highly detailed vector digital art banner, cinematic lighting, 8k resolution, text banner style")}`;

      try {
        const imgRes = await axios.get(roboticsBannerUrl, { responseType: "stream" });
        return api.sendMessage({
          body: `👑 **𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀 — 𝙊𝙒𝙉𝙀𝙍**\n━━━━━━━━━━━━━━━━━━━━━━━\n☠️ *${coverText}*`,
          attachment: imgRes.data
        }, threadID);
      } catch (_) {
        return api.sendMessage(
          `👑 **𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀 — 𝙊𝙒𝙉𝙀𝙍**\n` +
          `╭─‣ **${coverText}**\n` +
          `╰──────────────◊\n` +
          `☠️ *Status: Supreme System Administrator*`,
          threadID
        );
      }
    }

    if (sub === "n" || sub === "notification") {
      const updates = await getTodayUpdates();
      if (!updates.length)
        return api.sendMessage("📅 𝙉𝙤 𝙣𝙚𝙬 𝙞𝙩𝙚𝙢𝙨 𝙩𝙤𝙙𝙖𝙮.", threadID);
      let msg = `⚡ 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀 — 𝙏𝙤𝙙𝙖𝙮'𝙨 𝙉𝙚𝙬 𝙄𝙩𝙚𝙢𝙨\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      updates.forEach(c =>
        msg += `╭─‣ ${c.name}\n├‣ 𝙄𝘿: ${displayId(c)}\n├‣ 𝘼𝙪𝙩𝙝𝙤𝙧: ${c.author}\n╰──────────────◊\n\n`
      );
      return api.sendMessage(msg.trim(), threadID);
    }

    if (sub === "sync") {
      api.sendMessage("🔄 𝙀𝙂𝙊 𝙎𝙮𝙣𝙘: 𝙎𝙘𝙖𝙣𝙣𝙞𝙣𝙜 𝙡𝙤𝙘𝙖𝙡 𝙛𝙤𝙡𝙙𝙚𝙧𝙨...", threadID);
      try {
        const r = await runAutoSync();
        if (r.busy) return api.sendMessage("⏳ 𝘼 𝙨𝙮𝙣𝙘 𝙨𝙚𝙨𝙨𝙞𝙤𝙣 𝙞𝙨 𝙖𝙡𝙧𝙚𝙖𝙙𝙮 𝙧𝙪𝙣𝙣𝙞𝙣𝙜.", threadID);
        api.sendMessage(
          `✨ 𝙀𝙂𝙊 𝙎𝙮𝙣𝙘 𝘾𝙤𝙢𝙥𝙡𝙚𝙩𝙚\n` +
          `╭─‣ 𝙉𝙚𝙬 𝙐𝙥𝙡𝙤𝙖𝙙𝙨 : ${r.uploaded}\n` +
          `├‣ 𝙐𝙥𝙙𝙖𝙩𝙚𝙙 : ${r.updated}\n` +
          `├‣ 𝘼𝙡𝙧𝙚𝙖𝙙𝙮 𝙎𝙮𝙣𝙘𝙚𝙙 : ${r.duplicates}\n` +
          `├‣ 𝙐𝙣𝙘𝙝𝙖𝙣𝙜𝙚𝙙 : ${r.unchanged}\n` +
          `├‣ 𝙀𝙧𝙧𝙤𝙧𝙨 : ${r.errors}\n` +
          `╰──────────────◊`,
          threadID
        );
      } catch (err) {
        api.sendMessage(`🚫 𝙎𝙮𝙣𝙘 𝙛𝙖𝙞𝙡𝙚𝙙: ${err.message}`, threadID);
      }
      return;
    }

    if (sub === "list" || sub === "ls") {
      const maybeCategory = args[1]?.toLowerCase();
      const isCategory    = CONFIG.CATEGORIES.includes(maybeCategory);
      const category      = isCategory ? maybeCategory : "";
      const page          = Math.max(1, Number(isCategory ? args[2] : args[1]) || 1);
      return sendListPage(api, threadID, senderID, category, page, 8, prefix);
    }

    if (sub === "event") {
      const action = args[1]?.toLowerCase();
      if (action === "install") {
        const id = args[2];
        if (!id) return api.sendMessage(`🚫 Usage: ${prefix}gs event install <id>`, threadID);
        return doInstall(api, threadID, id, "event");
      }
      const q = args.slice(1).join(" ");
      return sendSearchPage(api, threadID, senderID, q, "", 1, 5, prefix, "event");
    }

    if (sub === "install") {
      const id = args[1];
      if (!id) return api.sendMessage(`🚫 Usage: ${prefix}gs install <id>`, threadID);
      return doInstall(api, threadID, id, null);
    }

    if (sub === "like") {
      const rawId = args[1];
      if (!rawId) return api.sendMessage(`🚫 Usage: ${prefix}gs like <id>`, threadID);
      const id = rawId.replace(/^#/, "");
      try {
        const res = await apiLike(id, getVisitorId());
        if (res.liked)
          return api.sendMessage(`🔥 𝙇𝙞𝙠𝙚𝙙 𝙎𝙪𝙘𝙘𝙚𝙨𝙨𝙛𝙪𝙡𝙡𝙮! 𝙏𝙤𝙩𝙖𝙡: ${res.likes}`, threadID);
        else
          return api.sendMessage(`💔 𝙐𝙣𝙡𝙞𝙠𝙚𝙙. 𝙏𝙤𝙩𝙖𝙡: ${res.likes}`, threadID);
      } catch (_) { return api.sendMessage("🚫 𝙇𝙞𝙠𝙚 𝘼𝙋𝙄 𝙀𝙧𝙧𝙤𝙧.", threadID); }
    }

    if (sub === "trend" || sub === "trending") {
      try {
        const list = await apiTrending(8);
        if (!list.length) return api.sendMessage("🚫 𝙉𝙤 𝙩𝙧𝙚𝙣𝙙𝙞𝙣𝙜 𝙞𝙩𝙚𝙢𝙨 𝙮𝙚𝙩.", threadID);
        let msg = `🔥 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀 — 𝙏𝙊𝙋 𝙏𝙍𝙀𝙉𝘿𝙄𝙉𝙂 🔥\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        list.forEach((cmd, i) => {
          msg +=
            `╭─‣ ${cmd.name}${i === 0 ? " 🏆" : ""}\n` +
            `├‣ 𝘾𝙖𝙩𝙚𝙜𝙤𝙧𝙮 : ${catBadge(cmd)}\n` +
            `├‣ 𝙇𝙞𝙠𝙚𝙨 : 🔥 ${cmd.likes || 0}\n` +
            `├‣ 𝘼𝙪𝙩𝙝𝙤𝙧 : ${cmd.author || "Unknown"}\n` +
            `├‣ 𝙄𝘿 : ${displayId(cmd)}\n` +
            `╰──────────────◊\n\n`;
        });
        return api.sendMessage(msg.trim(), threadID);
      } catch (_) { return api.sendMessage("🚫 𝙏𝙧𝙚𝙣𝙙𝙞𝙣𝙜 𝘼𝙋𝙄 𝙀𝙧𝙧𝙤𝙧.", threadID); }
    }

    if (sub === "upload" || sub === "update") {
      const isEvent = args[1]?.toLowerCase() === "event";
      const fileName = isEvent ? args[2] : args[1];
      const kind     = isEvent ? "event" : "command";
      if (!fileName)
        return api.sendMessage(
          `📁 𝙐𝙨𝙖𝙜𝙚:\n• ${prefix}gs ${sub} <fileName>\n• ${prefix}gs ${sub} event <fileName>`,
          threadID
        );

      const cwd = process.cwd();
      const stdCmds   = path.join(cwd, "scripts", "cmds");
      const stdEvents = path.join(cwd, "scripts", "events");
      const dirs = kind === "event"
        ? [getEventsDir(), stdEvents, path.join(cwd, "events")]
        : [getCmdsDir(), stdCmds, getEventsDir(), stdEvents, cwd];
      let filePath = null;
      for (const dir of dirs) {
        if (fs.existsSync(path.join(dir, fileName)))           { filePath = path.join(dir, fileName); break; }
        if (fs.existsSync(path.join(dir, fileName + ".js")))   { filePath = path.join(dir, fileName + ".js"); break; }
      }
      if (!filePath) return api.sendMessage(`🚫 𝙐𝙣𝙖𝙗𝙡𝙚 𝙩𝙤 𝙛𝙞𝙣𝙙 𝙛𝙞𝙡𝙚: "${fileName}"`, threadID);
      return doUpload(api, threadID, filePath, kind);
    }

    if (sub === "rawlink" || sub === "raw") {
      const id = args[1];
      if (!id) return api.sendMessage(`🚫 Usage: ${prefix}gs rawlink <id>`, threadID);

      const loadMsg = await api.sendMessage(`⏳ 𝙁𝙚𝙩𝙘𝙝𝙞𝙣𝙜 𝙧𝙖𝙬 𝙡𝙞𝙣𝙠 𝙛𝙤𝙧 𝙄𝘿: ${id}...`, threadID);

      try {
        const cmd = await apiGetOne(id);
        if (!cmd) {
          api.unsendMessage(loadMsg.messageID).catch(() => {});
          return api.sendMessage(`🚫 𝙄𝙩𝙚𝙢 𝙣𝙤𝙩 𝙛𝙤𝙪𝙣𝙙 𝙛𝙤𝙧 𝙄𝘿: ${id}`, threadID);
        }

        if (cmd.pastebin_url) {
          api.unsendMessage(loadMsg.messageID).catch(() => {});
          return api.sendMessage(
            `🔗 𝙍𝙖𝙬 𝙇𝙞𝙣𝙠 — ${cmd.name}\n` +
            `╭─‣ 𝙋𝙖𝙨𝙩𝙚𝙗𝙞𝙣 : ${cmd.pastebin_url}\n` +
            `╰──────────────◊`,
            threadID
          );
        }

        if (!cmd.code) {
          api.unsendMessage(loadMsg.messageID).catch(() => {});
          return api.sendMessage("🚫 𝙉𝙤 𝙘𝙤𝙙𝙚 𝙨𝙩𝙤𝙧𝙚𝙙.", threadID);
        }

        const rawUrl = await getRawLink(cmd);
        if (!rawUrl) {
          api.unsendMessage(loadMsg.messageID).catch(() => {});
          return api.sendMessage(`🚫 𝘾𝙤𝙪𝙡𝙙 𝙣𝙤𝙩 𝙜𝙚𝙣𝙚𝙧𝙖𝙩𝙚 𝙧𝙖𝙬 𝙡𝙞𝙣𝙠.`, threadID);
        }

        api.unsendMessage(loadMsg.messageID).catch(() => {});
        return api.sendMessage(
          `✨ 𝙍𝙖𝙬 𝙇𝙞𝙣𝙠 𝙂𝙚𝙣𝙚𝙧𝙖𝙩𝙚𝙙!\n` +
          `╭─‣ 𝙉𝙖𝙢𝙚 : ${cmd.name}\n` +
          `├‣ 𝘼𝙪𝙩𝙝𝙤𝙧 : ${cmd.author || "Unknown"}\n` +
          `├‣ 𝙋𝙖𝙨𝙩𝙚𝙗𝙞𝙣 : ${rawUrl}\n` +
          `╰──────────────◊`,
          threadID
        );
      } catch (err) {
        api.unsendMessage(loadMsg.messageID).catch(() => {});
        return api.sendMessage(`🚫 Error: ${err.message}`, threadID);
      }
    }

    if (sub === "delete") {
      const rawId = args[1];
      if (!rawId) return api.sendMessage(`🚫 Usage: ${prefix}gs delete <id>`, threadID);
      const id = rawId.replace(/^#/, "");
      try {
        await apiDelete(id);
        return api.sendMessage(`🗑️ 𝘿𝙚𝙡𝙚𝙩𝙚𝙙 𝙎𝙪𝙘𝙘𝙚𝙨𝙨𝙛𝙪𝙡𝙡𝙮! 𝙄𝘿: ${rawId}`, threadID);
      } catch (err) {
        const e = err.response?.data?.error || err.message;
        return api.sendMessage(`🚫 𝘿𝙚𝙡𝙚𝙩𝙚 𝙛𝙖𝙞𝙡𝙚𝙙: ${e}`, threadID);
      }
    }

    if (sub === "author") {
      const authorName = args.slice(1).join(" ");
      if (!authorName) return api.sendMessage(`🚫 Usage: ${prefix}gs author <name>`, threadID);
      return sendSearchPage(api, threadID, senderID, "", "", 1, 5, prefix, "", authorName);
    }

    if (sub === "search" || sub === "find") {
      const q = args.slice(1).join(" ").trim();
      if (!q) return api.sendMessage(`🚫 Usage: ${prefix}gs search <query>`, threadID);
      return sendSearchPage(api, threadID, senderID, q, "", 1, 5, prefix);
    }

    if (sub === "cat" || sub === "category") {
      const cat = args[1]?.toLowerCase();
      if (!CONFIG.CATEGORIES.includes(cat))
        return api.sendMessage(
          `🚫 Usage: ${prefix}gs cat <${CONFIG.CATEGORIES.join("|")}>`,
          threadID
        );
      return sendListPage(api, threadID, senderID, cat, 1, 8, prefix);
    }

    if (sub === "events" || sub === "event") {
      const list = await apiSearch("", "", 0, "event").catch(() => []);
      if (!list.length) return api.sendMessage("🚫 𝙉𝙤 𝙚𝙫𝙚𝙣𝙩𝙨 𝙛𝙤𝙪𝙣𝙙.", threadID);
      let msg = `⚡ 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀 — 𝙀𝙫𝙚𝙣𝙩𝙨 (${list.length})\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      list.slice(0, 10).forEach(cmd => { msg += renderCmdRow(cmd); });
      return api.sendMessage(msg.trim(), threadID);
    }

    if (sub === "commands") {
      const list = await apiSearch("", "", 0, "command").catch(() => []);
      if (!list.length) return api.sendMessage("🚫 𝙉𝙤 𝙘𝙤𝙢𝙢𝙖𝙣𝙙𝙨 𝙛𝙤𝙪𝙣𝙙.", threadID);
      let msg = `☠️ 𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀 — 𝘾𝙤𝙢𝙢𝙖𝙣𝙙𝙨 (${list.length})\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      list.slice(0, 10).forEach(cmd => { msg += renderCmdRow(cmd); });
      return api.sendMessage(msg.trim(), threadID);
    }

    const query = args.join(" ").trim();
    const looksLikeId = /^[a-f\d]{24}$/i.test(query) || /^#?\d+$/.test(query);
    if (looksLikeId) {
      try {
        const cmd = await apiGetOne(query.replace(/^#/, ""));
        if (!cmd) return api.sendMessage(`🚫 𝙉𝙤𝙩 𝙛𝙤𝙪𝙣𝙙 𝙛𝙤𝙧 𝙄𝘿: ${query}`, threadID);

        let rawLine;
        if (cmd.pastebin_url) {
          rawLine = `🔗 𝙍𝙖𝙬: ${cmd.pastebin_url}`;
        } else if (cmd.code) {
          const rawUrl = await getRawLink(cmd);
          rawLine = rawUrl ? `🔗 𝙍𝙖𝙬: ${rawUrl}` : `⚠️ 𝙍𝙖𝙬 𝙡𝙞𝙣𝙠 𝙪𝙣𝙖𝙫𝙖𝙞𝙡𝙖𝙗𝙡𝙚`;
        } else {
          rawLine = `⚠️ 𝙉𝙤 𝙘𝙤𝙙𝙚 𝙨𝙩𝙤𝙧𝙚𝙙.`;
        }

        const msg =
          `👑 **𝙀𝙂𝙊 𝙂𝙊𝘼𝙏𝙎𝙏𝙊𝙍𝙀 𝙄𝙏𝙀𝙈 𝙄𝙉𝙁𝙊**\n` +
          `╭─‣ 𝙉𝙖𝙢𝙚 : ${cmd.name}\n` +
          `├‣ 𝙏𝙮𝙥𝙚 : ${cmd.kind === "event" ? "⚡ Event" : "☠️ Command"}\n` +
          `├‣ 𝘼𝙪𝙩𝙝𝙤𝙧 : ${cmd.author || "Unknown"}\n` +
          `├‣ 𝘾𝙖𝙩𝙚𝙜𝙤𝙧𝙮 : ${catBadge(cmd)}\n` +
          `├‣ 𝙇𝙞𝙠𝙚𝙨 : 🔥 ${cmd.likes || 0}\n` +
          `├‣ 𝙄𝘿 : ${displayId(cmd)}\n` +
          `╰──────────────◊\n` +
          `📝 ${cmd.description || "No description"}\n` +
          `📅 𝘼𝙙𝙙𝙚𝙙: ${new Date(cmd.createdAt || Date.now()).toDateString()}\n` +
          rawLine;
        return api.sendMessage(msg.trim(), threadID);
      } catch (err) {
        return api.sendMessage(
          `🚫 𝙁𝙚𝙩𝙘𝙝 𝙀𝙧𝙧𝙤𝙧.\n╭─‣ 𝙄𝘿 : ${query}\n├‣ 𝙍𝙚𝙖𝙨𝙤𝙣 : ${err.message}\n╰──────────────◊`,
          threadID
        );
      }
    }

    return sendSearchPage(api, threadID, senderID, query, "", 1, 5, prefix);
  },
};
