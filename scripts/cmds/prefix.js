// code from goatstore
// api: https://store.agi.bd
const fs = require("fs-extra");
const { utils } = global;

const handled = new Set();

function once(id) {
	if (!id) return true;
	if (handled.has(id)) return false;
	handled.add(id);
	setTimeout(() => handled.delete(id), 30000);
	return true;
}

function card(globalPrefix, groupPrefix) {
	return (
		"╭─「ᴇɢᴏ ᴘʀᴇғɪx ɪɴғᴏ 」♨︎\n" +
		`│ 🌐 ɢʟᴏʙᴀʟ ᴘʀᴇғɪx : ${globalPrefix}\n` +
		`│ 📡 ɢʀᴏᴜᴘ ᴘʀᴇғɪx  : ${groupPrefix}\n` +
		"╰─────────────"
	);
}

module.exports = {
	config: {
		name: "prefix",
		version: "2.0",
		author: "Zihad",
		countDown: 5,
		role: 0,
		description: "Show or change the bot prefix",
		category: "config",
		guide: {
			en:
				"{pn}: show prefix\n" +
				"{pn} <new prefix>: change prefix for this group\n" +
				"{pn} <new prefix> -g: change global prefix (bot admin only)\n" +
				"{pn} reset: reset this group's prefix\n" +
				"Type: prefix"
		}
	},

	onStart: async function ({ message, role, args, commandName, event, threadsData }) {
		const globalPrefix = global.GoatBot.config.prefix;

		if (!args[0]) {
			if (!once(event.messageID)) return;
			return message.reply(card(globalPrefix, utils.getPrefix(event.threadID)));
		}

		if (args[0] === "reset") {
			await threadsData.set(event.threadID, null, "data.prefix");
			return message.reply(card(globalPrefix, globalPrefix));
		}

		const newPrefix = args[0];
		const isGlobal = args[1] === "-g";

		if (isGlobal && role < 2)
			return message.reply("Only bot admin can change the global prefix.");

		const formSet = {
			commandName,
			author: event.senderID,
			newPrefix,
			setGlobal: isGlobal
		};

		return message.reply(
			isGlobal
				? "React to this message to confirm changing the GLOBAL prefix."
				: "React to this message to confirm changing this group's prefix.",
			(err, info) => {
				if (err || !info) return;
				formSet.messageID = info.messageID;
				global.GoatBot.onReaction.set(info.messageID, formSet);
			}
		);
	},

	onReaction: async function ({ message, threadsData, event, Reaction }) {
		const { author, newPrefix, setGlobal } = Reaction;
		if (event.userID !== author) return;

		if (setGlobal) {
			global.GoatBot.config.prefix = newPrefix;
			fs.writeFileSync(
				global.client.dirConfig,
				JSON.stringify(global.GoatBot.config, null, 2)
			);
			return message.reply(card(newPrefix, newPrefix));
		}

		await threadsData.set(event.threadID, newPrefix, "data.prefix");
		return message.reply(card(global.GoatBot.config.prefix, newPrefix));
	},

	onChat: async function ({ event, message }) {
		if (!event.body || event.body.trim().toLowerCase() !== "prefix") return;
		if (!once(event.messageID)) return;

		const globalPrefix = global.GoatBot.config.prefix;
		return message.reply(card(globalPrefix, utils.getPrefix(event.threadID)));
	}
};
