
"use strict";

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const API_CONFIG_URL =
  "https://raw.githubusercontent.com/aura-mahmud/HINATA/main/baseApiUrl.json";

const API_TIMEOUT = 180000;

const getBaseApiUrl = async () => {
  const response = await axios.get(API_CONFIG_URL, {
    timeout: 15000
  });

  const apiUrl = response.data?.mahmud;

  if (!apiUrl || typeof apiUrl !== "string") {
    throw new Error("API URL পাওয়া যায়নি");
  }

  return apiUrl.replace(/\/+$/, "");
};

const getImageUrl = (attachment) => {
  if (!attachment || attachment.type !== "photo") {
    return null;
  }

  return attachment.url || null;
};

const getErrorMessage = (error) => {
  if (error.response?.data) {
    const data = error.response.data;

    if (Buffer.isBuffer(data)) {
      return data.toString("utf8").slice(0, 500);
    }

    if (typeof data === "string") {
      return data.slice(0, 500);
    }

    return JSON.stringify(data).slice(0, 500);
  }

  return error.message || "Unknown error";
};

module.exports = {
  config: {
    name: "edit",
    aliases: ["imgedit", "aiedit"],
    version: "3.0.0",
    author: "EGO",
    countDown: 10,
    role: 0,

    description: {
      bn: "Premium AI Image Editing",
      en: "Premium AI Image Editing",
      vi: "Chỉnh sửa ảnh AI Premium"
    },

    category: "image",

    guide: {
      bn:
        "{pn} <prompt>\n" +
        "ছবিতে Reply দিয়ে বাংলা বা English prompt লিখুন\n\n" +
        "Example:\n" +
        "{pn} ছবিটা cinematic 4K করে দাও\n" +
        "{pn} Add RGB neon lighting",

      en:
        "{pn} <prompt>\n" +
        "Reply to an image with Bengali or English instructions\n\n" +
        "Example:\n" +
        "{pn} Make this image cinematic 4K\n" +
        "{pn} Add RGB neon lighting",

      vi:
        "{pn} <prompt>\n" +
        "Reply to an image with editing instructions"
    }
  },

  langs: {
    bn: {
      noInput:
        "⚠️ | একটি ছবিতে Reply দিয়ে বাংলা অথবা English prompt লিখুন!",

      wait:
        "╭━━━〔 ⚡ EGO AI EDIT 〕━━━╮\n" +
        "┃\n" +
        "┃ 🖼️ Image Processing...\n" +
        "┃ ✨ Premium AI Editing\n" +
        "┃ 🔄 Please Wait...\n" +
        "┃\n" +
        "╰━━━━━━━━━━━━━━━━━━━━╯",

      success:
        "╭━━━〔 👑 EGO AI EDIT 〕━━━╮\n" +
        "┃\n" +
        "┃ ✅ Premium Editing Complete\n" +
        "┃\n" +
        "┃ 📝 Prompt: %1\n" +
        "┃\n" +
        "╰━━━━━━━━━━━━━━━━━━━━╯",

      error:
        "╭━━━〔 ❌ EGO AI EDIT 〕━━━╮\n" +
        "┃\n" +
        "┃ Editing Failed!\n" +
        "┃ Error: %1\n" +
        "┃\n" +
        "╰━━━━━━━━━━━━━━━━━━━━╯"
    },

    en: {
      noInput:
        "⚠️ | Reply to an image with a Bengali or English prompt!",

      wait:
        "╭━━━〔 ⚡ EGO AI EDIT 〕━━━╮\n" +
        "┃\n" +
        "┃ 🖼️ Image Processing...\n" +
        "┃ ✨ Premium AI Editing\n" +
        "┃ 🔄 Please Wait...\n" +
        "┃\n" +
        "╰━━━━━━━━━━━━━━━━━━━━╯",

      success:
        "╭━━━〔 👑 EGO AI EDIT 〕━━━╮\n" +
        "┃\n" +
        "┃ ✅ Premium Editing Complete\n" +
        "┃\n" +
        "┃ 📝 Prompt: %1\n" +
        "┃\n" +
        "╰━━━━━━━━━━━━━━━━━━━━╯",

      error:
        "╭━━━〔 ❌ EGO AI EDIT 〕━━━╮\n" +
        "┃\n" +
        "┃ Editing Failed!\n" +
        "┃ Error: %1\n" +
        "┃\n" +
        "╰━━━━━━━━━━━━━━━━━━━━╯"
    },

    vi: {
      noInput:
        "Reply to an image with a Bengali or English prompt!",

      wait:
        "⚡ EGO AI EDIT\n" +
        "🖼️ Image Processing...\n" +
        "✨ Premium AI Editing\n" +
        "🔄 Please Wait...",

      success:
        "✅ Premium Editing Complete\n" +
        "Prompt: %1",

      error:
        "❌ Editing Failed: %1"
    }
  },

  onStart: async function ({
    api,
    event,
    args,
    message,
    getLang
  }) {
    const prompt = args.join(" ").trim();

    const repliedImage = getImageUrl(
      event.messageReply?.attachments?.[0]
    );

    if (!prompt || !repliedImage) {
      return message.reply(getLang("noInput"));
    }

    const cacheDir = path.join(__dirname, "cache");

    const imgPath = path.join(
      cacheDir,
      `ego_edit_${Date.now()}.jpg`
    );

    let waitMsg;

    try {
      await fs.ensureDir(cacheDir);

      waitMsg = await message.reply(
        getLang("wait")
      );

      const baseUrl = await getBaseApiUrl();

      const response = await axios.post(
        `${baseUrl}/api/edit`,
        {
          prompt: prompt,
          imageUrl: repliedImage
        },
        {
          responseType: "arraybuffer",
          timeout: API_TIMEOUT,

          headers: {
            "Content-Type": "application/json",
            "Accept": "image/jpeg, image/png, image/webp"
          },

          maxContentLength: 30 * 1024 * 1024,
          maxBodyLength: 30 * 1024 * 1024
        }
      );

      const contentType =
        response.headers?.["content-type"] || "";

      if (
        !contentType.startsWith("image/") &&
        !Buffer.isBuffer(response.data)
      ) {
        throw new Error("API did not return an image");
      }

      const imageBuffer = Buffer.from(response.data);

      if (!imageBuffer.length) {
        throw new Error("Generated image is empty");
      }

      await fs.writeFile(
        imgPath,
        imageBuffer
      );

      await message.reply({
        body: getLang("success", prompt),
        attachment: fs.createReadStream(imgPath)
      });

    } catch (error) {
      console.error(
        "[EGO AI EDIT ERROR]",
        error
      );

      return message.reply(
        getLang("error", getErrorMessage(error))
      );

    } finally {
      if (waitMsg?.messageID) {
        try {
          await api.unsendMessage(
            waitMsg.messageID
          );
        } catch (_) {}
      }

      setTimeout(async () => {
        try {
          if (await fs.pathExists(imgPath)) {
            await fs.unlink(imgPath);
          }
        } catch (_) {}
      }, 15000);
    }
  }
};
