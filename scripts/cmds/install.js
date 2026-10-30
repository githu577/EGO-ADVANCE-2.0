"use strict";

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const cheerio = require("cheerio");

const { configCommands } = global.GoatBot;
const { log } = global.utils;

function getDomain(url) {
  const regex = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n]+)/im;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function isURL(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

function extractUrlFromText(text) {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

async function fetchCodeFromUrl(url) {
  const domain = getDomain(url);
  let fixedUrl = url;

  if (domain === "pastebin.com" && !url.includes("/raw/")) {
    fixedUrl = url.replace("pastebin.com/", "pastebin.com/raw/");
  }

  if (domain === "github.com" && url.includes("/blob/")) {
    fixedUrl = url
      .replace("github.com", "raw.githubusercontent.com")
      .replace("/blob/", "/");
  }

  try {
    const res = await axios.get(fixedUrl);
    let code = res.data;

    if (domain === "savetext.net") {
      const $ = cheerio.load(code);
      code = $("#content").text().trim();
    }

    return typeof code === "string" ? code : null;
  } catch {
    return null;
  }
}

function extractCommandName(code) {
  const nameMatch = code.match(/name\s*:\s*["']([^"']+)["']/);
  return nameMatch ? nameMatch[1].trim() + ".js" : null;
}

// EGO LOADING SYSTEM
const stages = [
  "▰▰▱▱▱▱▱▱▱▱ 20%",
  "▰▰▰▰▱▱▱▱▱▱ 40%",
  "▰▰▰▰▰▰▱▱▱▱ 60%",
  "▰▰▰▰▰▰▰▰▱▱ 80%",
  "▰▰▰▰▰▰▰▰▰▰ 100%"
];

const delay = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

async function egoLoading(api, threadID, title) {
  let loadingID;

  try {
    const loading = await new Promise((resolve, reject) => {
      api.sendMessage(
        "⚡ 𝙀𝙂𝙊 𝙄𝙉𝙎𝙏𝘼𝙇𝙇 𝙇𝙊𝘼𝘿𝙄𝙉𝙂\n\n" +
        "📂 File: " + title + "\n\n" +
        "▰▱▱▱▱▱▱▱▱▱ 0%",
        threadID,
        (err, info) => {
          if (err) return reject(err);
          if (!info || !info.messageID) {
            return reject(new Error("Loading message failed"));
          }
          resolve(info);
        }
      );
    });

    loadingID = loading.messageID;

    for (const stage of stages) {
      await delay(800);

      await new Promise((resolve, reject) => {
        api.editMessage(
          "⚡ 𝙀𝙂𝙊 𝙄𝙉𝙎𝙏𝘼𝙇𝙇 𝙇𝙊𝘼𝘿𝙄𝙉𝙂\n\n" +
          "📂 File: " + title + "\n\n" +
          stage,
          loadingID,
          err => {
            if (err) return reject(err);
            resolve();
          }
        );
      });
    }

    return loadingID;

  } catch (error) {
    if (loadingID) {
      try {
        api.unsendMessage(loadingID);
      } catch (_) {}
    }
    throw error;
  }
}

async function removeLoading(api, threadID, loadingID) {
  if (!loadingID) return;

  await new Promise(resolve => {
    api.unsendMessage(loadingID, () => resolve());
  });
}

async function installCommand(rawCode, fileName, api, threadID) {
  let loadingID;

  try {
    loadingID = await egoLoading(api, threadID, fileName);

    const filePath = path.join(
      process.cwd(),
      "scripts",
      "cmds",
      fileName
    );

    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(filePath, rawCode);

    const load = global.utils.loadScripts(
      "cmds",
      fileName.replace(".js", ""),
      log,
      configCommands,
      api
    );

    await removeLoading(api, threadID, loadingID);

    if (load.status === "success") {
      api.sendMessage(
        "✅ 𝙀𝙂𝙊 𝙄𝙉𝙎𝙏𝘼𝙇𝙇 𝙎𝙐𝘾𝘾𝙀𝙎𝙎\n\n" +
        "📂 File: " + fileName + "\n" +
        "⚡ Status: Installed successfully",
        threadID
      );
    } else {
      api.sendMessage(
        "❌ 𝙄𝙉𝙎𝙏𝘼𝙇𝙇𝘼𝙏𝙄𝙊𝙉 𝙁𝘼𝙄𝙇𝙀𝘿\n\n" +
        "📂 File: " + fileName + "\n" +
        "Error: " + (load.error?.message || "Unknown error"),
        threadID
      );
    }

  } catch (error) {
    await removeLoading(api, threadID, loadingID).catch(() => {});

    api.sendMessage(
      "❌ EGO INSTALL ERROR\n\n" +
      (error.message || "Unknown error"),
      threadID
    );
  }
}

module.exports = {
  config: {
    name: "install",
    version: "4.0",
    author: "EGO",
    countDown: 3,
    role: 2,
    hasPrefix: false,
    description: "Install command via reply / code / url",
    category: "owner"
  },

  onStart: async function ({ args, message, event, api }) {
    let rawCode = "";
    let fileName = "";

    // Reply install
    if (event.messageReply?.body) {
      const replyText = event.messageReply.body.trim();
      const url = extractUrlFromText(replyText);

      if (url) {
        rawCode = await fetchCodeFromUrl(url);
        if (!rawCode) {
          return message.reply("❌ Could not fetch code from URL.");
        }
      } else {
        rawCode = replyText;
      }

      fileName = extractCommandName(rawCode);
    }

    // Install raw URL
    else if (args[0] && isURL(args[0])) {
      rawCode = await fetchCodeFromUrl(args[0]);

      if (!rawCode) {
        return message.reply("❌ Invalid or unreachable URL.");
      }

      fileName = extractCommandName(rawCode);
    }

    // Install filename.js code
    else if (args.length >= 2 && args[0].endsWith(".js")) {
      fileName = args[0];
      rawCode = args.slice(1).join(" ");
    }

    if (!rawCode) {
      return message.reply(
        "⚠ Provide code, reply to code, or give a raw URL."
      );
    }

    if (!fileName) {
      return message.reply("❌ Could not detect command name.");
    }

    if (
      path.basename(fileName) !== fileName ||
      !fileName.endsWith(".js") ||
      fileName === ".js"
    ) {
      return message.reply("❌ Invalid file name.");
    }

    const filePath = path.join(
      process.cwd(),
      "scripts",
      "cmds",
      fileName
    );

    // Overwrite protection
    if (fs.existsSync(filePath)) {
      return message.reply(
        `⚠ ${fileName} already exists.\nReact 👍 to overwrite.`,
        (err, info) => {
          if (err || !info) return;

          global.GoatBot.onReaction.set(info.messageID, {
            commandName: "install",
            author: event.senderID,
            data: { rawCode, fileName }
          });
        }
      );
    }

    await installCommand(
      rawCode,
      fileName,
      api,
      event.threadID
    );
  },

  onReaction: async function ({ Reaction, event, api }) {
    if (event.userID !== Reaction.author) return;

    const { rawCode, fileName } = Reaction.data;

    await installCommand(
      rawCode,
      fileName,
      api,
      event.threadID
    );
  }
};
