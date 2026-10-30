const fs = require("fs");

module.exports = {
  config: {
    name: "file",
    aliases: ["files"],
    version: "1.0",
    author: "EGO",
    countDown: 5,
    role: 0,
    shortDescription: "Send bot script",
    longDescription: "Send bot specified file",
    category: "𝗢𝗪𝗡𝗘𝗥",
    guide: "{pn} filename"
  },

  onStart: async function ({ message, args, api, event }) {

    const permission = ["61595405874343"];

    if (!permission.includes(event.senderID)) {
      return api.sendMessage(
        "Fɪʟᴇ Cʜꫝʜɪꫝ Lᴏᴊᴊꫝ Dɪʙᴇɴ Nꫝ•••☻︎",
        event.threadID,
        event.messageID
      );
    }

    const fileName = args[0];

    if (!fileName) {
      return api.sendMessage(
        "Please provide a file name.",
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
        "Invalid file name.",
        event.threadID,
        event.messageID
      );
    }

    const filePath = __dirname + `/${fileName}.js`;

    if (!fs.existsSync(filePath)) {
      return api.sendMessage(
        `File not found: ${fileName}.js`,
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
          "▱▱▱▱▱▱▱▱▱▱ 0%",
          event.threadID,
          (err, info) => {
            if (err) return reject(err);
            if (!info) return reject(new Error("Loading failed"));
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
        { body: fileContent },
        event.threadID
      );

    } catch (error) {

      console.error(error);

      if (loadingID) {
        try {
          api.unsendMessage(loadingID);
        } catch (_) {}
      }

      api.sendMessage(
        "EGO FILE ERROR",
        event.threadID
      );
    }
  }
};
