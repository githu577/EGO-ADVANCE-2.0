"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const baseApiUrl = async () => {
    const base = await axios.get(
        "https://raw.githubusercontent.com/mahmudx7/HINATA/main/baseApiUrl.json"
    );
    return base.data.mahmud;
};

const loadingFrames = [
    "「 EGO PASTEBIN 」\n\n[■■□□□□□□□□] 20%\n\n⚡ Uploading command...",
    "「 EGO PASTEBIN 」\n\n[■■■■□□□□□□] 40%\n\n⚡ Processing file...",
    "「 EGO PASTEBIN 」\n\n[■■■■■■□□□□] 60%\n\n⚡ Connecting to API...",
    "「 EGO PASTEBIN 」\n\n[■■■■■■■■□□] 80%\n\n⚡ Creating paste...",
    "「 EGO PASTEBIN 」\n\n[■■■■■■■■■■] 100%\n\n✅ Upload completed!"
];

module.exports = {
    config: {
        name: "pastebin",
        version: "2.0.0",
        author: "MahMUD",
        countDown: 5,
        role: 0,
        description: {
            bn: "আপনার API পেস্টবিনে কমান্ড ফাইল আপলোড করুন",
            en: "Upload command file to your API pastebin",
            vi: "Tải tệp lệnh lên pastebin API của bạn"
        },
        category: "utility",
        guide: {
            bn: "{pn} <কমান্ডের নাম>",
            en: "{pn} <cmd name>",
            vi: "{pn} <tên lệnh>"
        }
    },

    langs: {
        bn: {
            noInput: "× বেবি, একটি কমান্ডের নাম তো বলো!",
            notFound: "× ফাইলটি খুঁজে পাওয়া যায়নি: %1.js",
            success: "✅ EGO PASTEBIN UPLOAD SUCCESS!\n\n• Title: %1\n• Raw Link: %2",
            error: "× সমস্যা হয়েছে: %1"
        },
        en: {
            noInput: "× Baby, please enter a command name!",
            notFound: "× File not found: %1.js",
            success: "✅ EGO PASTEBIN UPLOAD SUCCESS!\n\n• Title: %1\n• Raw Link: %2",
            error: "× API error: %1"
        },
        vi: {
            noInput: "× Vui lòng nhập tên lệnh!",
            notFound: "× Không tìm thấy tệp: %1.js",
            success: "✅ EGO PASTEBIN UPLOAD SUCCESS!\n\n• Title: %1\n• Raw Link: %2",
            error: "× Lỗi API: %1"
        }
    },

    onStart: async function ({
        api,
        event,
        args,
        message,
        getLang
    }) {
        const authorName = String.fromCharCode(
            77, 97, 104, 77, 85, 68
        );

        if (this.config.author !== authorName) {
            return api.sendMessage(
                "You are not authorized to change the author name.",
                event.threadID,
                event.messageID
            );
        }

        const fileName = args[0];

        if (!fileName) {
            return message.reply(getLang("noInput"));
        }

        const safeName = path.basename(fileName);

        const finalName = safeName.endsWith(".js")
            ? safeName
            : safeName + ".js";

        const filePath = path.join(
            __dirname,
            "..",
            "cmds",
            finalName
        );

        if (!fs.existsSync(filePath)) {
            return api.sendMessage(
                getLang("notFound", safeName),
                event.threadID,
                event.messageID
            );
        }

        let loadingMessage = null;

        try {
            api.setMessageReaction(
                "⏳",
                event.messageID,
                () => {},
                true
            );

            // EGO LOADING MESSAGE
            loadingMessage = await new Promise(resolve => {
                api.sendMessage(
                    loadingFrames[0],
                    event.threadID,
                    (err, info) => {
                        if (err) return resolve(null);
                        resolve(info);
                    },
                    event.messageID
                );
            });

            // LOADING ANIMATION
            for (let i = 1; i < loadingFrames.length; i++) {
                await delay(700);

                if (loadingMessage && loadingMessage.messageID) {
                    await new Promise(resolve => {
                        api.editMessage(
                            loadingFrames[i],
                            loadingMessage.messageID,
                            () => resolve()
                        );
                    });
                }
            }

            // READ COMMAND FILE
            const code = fs.readFileSync(filePath, "utf8");

            // API CONNECTION
            const baseUrl = await baseApiUrl();

            // UPLOAD FILE
            const res = await axios.post(
                `${baseUrl}/api/pastebin`,
                {
                    text: code,
                    title: safeName
                },
                {
                    timeout: 60000
                }
            );

            if (!res.data || !res.data.success) {
                throw new Error(
                    res.data?.message || "Upload failed"
                );
            }

            // DELETE LOADING MESSAGE
            if (loadingMessage && loadingMessage.messageID) {
                await new Promise(resolve => {
                    api.unsendMessage(
                        loadingMessage.messageID,
                        () => resolve()
                    );
                });
            }

            // SUCCESS REACTION
            api.setMessageReaction(
                "✅",
                event.messageID,
                () => {},
                true
            );

            // SUCCESS MESSAGE
            return api.sendMessage(
                getLang(
                    "success",
                    res.data.title || safeName,
                    res.data.rawPaste
                ),
                event.threadID,
                event.messageID
            );

        } catch (err) {
            console.error("EGO Pastebin Error:", err);

            // DELETE LOADING MESSAGE
            if (loadingMessage && loadingMessage.messageID) {
                try {
                    api.unsendMessage(
                        loadingMessage.messageID,
                        () => {}
                    );
                } catch (_) {}
            }

            api.setMessageReaction(
                "❌",
                event.messageID,
                () => {},
                true
            );

            const errorMsg =
                err.response?.data?.error ||
                err.response?.data?.message ||
                err.message ||
                "Unknown error";

            return api.sendMessage(
                getLang("error", errorMsg),
                event.threadID,
                event.messageID
            );
        }
    }
};
