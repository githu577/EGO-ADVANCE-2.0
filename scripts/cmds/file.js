"use strict";

const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "file",
    aliases: ["files"],
    version: "3.1.0",
    author: "EGO",
    countDown: 5,
    role: 0,
    shortDescription: "Send bot script",
    longDescription: "Owner only file sender",
    category: "OWNER",
    guide: "{pn} filename"
  },

  onStart: async function ({ message, args, api, event }) {

    // ONLY OWNER UID
    const ownerUID = "100062655705183";

    if (event.senderID !== ownerUID) {
      return api.sendMessage(
        "🌚 𝙁𝙞𝙡𝙚 𝙘𝙝𝙖𝙞𝙮𝙖 𝙡𝙤𝙟𝙟𝙖 𝙙𝙞𝙗𝙚𝙣 𝙣𝙖! 🙏",
        event.threadID,
        event.messageID
      );
    }

    const fileName = args[0];

    if (!fileName) {
      return api.sendMessage(
        "⚠️ 𝙁𝙞𝙡𝙚 𝙉𝙖𝙢𝙚 𝙋𝙧𝙤𝙫𝙞𝙙𝙚 𝙆𝙤𝙧𝙪𝙣\n\nExample: .file edit",
        event.threadID,
        event.messageID
      );
    }

    if (
      fileName.includes("/") ||
      fileName.includes("\\") ||
      fileName.includes("..")
    ) {
      return api.sendMessage(
        "❌ Invalid file name!",
        event.threadID,
        event.messageID
      );
    }

    const filePath = path.join(__dirname, `${fileName}.js`);

    if (!fs.existsSync(filePath)) {
      return api.sendMessage(
        `❌ 𝙁𝙞𝙡𝙚 𝙉𝙤𝙩 𝙁𝙤𝙪𝙣𝙙\n\n📂 ${fileName}.js`,
        event.threadID,
        event.messageID
      );
    }

    const stages = [
      "▰▰▱▱▱▱▱▱▱▱ 20%",
      "▰▰▰▰▱▱▱▱▱▱ 40%",
      "▰▰▰▰▰▰▱▱▱▱ 60%",
      "▰▰▰▰▰▰▰▰▱▱ 80%",
      "▰▰▰▰▰▰▰▰▰▰ 100%"
    ];

    const delay = ms =>
      new Promise(resolve => setTimeout(resolve, ms));

    let loadingID;

    try {

      const loading = await new Promise((resolve, reject) => {

        api.sendMessage(
          "⚡ 𝙀𝙂𝙊 𝙁𝙄𝙇𝙀 𝙇𝙊𝘼𝘿𝙄𝙉𝙂\n\n" +
          "📂 𝙁𝙞𝙡𝙚: " + fileName + ".js\n\n" +
          "▰▱▱▱▱▱▱▱▱▱ 0%",
          event.threadID,
          (err, info) => {
            if (err) return reject(err);
            if (!info || !info.messageID) {
              return reject(new Error("Loading failed"));
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
            "⚡ 𝙀𝙂𝙊 𝙁𝙄𝙇𝙀 𝙇𝙊𝘼𝘿𝙄𝙉𝙂\n\n" +
            "📂 𝙁𝙞𝙡𝙚: " + fileName + ".js\n\n" +
            stage,
            loadingID,
            err => {
              if (err) return reject(err);
              resolve();
            }
          );

        });

      }

      const fileContent = fs.readFileSync(filePath, "utf8");

      await new Promise(resolve => {
        api.unsendMessage(loadingID, () => resolve());
      });

      api.sendMessage(
        {
          body:
            "⚡ 𝙀𝙂𝙊 𝙁𝙄𝙇𝙀 𝙍𝙀𝘼𝘿𝙔\n\n" +
            "📂 𝙁𝙞𝙡𝙚: " + fileName + ".js\n" +
            "📄 𝙎𝙞𝙯𝙚: " +
            Buffer.byteLength(fileContent, "utf8") +
            " bytes\n\n" +
            fileContent
        },
        event.threadID
      );

    } catch (error) {

      console.error("[EGO FILE ERROR]", error);

      if (loadingID) {
        try {
          api.unsendMessage(loadingID);
        } catch (_) {}
      }

      api.sendMessage(
        "❌ 𝙀𝙂𝙊 𝙁𝙄𝙇𝙀 𝙀𝙍𝙍𝙊𝙍\n\n" +
        (error.message || "Unknown error"),
        event.threadID,
        event.messageID
      );

    }
  }
};
