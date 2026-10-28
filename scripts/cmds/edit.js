const axios = require("axios");

module.exports = {
  config: {
    name: "edit2",
    aliases: ["e"],
    version: "0.0.7",
    author: "𝐌𝙴ʜ𝐄ᴅ𝐈",
    countDown: 25, // Updated to 25 seconds
    role: 0,
    shortDescription: "Edit image",
    longDescription: "Reply to any image",
    category: "image",
    guide: "{pn} [text]"
  },

  onStart: async function ({ api, event, args, message, usersData }) {
    const { senderID, messageReply } = event;

    /* ===== VIP & PERMISSION CHECK ===== */
    const ADMINS = global.GoatBot?.config?.adminBot || [];
    const isBotAdmin = ADMINS.includes(senderID);

    if (!isBotAdmin) {
      const userData = await usersData.get(senderID);
      const vip = userData?.data?.vip;

      if (!vip || !vip.expires || vip.expires < Date.now()) {
        return api.sendMessage("❌ 𝐕𝐈𝐏 𝐎𝐍𝐋𝐘 𝐂𝐎𝐌𝐌𝐀𝐍𝐃\n" +
          "• 𝐎𝐧𝐥𝐲 𝐕𝐈𝐏 𝐮𝐬𝐞𝐫𝐬 𝐜𝐚𝐧 𝐮𝐬𝐞 𝐞𝐝𝐢𝐭\n" +
          "• 𝐓𝐲𝐩𝐞: vip buy", event.threadID, event.messageID);
      }
    }

    const react = (emoji) => api.setMessageReaction(emoji, event.messageID, () => {}, true);

    try {
      const prompt = args.join(" ");

      if (!prompt) {
        react("⚠️");
        return api.sendMessage("⚠️ | Please provide text.", event.threadID);
      }

      const imageUrl = messageReply?.attachments[0]?.url;

      if (!imageUrl) {
        react("🖼️");
        return api.sendMessage("🖼️ | Please reply to an image.", event.threadID);
      }

      react("⏳");

      const apiUrl = `https://azadx69x.is-a.dev/api/editor?url=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`;

      const response = await axios.get(apiUrl, { responseType: "stream" });

      react("✅");

      api.sendMessage({
        body: `🖌 𝐈𝐦𝐚𝐠𝐞 𝐞𝐝𝐢𝐭𝐞𝐝 𝐬𝐮𝐜𝐜𝐞𝐬𝐬𝐟𝐮𝐥𝐥𝐲.\n𝐏𝐫𝐨𝐦𝐩𝐭: ${prompt}`,
        attachment: response.data
      }, event.threadID, messageReply?.messageID);

    } catch (error) {
      console.error(error);
      react("❌");
      api.sendMessage("❌ | Failed to process image.", event.threadID);
    }
  }
};
