const last = {};
const cooldown = 10000;

exports.config = {
 name: "fork",
 version: "3.1.0",
 author: "EGO",
 countDown: 0,
 role: 0,
 shortDescription: "EGO FORK BOSS EDITION",
 longDescription: "EGO FORK Loading Animation",
 category: "system",
 guide: {
 en: "Type fork or repository"
 }
};

exports.onStart = async function () {};

exports.onChat = async function ({ event, api }) {
 const threadID = event.threadID;
 const messageID = event.messageID;
 const body = (event.body || "").toLowerCase().trim();
 const now = Date.now();

 if (!body) return;
 if (!body.includes("fork") && !body.includes("repository")) return;

 if (last[threadID] && now - last[threadID] < cooldown) return;
 last[threadID] = now;

 const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

 const send = (text, replyTo) =>
 new Promise((resolve, reject) => {
 api.sendMessage(text, threadID, (err, info) => {
 if (err) return reject(err);
 resolve(info);
 }, replyTo);
 });

 const edit = (text, id) =>
 new Promise((resolve, reject) => {
 api.editMessage(text, id, err => {
 if (err) return reject(err);
 resolve();
 });
 });

 const remove = id =>
 new Promise((resolve, reject) => {
 api.unsendMessage(id, err => {
 if (err) return reject(err);
 resolve();
 });
 });

 let loadingID;

 try {
 const loading = await send(
 "⚡ 𝙀𝙂𝙊 𝙁𝙊𝙍𝙆\n▰▰▱▱▱▱▱▱▱▱ 20%",
 messageID
 );

 if (!loading || !loading.messageID) {
 throw new Error("Loading message ID not found");
 }

 loadingID = loading.messageID;

 const progress = [
 "⚡ 𝙀𝙂𝙊 𝙁𝙊𝙍𝙆\n▰▰▰▰▱▱▱▱▱▱ 40%",
 "⚡ 𝙀𝙂𝙊 𝙁𝙊𝙍𝙆\n▰▰▰▰▰▰▱▱▱▱ 60%",
 "⚡ 𝙀𝙂𝙊 𝙁𝙊𝙍𝙆\n▰▰▰▰▰▰▰▰▱▱ 80%",
 "⚡ 𝙀𝙂𝙊 𝙁𝙊𝙍𝙆\n▰▰▰▰▰▰▰▰▰▰ 100%"
 ];

 for (const text of progress) {
 await wait(700);
 await edit(text, loadingID);
 }

 await wait(400);
 await remove(loadingID);
 loadingID = null;

 await send(
 "👑━━━━━━━━━━━━👑\n" +
 " 𝙀𝙂𝙊 𝙁𝙊𝙍𝙆\n" +
 "⚡ BOSS EDITION ⚡\n" +
 "👑━━━━━━━━━━━━👑\n\n" +
 "Aɢᴇ ᴀᴍᴀʀ ʙᴏss ᴇɢᴏ ᴋᴇ ᴇᴋᴛᴀ ʙᴏᴡ ᴅᴇ ᴛᴀʀᴘᴏʀ 🫶🩵",
 messageID
 );

 } catch (error) {
 console.error("[EGO FORK ERROR]", error);

 if (loadingID) {
 try {
 await remove(loadingID);
 } catch (_) {}
 }

 try {
 await send(
 "❌ EGO FORK ERROR\nCheck api.editMessage() support.",
 messageID
 );
 } catch (_) {}
 }
};
