const axios = require("axios");

const API = axios.create({
  baseURL: "https://eryxenx.agi.bd/api/simsimi",
  timeout: 20000
});

let botUID = null;
function getBotUID(api) {
  if (botUID) return botUID;
  try {
    if (typeof api.getCurrentUserID === "function") {
      botUID = api.getCurrentUserID();
    }
  } catch {}
  return botUID;
}

async function getUserName(api, uid, usersData) {
  try {
    if (usersData && typeof usersData.getName === "function") {
      const name = await usersData.getName(uid);
      if (name) return name;
    }
    const info = await api.getUserInfo(uid);
    return (info && info[uid] && info[uid].name) || "User";
  } catch {
    return "User";
  }
}

module.exports.config = {
  name: "autoteach",
  version: "1.0.0",
  role: 0,
  author: "EryXenX",
  countTime: 0,
  category: "chat",
  shortDescription: "Auto teach AI from group chat",
  longDescription: "Group e duijon kotha bolle pair toiri hoye AI-ke automatic teach kore. Kono setup lage na, bot group e thakleই always ON.",
  guide: "{pn} - autoteach status dekhte",
  envConfig: {}
};

module.exports.onStart = async function ({ api, event }) {
  try {
    const res = await API.get("/autoteach/stats");
    const { today = 0, total = 0 } = res.data || {};
    return api.sendMessage(
      `╭─╼🌟 𝗔𝘂𝘁𝗼𝘁𝗲𝗮𝗰𝗵 𝗦𝘁𝗮𝘁𝘂𝘀\n├ 🟢 𝗦𝘁𝗮𝘁𝘂𝘀: 𝗔𝗹𝘄𝗮𝘆𝘀 𝗢𝗡\n├ 📅 𝗧𝗼𝗱𝗮𝘆: ${today}\n╰─╼📊 𝗧𝗼𝘁𝗮𝗹: ${total}`,
      event.threadID,
      event.messageID
    );
  } catch (e) {
    console.error("❌ [autoteach/onStart] error:", e);
    return api.sendMessage(
      `╭─╼🌟 𝗔𝘂𝘁𝗼𝘁𝗲𝗮𝗰𝗵 𝗦𝘁𝗮𝘁𝘂𝘀\n╰─╼🟢 𝗦𝘁𝗮𝘁𝘂𝘀: 𝗔𝗹𝘄𝗮𝘆𝘀 𝗢𝗡`,
      event.threadID,
      event.messageID
    );
  }
};

module.exports.onChat = async function ({ api, event, usersData }) {
  if (!event.isGroup || !event.senderID) return;

  const uid = getBotUID(api);
  if (event.senderID === uid) return;

  const text = event.body?.trim();
  if (!text) return;

  const senderName = await getUserName(api, event.senderID, usersData);

  try {
    await API.get("/autoteach", {
      params: {
        text,
        senderName,
        senderID: event.senderID,
        threadID: event.threadID
      },
      timeout: 10000
    });
  } catch (e) {
    console.error("❌ [autoteach/onChat] network error:", e.message);
  }
};
