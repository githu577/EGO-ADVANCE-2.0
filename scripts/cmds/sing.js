const axios = require("axios");
const yts = require("yt-search");
const fs = require("fs");
const path = require("path");

const CACHE_DIR = path.join(__dirname, "cache");
const SONG_API_BASE = "https://eryxenx.agi.bd/api/song";

const LOADING = [
  "▰▰▱▱▱▱▱▱▱▱ 20%",
  "▰▰▰▰▱▱▱▱▱▱ 40%",
  "▰▰▰▰▰▰▱▱▱▱ 60%",
  "▰▰▰▰▰▰▰▰▱▱ 80%",
  "▰▰▰▰▰▰▰▰▰▰ 100%"
];

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchSongInfo(videoUrl) {
  const res = await axios.get(SONG_API_BASE, {
    params: { url: videoUrl },
    timeout: 60000
  });

  if (!res.data?.success || !res.data?.downloadUrl) {
    throw new Error(res.data?.error || "API downloadUrl paoa jayni");
  }

  return res.data;
}

async function streamDownloadToFile(url, filePath) {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  const response = await axios.get(url, {
    responseType: "stream",
    timeout: 300000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const type = response.headers["content-type"] || "";
  if (
    !type.includes("video") &&
    !type.includes("audio") &&
    !type.includes("octet-stream")
  ) {
    response.data.destroy();
    throw new Error("Invalid download response: " + type);
  }

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
    response.data.on("error", reject);
  });

  const stats = fs.statSync(filePath);
  if (stats.size < 1024) {
    throw new Error("Downloaded audio file is too small");
  }
}

function extractError(err) {
  const data = err.response?.data;

  if (data && typeof data === "object") {
    return data.error || data.message || err.message;
  }

  return err.message || String(err);
}

function tempFilePath() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  return path.join(
    CACHE_DIR,
    `ego_music_${Date.now()}_${Math.floor(Math.random() * 10000)}.mp3`
  );
}

function react(api, messageID, emoji) {
  try {
    api.setMessageReaction(emoji, messageID, () => {}, true);
  } catch (_) {}
}

module.exports.config = {
  name: "sing",
  aliases: ["song"],
  version: "3.0.0",
  author: "EGO",
  countDown: 5,
  role: 0,
  shortDescription: "EGO Music Downloader",
  longDescription: "Search and download songs with EGO MUSIC loading animation",
  category: "media",
  guide: "{pn} <song name>\nExample: {pn} mann mera"
};

module.exports.onStart = async function ({
  api,
  event,
  args,
  message
}) {
  const query = args.join(" ").trim();

  if (!query) {
    return message.reply(
      "🎵 EGO MUSIC\n\n❌ Song name dao.\nExample: sing mann mera"
    );
  }

  let loadingID = null;
  let file = null;
  let downloadUrl = null;

  const updateLoading = async (percentText, status) => {
    const text =
      "╭━━━〔 🎵 𝙀𝙂𝙊 𝙈𝙐𝙎𝙄𝘾 〕━━━╮\n" +
      "🎧 Now Playing: " + query + "\n\n" +
      percentText + "\n" +
      "⚡ " + status + "\n" +
      "╰━━━━━━ CREATE BY EGO ━━━━━━╯";

    if (!loadingID) {
      const info = await message.reply(text);
      loadingID = info?.messageID;
      return;
    }

    if (typeof api.editMessage === "function") {
      await new Promise((resolve, reject) => {
        api.editMessage(text, loadingID, err =>
          err ? reject(err) : resolve()
        );
      });
    }
  };

  const removeLoading = async () => {
    if (!loadingID) return;

    try {
      await new Promise(resolve =>
        api.unsendMessage(loadingID, () => resolve())
      );
    } catch (_) {}
  };

  try {
    react(api, event.messageID, "⏳");

    await updateLoading(LOADING[0], "Searching song...");

    const search = await yts(query);
    const video = search.videos?.[0];

    if (!video) {
      throw new Error("Ei song-er kono result paoa jayni");
    }

    await updateLoading(LOADING[1], "Song found: " + video.title);
    await wait(350);

    await updateLoading(LOADING[2], "Connecting to music API...");
    const info = await fetchSongInfo(video.url);
    downloadUrl = info.downloadUrl;
    await wait(350);

    await updateLoading(LOADING[3], "Downloading audio...");
    file = tempFilePath();
    await streamDownloadToFile(downloadUrl, file);

    await updateLoading(LOADING[4], "Download complete! Sending audio...");
    await wait(300);
    await removeLoading();

    await new Promise((resolve, reject) => {
      api.sendMessage(
        {
          body:
            "╭━━━〔 🎵 𝙀𝙂𝙊 𝙈𝙐𝙎𝙄𝘾 〕━━━╮\n" +
            "🎶 " + (info.title || video.title) + "\n" +
            "🕒 Duration: " + (video.timestamp || "Unknown") + "\n" +
            "📥 Download: Complete\n" +
            "✨ CREATE BY EGO\n" +
            "╰━━━━━━━━━━━━━━━━━━━━╯",
          attachment: fs.createReadStream(file)
        },
        event.threadID,
        err => err ? reject(err) : resolve()
      );
    });

    react(api, event.messageID, "✅");
  } catch (err) {
    console.error("[EGO MUSIC]", err);
    await removeLoading();
    react(api, event.messageID, "❌");

    return message.reply(
      "❌ EGO MUSIC FAILED\n\n" + extractError(err)
    );
  } finally {
    if (file) {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch (_) {}
    }
  }
};
