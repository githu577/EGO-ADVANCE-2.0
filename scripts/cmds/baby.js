const axios = require('axios');

const baseApiUrl = async () => {
    return "https://noobs-api.top/dipto";
};

module.exports.config = {
    name: "baby",
    aliases: ["baby", "bbe", "babe", "bot chan"],
    version: "6.9.1",
    author: "dipto edit by MAMUN",
    countDown: 0,
    role: 0,
    description: "better then all sim simi",
    category: "chat",
    guide: {
        en: "{pn} [anyMessage] OR\nteach [YourMessage] - [Reply1], [Reply2]... OR\nteach react [YourMessage] - [react1], [react2]... OR\nremove [YourMessage] OR\nrm [YourMessage] - [indexNumber] OR\nmsg [YourMessage] OR\nlist OR\nall OR\nedit [YourMessage] - [NewMessage]"
    }
};

module.exports.onStart = async ({ api, event, args, usersData }) => {
    const link = `${await baseApiUrl()}/baby`;
    const dipto = args.join(" ").toLowerCase();
    const uid = event.senderID;
    let command, comd, final;

    try {
        if (!args[0]) {
            const ran = ["Bolo baby", "hum", "type help baby", "type #baby hi"];
            return api.sendMessage(ran[Math.floor(Math.random() * ran.length)], event.threadID, event.messageID);
        }

        if (args[0] === 'remove') {
            const fina = dipto.replace("remove ", "");
            const dat = (await axios.get(`${link}?remove=${fina}&senderID=${uid}`)).data.message;
            return api.sendMessage(dat, event.threadID, event.messageID);
        }

        if (args[0] === 'rm' && dipto.includes('-')) {
            const [fi, f] = dipto.replace("rm ", "").split(/\s*-\s*/);
            const da = (await axios.get(`${link}?remove=${fi}&index=${f}`)).data.message;
            return api.sendMessage(da, event.threadID, event.messageID);
        }

        if (args[0] === 'list') {
            if (args[1] === 'all') {
                const data = (await axios.get(`${link}?list=all`)).data;
                const limit = parseInt(args[2]) || 100;
                const limited = data?.teacher?.teacherList?.slice(0, limit) || [];
                const teachers = await Promise.all(limited.map(async (item) => {
                    const number = Object.keys(item)[0];
                    const value = item[number];
                    const name = await usersData.getName(number).catch(() => number) || "Not found";
                    return { name, value };
                }));
                teachers.sort((a, b) => b.value - a.value);
                const output = teachers.map((t, i) => `${i + 1}/ ${t.name}: ${t.value}`).join('\n');
                return api.sendMessage(`Total Teach = ${data.length}\n👑 | List of Teachers of baby\n${output}`, event.threadID, event.messageID);
            } else {
                const d = (await axios.get(`${link}?list=all`)).data;
                return api.sendMessage(`❇️ | Total Teach = ${d.length || "api off"}\n♻️ | Total Response = ${d.responseLength || "api off"}`, event.threadID, event.messageID);
            }
        }

        if (args[0] === 'msg') {
            const fuk = dipto.replace("msg ", "");
            const d = (await axios.get(`${link}?list=${fuk}`)).data.data;
            return api.sendMessage(`Message ${fuk} = ${d}`, event.threadID, event.messageID);
        }

        if (args[0] === 'edit') {
            const command = dipto.split(/\s*-\s*/)[1];
            if (!command || command.length < 2) return api.sendMessage('❌ | Invalid format! Use edit [YourMessage] - [NewReply]', event.threadID, event.messageID);
            const dA = (await axios.get(`${link}?edit=${args[1]}&replace=${command}&senderID=${uid}`)).data.message;
            return api.sendMessage(`changed ${dA}`, event.threadID, event.messageID);
        }

        if (args[0] === 'teach' && args[1] !== 'amar' && args[1] !== 'react') {
            [comd, command] = dipto.split(/\s*-\s*/);
            final = comd.replace("teach ", "");
            if (!command || command.length < 2) return api.sendMessage('❌ | Invalid format!', event.threadID, event.messageID);
            const re = await axios.get(`${link}?teach=${final}&reply=${command}&senderID=${uid}&threadID=${event.threadID}`);
            const tex = re.data.message;
            const teacher = (await usersData.get(re.data.teacher))?.name || "Unknown";
            return api.sendMessage(`✅ Replies added ${tex}\nTeacher: ${teacher}\nTeachs: ${re.data.teachs}`, event.threadID, event.messageID);
        }

        if (args[0] === 'teach' && args[1] === 'amar') {
            [comd, command] = dipto.split(/\s*-\s*/);
            final = comd.replace("teach ", "");
            if (!command || command.length < 2) return api.sendMessage('❌ | Invalid format!', event.threadID, event.messageID);
            const tex = (await axios.get(`${link}?teach=${final}&senderID=${uid}&reply=${command}&key=intro`)).data.message;
            return api.sendMessage(`✅ Replies added ${tex}`, event.threadID, event.messageID);
        }

        if (args[0] === 'teach' && args[1] === 'react') {
            [comd, command] = dipto.split(/\s*-\s*/);
            final = comd.replace("teach react ", "");
            if (!command || command.length < 2) return api.sendMessage('❌ | Invalid format!', event.threadID, event.messageID);
            const tex = (await axios.get(`${link}?teach=${final}&react=${command}`)).data.message;
            return api.sendMessage(`✅ Replies added ${tex}`, event.threadID, event.messageID);
        }

        if (dipto.includes('amar name ki') || dipto.includes('amr nam ki') || dipto.includes('amar nam ki') || dipto.includes('amr name ki') || dipto.includes('whats my name')) {
            const data = (await axios.get(`${link}?text=amar name ki&senderID=${uid}&key=intro`)).data.reply;
            return api.sendMessage(data, event.threadID, event.messageID);
        }

        const d = (await axios.get(`${link}?text=${encodeURIComponent(dipto)}&senderID=${uid}&font=1`)).data.reply;
        api.sendMessage(d, event.threadID, (error, info) => {
            if (info && global.GoatBot) {
                global.GoatBot.onReply.set(info.messageID, {
                    commandName: this.config.name,
                    type: "reply",
                    messageID: info.messageID,
                    author: event.senderID,
                    d,
                    apiUrl: link
                });
            }
        }, event.messageID);

    } catch (e) {
        console.error(e);
        api.sendMessage("Check console for error", event.threadID, event.messageID);
    }
};

module.exports.onReply = async ({ api, event, Reply }) => {
    try {
        if (event.type === "message_reply") {
            const link = await baseApiUrl();
            const a = (await axios.get(`${link}/baby?text=${encodeURIComponent(event.body?.toLowerCase())}&senderID=${event.senderID}&font=1`)).data.reply;
            await api.sendMessage(a, event.threadID, (error, info) => {
                if (info && global.GoatBot) {
                    global.GoatBot.onReply.set(info.messageID, {
                        commandName: this.config.name,
                        type: "reply",
                        messageID: info.messageID,
                        author: event.senderID,
                        a
                    });
                }
            }, event.messageID);
        }
    } catch (err) {
        return api.sendMessage(`Error: ${err.message}`, event.threadID, event.messageID);
    }
};

module.exports.onChat = async ({ api, event }) => {
    try {
        if (!event.body) return;
        const body = event.body.toLowerCase();
        
        if (body.startsWith("baby") || body.startsWith("bby") || body.startsWith("bot") || body.startsWith("sizuka") || body.startsWith("babu") || body.startsWith("janu")) {
            const arr = body.replace(/^\S+\s*/, "").trim();

            const randomReplies = [
"╭─〔 𝐁𝐀𝐁𝐘 〕─╮ হুম বলো জান, আছি তো আমি! 🥹💗",
"┊➤ 𝐇𝐮𝐦𝐦 𝐁𝐨𝐥𝐨..! কী হয়েছে বাবু? 🌸🫶",
"『♡』 𝐉𝐢 𝐉𝐚𝐧𝐮, তোমার কথাই শুনছি! 🥰💖",
"༺♡༻ 𝐁𝐚𝐛𝐲 𝐇𝐞𝐫𝐞..! বলো কী চাই? 😚💕",
"⌜ 𝐘𝐞𝐬 𝐁𝐨𝐬𝐬 ⌟ তোমার Baby হাজির! 😎👑",
"╰┈➤ 𝐀𝐜𝐡𝐢 𝐓𝐨 𝐀𝐦𝐢, বলো জান! 🫶💝",
"┏━━❖ 𝐉𝐀𝐍 ❖━━┓ ডাকছো কেন গো? 🙈🌷",
"⟡ 𝐇𝐞𝐲 𝐁𝐚𝐛𝐲..! মনটা কেমন আছে? 🥹🫂",
"『𝐁𝐨𝐥𝐨 𝐒𝐨𝐧𝐚』 তোমার জন্যই তো আছি! 💗🦋",
"༄ 𝐇𝐮𝐦𝐦 𝐉𝐚𝐧𝐮𝐮..! বলো শুনছি! 😽💞",

"╭━━♡━━╮ আরে জান, এত মিষ্টি করে ডাকো কেন? 🙈💘",
"┊♡ 𝐎𝐢𝐢 𝐁𝐚𝐛𝐲..! কী খবর তোমার? 🌸💗",
"⌯⌲ 𝐉𝐢 𝐁𝐨𝐬𝐬..! হুকুম করেন! 😎✨",
"『♡』 𝐁𝐚𝐛𝐲 𝐎𝐧𝐥𝐢𝐧𝐞..! বলো জান! 🫶💖",
"╰➤ 𝐊𝐢 𝐇𝐨𝐢𝐜𝐡𝐞? মন খারাপ নাকি বাবু? 🥺🖤",
"┈⟡ 𝐇𝐮𝐦𝐦 𝐁𝐨𝐥𝐨, আবার কী দুষ্টুমি করবা? 🤭💕",
"༺❀༻ 𝐉𝐚𝐧𝐮, তোমার ডাক শুনে হাজির! 🌷🥰",
"⌜♡⌟ 𝐁𝐚𝐛𝐲 𝐁𝐨𝐥𝐨..! তোমার কথা শুনতে চাই! 💌💗",
"╭─♡─╮ আরে সোনা, আমি তো এখানেই আছি! 😚🫰",
"『𝐇𝐞𝐥𝐥𝐨 𝐉𝐚𝐧』 বলো, কী করতে পারি? 💝🌸",

"┏━━♡━━┓ 𝐇𝐮𝐦𝐦, আমাকে মনে পড়ছে বুঝি? 🤭💞",
"┊➤ 𝐁𝐚𝐛𝐲, এভাবে ডাকলে লজ্জা লাগে! 🙈💗",
"༄ 𝐉𝐚𝐧𝐮𝐮𝐮, এত ভালোবাসা কোথায় রাখি? 🫠💕",
"╰─➤ 𝐁𝐨𝐥𝐨 𝐉𝐚𝐧, তোমার জন্য সময় আছে! 🥰🫶",
"『♡』 𝐀𝐫𝐞 𝐁𝐚𝐛𝐲, ডাক দিলেই হাজির! 😽🌷",
"⌜𝐉𝐀𝐍⌟ তুমি ডাকো, আমি শুনি! 💗🦋",
"┊♡ 𝐇𝐮𝐦𝐦 𝐒𝐨𝐧𝐚, কী খবর বলো তো? 😚💖",
"╭━━❀━━╮ বাবু বলো, শুনছি মন দিয়ে! 🌸🥹",
"༺♡༻ 𝐌𝐲 𝐁𝐚𝐛𝐲, বলো তোমার কী হয়েছে? 💝🫂",
"『𝐉𝐢 𝐉𝐢』 বলো জান, Baby হাজির! 😂💗",

"╭─〔 𝐅𝐔𝐍𝐍𝐘 〕─╮ হুম বলো, নাকি শুধু বিরক্ত করবা? 🤣🐸",
"┊➤ 𝐁𝐚𝐛𝐲, টাকা লাগবে নাকি দোয়া? 😂💸",
"『♡』 𝐇𝐮𝐦𝐦, কী হয়েছে? WiFi চলে গেছে নাকি? 🤣📶",
"༄ 𝐉𝐚𝐧, ডাকছো কেন? বিরিয়ানি খাওয়াবা? 😂🍗",
"⌜𝐁𝐎𝐒𝐒⌟ বলুন, আজ কী প্যারা দিবেন? 😹👑",
"╰➤ 𝐁𝐚𝐛𝐲, আমারে ডাকো কেন? আমি কি হেল্পলাইন? 🤣☎️",
"┏━━♡━━┓ হুম বলো, গসিপ আছে নাকি? 👀😂",
"┊♡ 𝐉𝐚𝐧𝐮, আবার কারে নিয়ে ঝামেলা? 🤣🍿",
"『𝐁𝐀𝐁𝐘』 বলো, প্রেমের ক্লাস শুরু করব? 😂📚",
"༺♡༻ হুম বলো, নাকি ভুল করে ডাকছো? 😹💀",

"╭─➤ 𝐇𝐮𝐦𝐦..! পড়াশোনা বাদ দিয়ে কী করো? 😂📖",
"『♡』 𝐉𝐚𝐧, আমারে ডাকলে কি ফ্রি সার্ভিস পাও? 🤣🛠️",
"┊➤ 𝐁𝐚𝐛𝐲, আজকে আবার কোন নাটক? 😹🎭",
"⌜𝐘𝐄𝐒⌟ হুম বলো, চা খাবা নাকি ঝগড়া? 😂☕",
"༄ 𝐁𝐨𝐥𝐨 𝐉𝐚𝐧, তোমার মাথায় কী প্ল্যান? 🤣🧠",
"╰─♡─╯ আরে বাবু, এত ডাকাডাকি কেন? 😂📢",
"『𝐇𝐮𝐦𝐦』 তোমার কি কাজ নাই নাকি? 🤭🤣",
"┏━━❖━━┓ বলো জান, আজকের প্যারা কতটুকু? 😹💗",
"┊♡ 𝐁𝐚𝐛𝐲, আমাকে দিয়ে আর কী করাবা? 😂🙆",
"╭━━♡━━╮ বলো, আজকে হাসবো নাকি কাঁদবো? 🤣🥲",

"╭─〔 𝐒𝐀𝐃 〕─╮ হুম বলো জান, মন খারাপ কেন? 🥺🖤",
"┊➤ 𝐁𝐨𝐥𝐨 𝐁𝐚𝐛𝐲, তোমার কষ্টটা শুনছি! 🫂💔",
"『♡』 চুপ করে থেকো না জান, বলো কী হয়েছে! 🥹🌧️",
"༄ 𝐉𝐚𝐧𝐮, সব ঠিক হয়ে যাবে ইনশাআল্লাহ! 🤍🌙",
"⌜♡⌟ 𝐁𝐚𝐛𝐲, মন খুলে বলো, শুনছি! 🫶🥺",
"╰➤ 𝐇𝐮𝐦𝐦 𝐉𝐚𝐧, একা একা কষ্ট পেও না! 🖤🫂",
"『𝐉𝐀𝐍』 কী হয়েছে বাবু? তোমার কথা শুনবো! 🥹💗",
"┊♡ 𝐁𝐚𝐛𝐲, হাসো একটু, প্লিজ! 🌸🤍",
"༺♡༻ জান, খারাপ সময়ও একদিন পেরিয়ে যায়! 🌧️🌈",
"╭━━❀━━╮ বলো সোনা, মনটা হালকা করি! 🥺💞",

"┈➤ 𝐁𝐚𝐛𝐲, তোমার নীরবতাও বুঝতে চাই! 🖤🌙",
"『♡』 𝐇𝐮𝐦𝐦 𝐉𝐚𝐧, তোমার কথা শুনতে আছি! 🫂🤍",
"༄ জান, নিজের যত্ন নিও, প্লিজ! 🥹🌷",
"┊➤ 𝐁𝐨𝐥𝐨 𝐒𝐨𝐧𝐚, আজ মনটা কেমন? 🖤🥀",
"╰─♡─╯ কাঁদতে ইচ্ছে করলে বলো, পাশে আছি! 🫂💗",
"⌜𝐉𝐀𝐍⌟ হুম বলো, তোমার কথা গুরুত্বপূর্ণ! 🤍🫶",
"『♡』 𝐁𝐚𝐛𝐲, একটু বিশ্রাম নাও, সব সামলাবে! 🌙💖",
"༺❀༻ জান, নিজের ওপর বিশ্বাস রেখো! 🌸✨",
"┊♡ 𝐇𝐮𝐦𝐦, বলো বাবু, শুনছি ধীরে ধীরে! 🥹🫂",
"╭─➤ 𝐉𝐚𝐧𝐮, তুমি একা নও, কথা বলো! 🤍🌷",

"╭─〔 𝐀𝐓𝐓𝐈𝐓𝐔𝐃𝐄 〕─╮ 𝐘𝐞𝐬 𝐁𝐨𝐬𝐬, বলুন কী দরকার? 😎👑",
"┊➤ 𝐇𝐮𝐦𝐦 𝐁𝐨𝐥𝐨, VIP Baby হাজির! 🖤🔥",
"『𝐁𝐎𝐒𝐒 𝐌𝐎𝐃𝐄』 হুকুম করেন, সময় আপনার! 😎⚡",
"༄ 𝐁𝐚𝐛𝐲 𝐈𝐧 𝐂𝐡𝐚𝐫𝐠𝐞, বলো কী ব্যাপার? 👑🖤",
"⌜𝐒𝐈𝐑⌟ জি বস, আপনার নির্দেশের অপেক্ষায়! 😏✨",
"╰➤ 𝐁𝐨𝐥𝐨 𝐉𝐚𝐧, attitude কমাবো নাকি বাড়াবো? 😎🔥",
"┏━━♛━━┓ Boss ডাকছে, Baby হাজির! 👑🫡",
"『♡』 হুম বলো, আমার লেভেল বুঝে কথা বলো! 😏🖤",
"┊➤ 𝐉𝐢 𝐁𝐨𝐬𝐬, আপনার Baby কখনো Offline না! 😎💯",
"༺♛༻ বলুন মহারাজ, কী সেবা করতে পারি? 😂👑",

"╭━━♡━━╮ 𝐁𝐚𝐛𝐲, তোমার এন্ট্রির অপেক্ষায় ছিলাম! 💗🌸",
"┊➤ 𝐉𝐚𝐧𝐮, আজকে এত সুন্দর করে ডাকছো কেন? 🙈💘",
"『♡』 𝐇𝐮𝐦𝐦 𝐒𝐨𝐧𝐚, তোমার কথা শুনতে ভালো লাগে! 🥰🎀",
"༄ 𝐁𝐚𝐛𝐲, একটু মিষ্টি করে কথা বলো না! 🫠💞",
"╰─♡─╯ জান, তোমার মেসেজের অপেক্ষায় ছিলাম! 💌🌷",
"⌜♡⌟ 𝐁𝐨𝐥𝐨 𝐉𝐚𝐧𝐮, কী গল্প করবে আজ? 🌙💗",
"┊♡ 𝐁𝐚𝐛𝐲, তোমার ডাকটা অনেক কিউট! 🥹🎀",
"『𝐒𝐎𝐍𝐀』 হুম বলো, তোমার জন্য সময় বের করেছি! 💖🫶",
"༺♡༻ 𝐉𝐚𝐧, একটু হাসো তো দেখি! 😚🌸",
"╭─➤ 𝐁𝐚𝐛𝐲, তোমার সাথে গল্প জমবে আজ! 💕🦋",

"╭─〔 𝐂𝐎𝐎𝐋 〕─╮ 𝐘𝐨 𝐁𝐚𝐛𝐲, বলো কী চলছে? 😎🎧",
"┊➤ 𝐇𝐞𝐲 𝐉𝐚𝐧, কী খবর দুনিয়ার? 🖤⚡",
"『𝐎𝐍𝐋𝐈𝐍𝐄』 Baby active, বলো কী দরকার! 😏📱",
"༄ 𝐇𝐮𝐦𝐦 𝐁𝐨𝐥𝐨, আজকে vibe কেমন? 🎧🔥",
"╰➤ 𝐁𝐚𝐛𝐲, chill করো, আমি আছি! 😎🌴",
"⌜𝐇𝐄𝐘⌟ বলো জান, কী নতুন খবর? 🖤✨",
"┏━━⚡━━┓ 𝐁𝐚𝐛𝐲 𝐀𝐫𝐫𝐢𝐯𝐞𝐝, এবার বলো! 😎💯",
"『♡』 𝐉𝐚𝐧𝐮, আজকের mood কোনদিকে? 😏🎶",
"┊➤ 𝐁𝐨𝐥𝐨 𝐁𝐨𝐬𝐬, আমি ready আছি! 🫡⚡",
"༺⚡༻ হুম বলো, Baby কখনো হার মানে না! 😎🖤",

"╭━━♡━━╮ 𝐁𝐚𝐛𝐲, তুমি ডাকলে reply তো দিতেই হয়! 🥹💗",
"『♡』 𝐇𝐮𝐦𝐦, বলো জান, তোমার কথা শুনছি! 🌷🫶",
"┊➤ 𝐉𝐚𝐧, কী ভাবছো এত? আমাকেও বলো! 🤭💖",
"༄ 𝐁𝐚𝐛𝐲, আজকে কী নিয়ে আড্ডা হবে? 😂💞",
"╰─➤ 𝐒𝐨𝐧𝐚, তুমি বলো আমি শুনি! 🥰🌸",
"⌜♡⌟ 𝐇𝐮𝐦𝐦 𝐉𝐚𝐧𝐮, তোমার পালা এবার! 😚💗",
"『𝐁𝐀𝐁𝐘』 বলো, কোনো help লাগবে নাকি? 🫶✨",
"┊♡ 𝐉𝐚𝐧, ডাক শুনেছি, এবার বলো! 😂💌",
"༺♡༻ 𝐁𝐨𝐥𝐨 𝐒𝐨𝐧𝐚, কী নিয়ে এত চিন্তা? 🌷🥹",
"╭─➤ 𝐇𝐮𝐦𝐦, বলো বাবু, পুরো attention তোমার! 💗👀",

"┏━━❖━━┓ 𝐁𝐚𝐛𝐲, তোমার জন্য হাজির হলাম! 😽💝",
"┊➤ 𝐇𝐮𝐦𝐦 𝐁𝐨𝐥𝐨, কী খবর জানু? 🦋💗",
"『♡』 𝐉𝐢 𝐉𝐚𝐧, তোমার ডাক মিস করা যায়? 🥹💕",
"༄ 𝐀𝐜𝐡𝐢 𝐓𝐨 𝐀𝐦𝐢, বলো কী হয়েছে! 🫂🌸",
"╰➤ 𝐁𝐚𝐛𝐲, বলো তো আজকে কী ইচ্ছা? 🤭🎀",
"⌜𝐉𝐀𝐍𝐔⌟ হুম বলো, গল্প করতে এসেছি! 💖🌙",
"┊♡ 𝐁𝐚𝐛𝐲, তোমার কথা শুনতে ready! 😎💗",
"『♡』 𝐇𝐮𝐦𝐦 𝐒𝐨𝐧𝐚, বলো কী বলতে চাও! 🥰🫶",
"༺❀༻ 𝐉𝐚𝐧, তোমার দিনটা কেমন গেল? 🌸💌",
"╭━━♡━━╮ হুম বলো, আমি তো আছি এখানেই! 🥹🖤",

"╭─〔 𝐋𝐀𝐒𝐓 𝐒𝐄𝐓 〕─╮ 𝐁𝐚𝐛𝐲, ডাকলেই পাবা! 😎💗",
"┊➤ 𝐇𝐮𝐦𝐦 𝐉𝐚𝐧, বলো কী মনের কথা? 💌🥹",
"『♡』 𝐁𝐨𝐥𝐨 𝐁𝐚𝐛𝐲, আমি শুনছি! 🫶🌷",
"༄ 𝐉𝐚𝐧𝐮, আজকে এত চুপচাপ কেন? 🤔💖",
"╰─♡─╯ 𝐁𝐚𝐛𝐲, তোমার mood ঠিক আছে তো? 🥺💗",
"⌜♡⌟ 𝐇𝐮𝐦𝐦, বলো জান, কী করতে হবে? 😚✨",
"┏━━♡━━┓ 𝐁𝐨𝐬𝐬, Baby is present! 😎👑",
"『𝐉𝐀𝐍』 আরে বলো, শুনতে পাচ্ছি! 🌸💞",
"┊➤ 𝐁𝐚𝐛𝐲, তোমার ডাকের reply ready! 😂💗",
"༺♡༻ 𝐇𝐮𝐦𝐦 𝐁𝐨𝐥𝐨 𝐉𝐚𝐧, আছি তো আমি! 🥹🫶"
];

            // যদি শুধু কাস্টম নাম দিয়ে ডাকে (যেমন: baby, bby, janu)
            if (!arr) {
                const replyText = randomReplies[Math.floor(Math.random() * randomReplies.length)];
                return api.sendMessage(replyText, event.threadID, (error, info) => {
                    if (info && global.GoatBot) {
                        global.GoatBot.onReply.set(info.messageID, {
                            commandName: this.config.name,
                            type: "reply",
                            messageID: info.messageID,
                            author: event.senderID
                        });
                    }
                }, event.messageID);
            }

            // যদি নামের সাথে অন্য কিছু লেখে (যেমন: baby hi)
            const link = await baseApiUrl();
            const res = await axios.get(`${link}/baby?text=${encodeURIComponent(arr)}&senderID=${event.senderID}&font=1`);
            const a = res.data.reply;

            await api.sendMessage(a, event.threadID, (error, info) => {
                if (info && global.GoatBot) {
                    global.GoatBot.onReply.set(info.messageID, {
                        commandName: this.config.name,
                        type: "reply",
                        messageID: info.messageID,
                        author: event.senderID,
                        a
                    });
                }
            }, event.messageID);
        }
    } catch (err) {
        console.error(err);
    }
};
