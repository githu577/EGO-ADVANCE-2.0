const { createCanvas } = require("canvas");
const fs = require("fs");
const os = require("os");
const path = require("path");

module.exports.config = {
  name: "up",
  aliases: ["uptime", "status", "sysinfo"],
  version: "13.0.0",
  author: "EGO",
  countDown: 5,
  role: 0,
  shortDescription: "EGO Premium Uptime Card",
  category: "system",
  guide: { en: "{p}up" }
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports.onStart = async function ({ api, event }) {
  const { threadID, messageID } = event;
  let loadingID = null;
  let imagePath = null;

  try {
    // Premium loading animation
    const loading = await api.sendMessage(
      "⚡ 𝙀𝙂𝙊 𝙎𝙔𝙎𝙏𝙀𝙈\n\n" +
      "▰▱▱▱▱▱▱▱▱▱ 10%\n" +
      "⏳ Preparing premium card...",
      threadID
    );

    loadingID = loading && loading.messageID;

    const steps = [
      "▰▰▱▱▱▱▱▱▱▱ 20%",
      "▰▰▰▰▱▱▱▱▱▱ 40%",
      "▰▰▰▰▰▰▱▱▱▱ 60%",
      "▰▰▰▰▰▰▰▰▱▱ 80%",
      "▰▰▰▰▰▰▰▰▰▰ 100%"
    ];

    for (const step of steps) {
      await sleep(350);

      if (loadingID) {
        try {
          await api.editMessage(
            `⚡ 𝙀𝙂𝙊 𝙎𝙔𝙎𝙏𝙀𝙈\n\n${step}\n⏳ Generating card...`,
            loadingID
          );
        } catch (_) {}
      }
    }

    imagePath = await generateCard();

    await api.sendMessage({
      body:
        "╭━━━〔 ⚡ EGO SYSTEM 〕━━━╮\n" +
        `┃ 🕒 Uptime: ${duration(os.uptime())}\n` +
        `┃ 💻 CPU Cores: ${(os.cpus() || []).length}\n` +
        `┃ 🧠 RAM: ${bytes(os.totalmem() - os.freemem())} / ${bytes(os.totalmem())}\n` +
        "┃ ✦ CREATE BY EGO\n" +
        "╰━━━━━━━━━━━━━━━━━━━━━━╯",
      attachment: fs.createReadStream(imagePath)
    }, threadID, messageID);

  } catch (error) {
    console.error("[EGO UP]", error);

    await api.sendMessage(
      "❌ EGO SYSTEM ERROR\n" + (error.message || "Unknown error"),
      threadID,
      messageID
    );

  } finally {
    if (loadingID) {
      try {
        await api.unsendMessage(loadingID);
      } catch (_) {}
    }

    if (imagePath) {
      setTimeout(() => {
        try {
          if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        } catch (_) {}
      }, 5000);
    }
  }
};

async function generateCard() {
  const W = 1000;
  const H = 900;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const C = {
    bg: "#050711",
    panel: "#0d1628",
    text: "#f4f8ff",
    muted: "#91a4c2",
    cyan: "#00ffd5",
    purple: "#bd5cff",
    yellow: "#ffe66d"
  };

  // Background
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(750, 180, 10, 750, 180, 600);
  glow.addColorStop(0, "rgba(0,255,213,0.20)");
  glow.addColorStop(1, "rgba(5,7,17,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const glow2 = ctx.createRadialGradient(100, 750, 5, 100, 750, 450);
  glow2.addColorStop(0, "rgba(189,92,255,0.16)");
  glow2.addColorStop(1, "rgba(5,7,17,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // Background grid
  ctx.strokeStyle = "rgba(0,255,213,0.05)";
  ctx.lineWidth = 1;

  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Neon border
  ctx.save();
  ctx.shadowColor = C.cyan;
  ctx.shadowBlur = 25;
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 3;
  roundRect(ctx, 25, 25, W - 50, H - 50, 30, false, true);
  ctx.restore();

  const cpus = os.cpus() || [];
  const totalRAM = os.totalmem();
  const freeRAM = os.freemem();
  const usedRAM = totalRAM - freeRAM;
  const ramPercent = totalRAM
    ? Math.round((usedRAM / totalRAM) * 100)
    : 0;

  // Header
  ctx.fillStyle = C.cyan;
  ctx.font = "bold 25px Arial";
  ctx.fillText("EGO // SYSTEM MONITOR", 65, 85);

  ctx.textAlign = "right";
  ctx.fillStyle = C.muted;
  ctx.font = "bold 17px Arial";
  ctx.fillText("PREMIUM EDITION", 935, 85);
  ctx.textAlign = "left";

  ctx.fillStyle = C.text;
  ctx.font = "bold 58px Arial";
  ctx.fillText("SYSTEM STATUS", 65, 165);

  ctx.fillStyle = C.muted;
  ctx.font = "22px Arial";
  ctx.fillText("LIVE PERFORMANCE DASHBOARD", 68, 205);

  ctx.fillStyle = C.cyan;
  ctx.fillRect(65, 230, 870, 2);

  // Uptime card
  panel(ctx, C, 65, 265, 420, 180, "SYSTEM UPTIME");

  ctx.fillStyle = C.cyan;
  ctx.font = "bold 38px Arial";
  ctx.fillText(duration(os.uptime()), 90, 350);

  ctx.fillStyle = C.muted;
  ctx.font = "19px Arial";
  ctx.fillText("Operating system running time", 90, 395);

  // RAM card
  panel(ctx, C, 515, 265, 420, 180, "MEMORY USAGE");

  ctx.fillStyle = C.text;
  ctx.font = "bold 32px Arial";
  ctx.fillText(`${ramPercent}%`, 545, 335);

  bar(ctx, C, 545, 360, 355, ramPercent);

  ctx.fillStyle = C.muted;
  ctx.font = "18px Arial";
  ctx.fillText(`${bytes(usedRAM)} used`, 545, 410);
  ctx.fillText(`${bytes(freeRAM)} free`, 735, 410);

  // CPU card
  panel(ctx, C, 65, 475, 870, 155, "PROCESSOR");

  ctx.fillStyle = C.text;
  ctx.font = "bold 24px Arial";
  textFit(ctx, cpus[0]?.model || "CPU information unavailable", 90, 545, 800);

  ctx.fillStyle = C.cyan;
  ctx.font = "22px Arial";
  ctx.fillText(`Logical cores: ${cpus.length}`, 90, 590);

  // Device information
  panel(ctx, C, 65, 660, 870, 135, "DEVICE INFORMATION");

  ctx.fillStyle = C.muted;
  ctx.font = "18px Arial";
  ctx.fillText("HOSTNAME", 90, 715);
  ctx.fillText("PLATFORM", 520, 715);
  ctx.fillText("NODE VERSION", 90, 760);
  ctx.fillText("ARCHITECTURE", 520, 760);

  ctx.fillStyle = C.text;
  ctx.font = "bold 19px Arial";
  textFit(ctx, os.hostname(), 205, 715, 270);
  textFit(ctx, `${os.type()} ${os.release()}`, 635, 715, 270);
  ctx.fillText(process.version, 245, 760);
  ctx.fillText(os.arch(), 680, 760);

  // Footer branding
  ctx.strokeStyle = "rgba(0,255,213,0.25)";
  ctx.beginPath();
  ctx.moveTo(65, 820);
  ctx.lineTo(935, 820);
  ctx.stroke();

  ctx.fillStyle = C.purple;
  ctx.font = "bold 28px Arial";
  ctx.fillText("CREATE BY EGO", 65, 860);

  ctx.textAlign = "right";
  ctx.fillStyle = C.cyan;
  ctx.font = "bold 18px Arial";
  ctx.fillText("● SYSTEM ONLINE", 935, 860);
  ctx.textAlign = "left";

  const cache = path.join(__dirname, "cache");
  if (!fs.existsSync(cache)) {
    fs.mkdirSync(cache, { recursive: true });
  }

  const file = path.join(cache, `ego_up_${Date.now()}.png`);
  fs.writeFileSync(file, canvas.toBuffer("image/png"));
  return file;
}

function panel(ctx, C, x, y, w, h, title) {
  ctx.fillStyle = C.panel;
  roundRect(ctx, x, y, w, h, 20, true, false);

  ctx.strokeStyle = "rgba(0,255,213,0.22)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 20, false, true);

  ctx.fillStyle = C.cyan;
  ctx.font = "bold 17px Arial";
  ctx.fillText(title, x + 25, y + 32);
}

function bar(ctx, C, x, y, w, percent) {
  ctx.fillStyle = "#1a2940";
  roundRect(ctx, x, y, w, 14, 7, true, false);

  const width = Math.max(0, Math.min(w, w * percent / 100));

  if (width > 0) {
    const gradient = ctx.createLinearGradient(x, y, x + w, y);
    gradient.addColorStop(0, C.cyan);
    gradient.addColorStop(1, C.purple);

    ctx.fillStyle = gradient;
    roundRect(ctx, x, y, width, 14, 7, true, false);
  }
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  const radius = Math.min(r, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(
    x + w, y + h, x + w - radius, y + h
  );
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function duration(seconds) {
  seconds = Math.floor(seconds || 0);

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${days}d ${hours}h ${mins}m ${secs}s`;
}

function bytes(n) {
  if (!Number.isFinite(n) || n < 0) return "N/A";
  if (n === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(n) / Math.log(1024)),
    units.length - 1
  );

  return `${(n / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function textFit(ctx, text, x, y, maxWidth) {
  let value = String(text);

  while (
    value.length > 3 &&
    ctx.measureText(value).width > maxWidth
  ) {
    value = value.slice(0, -1);
  }

  if (value !== String(text)) value += "...";
  ctx.fillText(value, x, y);
}
