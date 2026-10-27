const axios = require("axios");
const yts = require("yt-search");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");

const CACHE_DIR = path.join(__dirname, "cache");
const SONG_API_BASE = "https://eryxenx.agi.bd/api/song";

const BARS = [
  "▰▰▱▱▱▱▱▱▱▱ 20%",
  "▰▰▰▰▱▱▱▱▱▱ 40%",
  "▰▰▰▰▰▰▱▱▱▱ 60%",
  "▰▰▰▰▰▰▰▰▱▱ 80%",
  "▰▰▰▰▰▰▰▰▰▰ 100%"
];

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports.config = {
  name: "sing",
  aliases: ["song"],
  version: "3.1.0",
  author: "EGO",
  countDown: 5,
  role: 0,
  shortDescription: "EGO Music",
  longDescription: "Search and download songs",
  category: "media",
  guide: "{pn} <song name>"
};

async function fetchSongInfo(videoUrl) {
  const response = await axios.get(SONG_API_BASE, {
    params: { url: videoUrl },
    timeout: 60000
  });

  const data = response.data;

  if (!data?.success || !data?.downloadUrl) {
    throw new Error(
      data?.error || data?.message || "Song API did not return a download URL"
    );
  }

  return data;
}

async function downloadSong(url, filePath) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const response = await axios.get(url, {
    responseType: "stream",
    timeout: 300000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const type = String(response.headers["content-type"] || "").toLowerCase();

  if (
    type.includes("text/html") ||
    type.includes("application/json")
  ) {
    let body = "";
    for await (const chunk of response.data) {
      body += chunk.toString();
      if (body.length > 1000) break;
    }
    throw new Error("Download URL returned an error page: " + body.slice(0, 250));
  }

  await pipeline(response.data, fs.createWriteStream(filePath));

  const stats = fs.statSync(filePath);

  if (stats.size < 1024) {
    throw new Error("Downloaded audio is empty or incomplete");
  }
}

function tempFilePath() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
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

function getError(err) {
  const data = err.response?.data;

  if (data && typeof data === "object") {
    return data.error || data.message || err.message;
  }

  return err.message || String(err);
}

module.exports.onStart = async function ({
  api,
  event,
  args,
  message
}) {
  const query = args.join(" ").trim();

  if (!query) {
    return message.reply("Song name dao. Example: sing Mann Mera");
  }

  let loadingID = null;
  let file = null;
  let sentAudio = false;

  async function showLoading(index) {
    const text = "EGO MUSIC\n" + BARS[index];

    if (!loadingID) {
      const result = await message.reply(text);
      loadingID = result?.messageID;
      return;
    }

    if (typeof api.editMessage === "function") {
      await new Promise((resolve, reject) => {
        api.editMessage(text, loadingID, err => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  async function removeLoading() {
    if (!loadingID) return;

    try {
      await new Promise(resolve => {
        api.unsendMessage(loadingID, () => resolve());
      });
    } catch (_) {}
  }

  try {
    react(api, event.messageID, "⏳");

    await showLoading(0);

    const search = await yts(query);
    const video = search.videos?.[0];

    if (!video) {
      throw new Error("No YouTube result found for: " + query);
    }

    await showLoading(1);

    const info = await fetchSongInfo(video.url);

    await showLoading(2);

    file = tempFilePath();
    await downloadSong(info.downloadUrl, file);

    await showLoading(3);
    await wait(400);
    await showLoading(4);

    await removeLoading();

    await new Promise((resolve, reject) => {
      api.sendMessage(
        {
          body:
            "🎵 " + (info.title || video.title) +
            "\n🕒 " + (video.timestamp || "Unknown") +
            "\n\nEGO MUSIC",
          attachment: fs.createReadStream(file)
        },
        event.threadID,
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    });

    sentAudio = true;
    react(api, event.messageID, "✅");
  } catch (err) {
    console.error("[EGO MUSIC]", err);

    await removeLoading();
    react(api, event.messageID, "❌");

    return message.reply("EGO MUSIC ERROR: " + getError(err));
  } finally {
    await removeLoading();

    if (file) {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch (_) {}
    }
  }
};
