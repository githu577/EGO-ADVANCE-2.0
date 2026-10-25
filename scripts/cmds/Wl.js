const fs = require("fs");

module.exports = {
  config: {
    name: "whitelist",
    aliases: ["wl"],
    version: "2.0",
    author: "NTKhang X EryXenX",
    countDown: 5,
    role: 2,
    shortDescription: {
      vi: "Quản lý chế độ whitelist người dùng và nhóm",
      en: "Manage user and thread whitelist mode"
    },
    longDescription: {
      vi: "Quản lý chế độ whitelist người dùng và nhóm (bật/tắt, thêm, xóa, danh sách, bỏ qua lệnh)",
      en: "Manage user and thread whitelist mode (toggle, add, remove, list, ignore commands)"
    },
    category: "owner",
    guide: {
      vi: "{pn} on/off: Bật hoặc tắt whitelist người dùng\n{pn} [add|-a] <uid|@tag>: Thêm người dùng\n{pn} [remove|-r] <uid|@tag>: Xóa người dùng\n{pn} [list|-l]: Xem danh sách người dùng\n{pn} threadon/threadoff: Bật hoặc tắt whitelist nhóm\n{pn} [threadadd|tadd] [tid]: Thêm nhóm\n{pn} [threadremove|tremove] [tid]: Xóa nhóm\n{pn} [threadlist|tlist]: Xem danh sách nhóm\n{pn} ignore <cmd>: Cho phép lệnh hoạt động khi bật whitelist\n{pn} unignore <cmd>: Hủy bỏ qua lệnh",
      en: "{pn} on/off: Toggle user whitelist mode\n{pn} [add|-a] <uid|@tag>: Add user\n{pn} [remove|-r] <uid|@tag>: Remove user\n{pn} [list|-l]: List all users\n{pn} threadon/threadoff: Toggle thread whitelist mode\n{pn} [threadadd|tadd] [tid]: Add thread\n{pn} [threadremove|tremove] [tid]: Remove thread\n{pn} [threadlist|tlist]: List all threads\n{pn} ignore <cmd>: Allow command during whitelist mode\n{pn} unignore <cmd>: Remove command exemption"
    },
  },

  langs: {
    vi: {
      toggledOn: "✅ | Đã bật chế độ whitelist người dùng.",
      toggledOff: "❌ | Đã tắt chế độ whitelist người dùng.",
      threadToggledOn: "✅ | Đã bật chế độ whitelist nhóm.",
      threadToggledOff: "❌ | Đã tắt chế độ whitelist nhóm.",
      added: "✅ | Đã thêm quyền whitelist cho %1 người dùng:\n%2",
      alreadyAdmin: "\n⚠ | %1 người dùng đã có trong whitelist:\n%2",
      missingIdAdd: "⚠ | Vui lòng nhập ID hoặc tag người dùng để thêm",
      removed: "✅ | Đã xóa quyền whitelist của %1 người dùng:\n%2",
      notAdmin: "⚠ | %1 người dùng không có trong whitelist:\n%2",
      missingIdRemove: "⚠ | Vui lòng nhập ID hoặc tag người dùng để xóa",
      listAdmin: "👑 | Danh sách người dùng trong Whitelist:\n%1",
      threadAdded: "✅ | Đã thêm nhóm %1 vào whitelist.",
      threadAlreadyAdded: "⚠ | Nhóm %1 đã có trong whitelist.",
      threadRemoved: "✅ | Đã xóa nhóm %1 khỏi whitelist.",
      threadNotAdded: "⚠ | Nhóm %1 không có trong whitelist.",
      listThread: "👑 | Danh sách nhóm trong Whitelist:\n%1",
      noThreads: "⚠ | Chưa có nhóm nào trong whitelist.",
      ignoreCmdAdded: "✅ | Đã thêm lệnh '%1' vào danh sách bỏ qua.",
      ignoreCmdExists: "⚠ | Lệnh '%1' đã có trong danh sách bỏ qua.",
      ignoreCmdRemoved: "✅ | Đã xóa lệnh '%1' khỏi danh sách bỏ qua.",
      ignoreCmdNotIn: "⚠ | Lệnh '%1' không có trong danh sách bỏ qua.",
      noCmd: "⚠ | Vui lòng nhập tên lệnh.",
      currentStatus: "🔄 | Trạng thái Whitelist:\n- Whitelist User: %1\n- Whitelist Thread: %2\n- Danh sách lệnh bỏ qua: %3",
    },
    en: {
      toggledOn: "✅ | Whitelist user mode has been turned ON.",
      toggledOff: "❌ | Whitelist user mode has been turned OFF.",
      threadToggledOn: "✅ | Whitelist thread mode has been turned ON.",
      threadToggledOff: "❌ | Whitelist thread mode has been turned OFF.",
      added: "✅ | Added whitelist role for %1 users:\n%2",
      alreadyAdmin: "\n⚠ | %1 users already in whitelist:\n%2",
      missingIdAdd: "⚠ | Please enter ID or tag to add user",
      removed: "✅ | Removed whitelist role of %1 users:\n%2",
      notAdmin: "⚠ | %1 users not in whitelist:\n%2",
      missingIdRemove: "⚠ | Please enter ID or tag to remove user",
      listAdmin: "👑 | List of whitelisted users:\n%1",
      threadAdded: "✅ | Added thread %1 to whitelist.",
      threadAlreadyAdded: "⚠ | Thread %1 is already in whitelist.",
      threadRemoved: "✅ | Removed thread %1 from whitelist.",
      threadNotAdded: "⚠ | Thread %1 is not in whitelist.",
      listThread: "👑 | List of whitelisted threads:\n%1",
      noThreads: "⚠ | No threads in whitelist.",
      ignoreCmdAdded: "✅ | Command '%1' is now exempt from whitelist.",
      ignoreCmdExists: "⚠ | Command '%1' is already exempt.",
      ignoreCmdRemoved: "✅ | Command '%1' removed from exemption list.",
      ignoreCmdNotIn: "⚠ | Command '%1' is not in exemption list.",
      noCmd: "⚠ | Please provide a command name.",
      currentStatus: "🔄 | Whitelist Status:\n- User Whitelist: %1\n- Thread Whitelist: %2\n- Exempt Commands: %3",
    },
    bn: {
      toggledOn: "✅ | হোয়াইটলিস্ট ইউজার মোড চালু করা হয়েছে।",
      toggledOff: "❌ | হোয়াইটলিস্ট ইউজার মোড বন্ধ করা হয়েছে।",
      threadToggledOn: "✅ | হোয়াইটলিস্ট থ্রেড মোড চালু করা হয়েছে।",
      threadToggledOff: "❌ | হোয়াইটলিস্ট থ্রেড মোড বন্ধ করা হয়েছে।",
      added: "✅ | %1 জন ইউজারকে হোয়াইটলিস্টে যুক্ত করা হয়েছে:\n%2",
      alreadyAdmin: "\n⚠ | %1 জন ইউজার আগে থেকেই হোয়াইটলিস্টে আছে:\n%2",
      missingIdAdd: "⚠ | ইউজার যোগ করার জন্য ID অথবা ট্যাগ দিন",
      removed: "✅ | %1 জন ইউজারকে হোয়াইটলিস্ট থেকে সরানো হয়েছে:\n%2",
      notAdmin: "⚠ | %1 জন ইউজার হোয়াইটলিস্টে নেই:\n%2",
      missingIdRemove: "⚠ | ইউজার সরানোর জন্য ID অথবা ট্যাগ দিন",
      listAdmin: "👑 | হোয়াইটলিস্ট ইউজার তালিকা:\n%1",
      threadAdded: "✅ | থ্রেড %1 হোয়াইটলিস্টে যোগ করা হয়েছে।",
      threadAlreadyAdded: "⚠ | থ্রেড %1 আগে থেকেই হোয়াইটলিস্টে আছে।",
      threadRemoved: "✅ | থ্রেড %1 হোয়াইটলিস্ট থেকে সরানো হয়েছে।",
      threadNotAdded: "⚠ | থ্রেড %1 হোয়াইটলিস্টে নেই।",
      listThread: "👑 | হোয়াইটলিস্ট থ্রেড তালিকা:\n%1",
      noThreads: "⚠ | হোয়াইটলিস্টে কোনো থ্রেড নেই।",
      ignoreCmdAdded: "✅ | '%1' কমান্ডটি হোয়াইটলিস্ট থেকে ছাড় দেওয়া হয়েছে।",
      ignoreCmdExists: "⚠ | '%1' কমান্ডটি আগে থেকেই ছাড় তালিকায় আছে।",
      ignoreCmdRemoved: "✅ | '%1' কমান্ডটির ছাড় তুলে নেওয়া হয়েছে।",
      ignoreCmdNotIn: "⚠ | '%1' কমান্ডটি ছাড় তালিকায় নেই।",
      noCmd: "⚠ | অনুগ্রহ করে একটি কমান্ডের নাম দিন।",
      currentStatus: "🔄 | হোয়াইটলিস্ট স্ট্যাটাস:\n- ইউজার হোয়াইটলিস্ট: %1\n- থ্রেড হোয়াইটলিস্ট: %2\n- ছাড়প্রাপ্ত কমান্ড: %3",
    }
  },

  onStart: async function ({ message, args, usersData, threadsData, event, getLang }) {
    const { config } = global.GoatBot;
    // Use the exact keys the bot core reads (whiteListMode / whiteListModeThread)
    config.whiteListMode = config.whiteListMode || {};
    config.whiteListModeThread = config.whiteListModeThread || {};
    if (typeof config.whiteListMode.enable !== "boolean") config.whiteListMode.enable = false;
    if (!Array.isArray(config.whiteListMode.whiteListIds)) config.whiteListMode.whiteListIds = [];
    if (!Array.isArray(config.whiteListMode.ignoreCommand)) config.whiteListMode.ignoreCommand = [];
    if (typeof config.whiteListModeThread.enable !== "boolean") config.whiteListModeThread.enable = false;
    if (!Array.isArray(config.whiteListModeThread.whiteListThreadIds)) config.whiteListModeThread.whiteListThreadIds = [];
    // thin aliases so the rest of this file stays readable
    const wl = {
      get status() { return config.whiteListMode.enable; }, set status(v) { config.whiteListMode.enable = v; },
      get ids() { return config.whiteListMode.whiteListIds; },
      get ignoreCommand() { return config.whiteListMode.ignoreCommand; },
      get threadStatus() { return config.whiteListModeThread.enable; }, set threadStatus(v) { config.whiteListModeThread.enable = v; },
      get threadIds() { return config.whiteListModeThread.whiteListThreadIds; }
    };
    config.whitelist = undefined; delete config.whitelist;

    const saveConfig = () => fs.writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));

    const sub = (args[0] || "").toLowerCase();

    switch (sub) {
      case "on": {
        wl.status = true;
        saveConfig();
        return message.reply(getLang("toggledOn"));
      }

      case "off": {
        wl.status = false;
        saveConfig();
        return message.reply(getLang("toggledOff"));
      }

      case "add": case "-a": case "+": {
        let uids = Object.keys(event.mentions || {}).length ? Object.keys(event.mentions) : (event.messageReply ? [String(event.messageReply.senderID)] : args.slice(1).filter(arg => !isNaN(arg)).map(String));
        if (!uids.length) return message.reply(getLang("missingIdAdd"));
        const notAdminIds = [], authorIds = [];
        for (const uid of uids) (wl.ids.includes(uid) ? authorIds : notAdminIds).push(uid);
        wl.ids.push(...notAdminIds);
        const getNames = await Promise.all(uids.map(uid => usersData.getName(uid).then(name => ({ uid, name })).catch(() => ({ uid, name: uid }))));
        saveConfig();
        return message.reply(
          (notAdminIds.length ? getLang("added", notAdminIds.length, getNames.filter(u => notAdminIds.includes(u.uid)).map(({ uid, name }) => `• ${name} (${uid})`).join("\n")) : "") +
          (authorIds.length ? getLang("alreadyAdmin", authorIds.length, authorIds.map(uid => `• ${uid}`).join("\n")) : "")
        );
      }

      case "remove": case "-r": case "-": {
        let uids = Object.keys(event.mentions || {}).length ? Object.keys(event.mentions) : (event.messageReply ? [String(event.messageReply.senderID)] : args.slice(1).filter(arg => !isNaN(arg)).map(String));
        if (!uids.length) return message.reply(getLang("missingIdRemove"));
        const notAdminIds = [], authorIds = [];
        for (const uid of uids) (wl.ids.includes(uid) ? authorIds : notAdminIds).push(uid);
        for (const uid of authorIds) {
          const idx = wl.ids.indexOf(uid);
          if (idx !== -1) wl.ids.splice(idx, 1);
        }
        const getNames = await Promise.all(authorIds.map(uid => usersData.getName(uid).then(name => ({ uid, name })).catch(() => ({ uid, name: uid }))));
        saveConfig();
        return message.reply(
          (authorIds.length ? getLang("removed", authorIds.length, getNames.map(({ uid, name }) => `• ${name} (${uid})`).join("\n")) : "") +
          (notAdminIds.length ? getLang("notAdmin", notAdminIds.length, notAdminIds.map(uid => `• ${uid}`).join("\n")) : "")
        );
      }

      case "list": case "-l": {
        if (!wl.ids.length) return message.reply(getLang("listAdmin", " (None)"));
        const getNames = await Promise.all(wl.ids.map(uid => usersData.getName(uid).then(name => ({ uid, name })).catch(() => ({ uid, name: uid }))));
        return message.reply(getLang("listAdmin", getNames.map(({ uid, name }) => `• ${name} (${uid})`).join("\n")));
      }

      case "threadon": case "ton": {
        wl.threadStatus = true;
        saveConfig();
        return message.reply(getLang("threadToggledOn"));
      }

      case "threadoff": case "toff": {
        wl.threadStatus = false;
        saveConfig();
        return message.reply(getLang("threadToggledOff"));
      }

      case "threadadd": case "tadd": case "+t": {
        const tid = args[1] || String(event.threadID);
        if (wl.threadIds.includes(tid)) return message.reply(getLang("threadAlreadyAdded", tid));
        wl.threadIds.push(tid);
        saveConfig();
        return message.reply(getLang("threadAdded", tid));
      }

      case "threadremove": case "tremove": case "-t": {
        const tid = args[1] || String(event.threadID);
        const idx = wl.threadIds.indexOf(tid);
        if (idx === -1) return message.reply(getLang("threadNotAdded", tid));
        wl.threadIds.splice(idx, 1);
        saveConfig();
        return message.reply(getLang("threadRemoved", tid));
      }

      case "threadlist": case "tlist": {
        if (!wl.threadIds.length) return message.reply(getLang("noThreads"));
        const list = wl.threadIds.map(id => `• ${id}`).join("\n");
        return message.reply(getLang("listThread", list));
      }

      case "ignore": {
        const cmd = args[1];
        if (!cmd) return message.reply(getLang("noCmd"));
        if (wl.ignoreCommand.includes(cmd)) return message.reply(getLang("ignoreCmdExists", cmd));
        wl.ignoreCommand.push(cmd);
        saveConfig();
        return message.reply(getLang("ignoreCmdAdded", cmd));
      }

      case "unignore": {
        const cmd = args[1];
        if (!cmd) return message.reply(getLang("noCmd"));
        const idx = wl.ignoreCommand.indexOf(cmd);
        if (idx === -1) return message.reply(getLang("ignoreCmdNotIn", cmd));
        wl.ignoreCommand.splice(idx, 1);
        saveConfig();
        return message.reply(getLang("ignoreCmdRemoved", cmd));
      }

      default: {
        const userStatus = wl.status ? "ON ✅" : "OFF ❌";
        const threadStatus = wl.threadStatus ? "ON ✅" : "OFF ❌";
        const ignored = wl.ignoreCommand.length ? wl.ignoreCommand.join(", ") : "None";
        return message.reply(getLang("currentStatus", userStatus, threadStatus, ignored));
      }
    }
  }
};
