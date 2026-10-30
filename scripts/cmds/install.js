
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const cheerio = require("cheerio");
const { exec } = require("child_process");
const Module = require("module");

const { GoatBot } = global;

// ==================== LOADING ANIMATION ====================

async function createLoading(message) {
    const stages = [
        "▰▰▱▱▱▱▱▱▱▱ 20%",
        "▰▰▰▰▱▱▱▱▱▱ 40%",
        "▰▰▰▰▰▰▱▱▱▱ 60%",
        "▰▰▰▰▰▰▰▰▱▱ 80%",
        "▰▰▰▰▰▰▰▰▰▰ 100%"
    ];

    const sent = await message.reply(stages[0]);
    const messageID = sent?.messageID || sent?.messageId;

    let stopped = false;

    const animation = (async () => {
        for (let i = 1; i < stages.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));

            if (stopped || !messageID)
                break;

            await new Promise(resolve => {
                message.edit(stages[i], messageID, () => resolve());
            });
        }
    })();

    return {
        stop: async () => {
            stopped = true;
            await animation.catch(() => {});

            if (messageID) {
                await new Promise(resolve => {
                    message.unsend(messageID, () => resolve());
                });
            }
        }
    };
}

// ==================== ORIGINAL FUNCTIONS ====================

function getDomain(url) {
    try {
        return new URL(url).hostname
            .replace(/^www\./, "")
            .toLowerCase();
    }
    catch {
        return null;
    }
}

function isURL(str) {
    try {
        new URL(str);
        return true;
    }
    catch {
        return false;
    }
}

function extractUrlFromText(text) {
    const match = String(text || "").match(
        /https?:\/\/[^\s<>"']+/i
    );

    if (!match)
        return null;

    return match[0].replace(/[),.!?]+$/, "");
}

function normalizeFileName(fileName) {
    let name = String(fileName || "").trim();
    name = path.basename(name);

    if (!name.toLowerCase().endsWith(".js"))
        name += ".js";

    return name;
}

function extractCommandName(code) {
    if (typeof code !== "string")
        return null;

    const patterns = [
        /name\s*:\s*["'`]([^"'`]+)["'`]/i,
        /name\s*:\s*`([^`]+)`/i
    ];

    for (const pattern of patterns) {
        const match = code.match(pattern);

        if (match && match[1]) {
            const name = match[1].trim();

            if (/^[a-zA-Z0-9_\-]+$/.test(name))
                return `${name}.js`;
        }
    }

    return null;
}

function cleanCodeResponse(code, contentType = "") {
    if (typeof code !== "string")
        return null;

    let result = code.trim();

    if (
        contentType.includes("text/html") &&
        !result.includes("module.exports") &&
        !result.includes("exports.")
    ) {
        const $ = cheerio.load(result);
        const pre = $("pre").first().text().trim();

        if (pre)
            result = pre;
        else {
            const content = $("#content").text().trim();

            if (content)
                result = content;
        }
    }

    if (
        result.startsWith("```") &&
        result.endsWith("```")
    ) {
        result = result
            .replace(/^```(?:javascript|js)?\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();
    }

    return result;
}

async function fetchCodeFromUrl(url) {
    const domain = getDomain(url);

    if (!domain)
        return null;

    let fixedUrl = url;

    if (
        domain === "pastebin.com" &&
        !url.includes("/raw/")
    ) {
        const parsed = new URL(url);
        const parts = parsed.pathname.split("/").filter(Boolean);

        if (parts[0])
            fixedUrl = `https://pastebin.com/raw/${parts[0]}`;
    }

    if (
        domain === "github.com" &&
        url.includes("/blob/")
    ) {
        fixedUrl = url
            .replace(
                "https://github.com/",
                "https://raw.githubusercontent.com/"
            )
            .replace("/blob/", "/");
    }

    if (
        domain === "gist.github.com" &&
        !url.includes("raw")
    ) {
        fixedUrl = `${url.replace(/\/$/, "")}/raw`;
    }

    try {
        const response = await axios.get(fixedUrl, {
            timeout: 30000,
            maxContentLength: 5 * 1024 * 1024,
            maxBodyLength: 5 * 1024 * 1024,
            responseType: "text",
            validateStatus: status => status >= 200 && status < 400
        });

        let code = typeof response.data === "string"
            ? response.data
            : String(response.data);

        code = cleanCodeResponse(
            code,
            response.headers?.["content-type"] || ""
        );

        return code;
    }
    catch (error) {
        return null;
    }
}

function runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
        exec(
            command,
            {
                ...options,
                windowsHide: true,
                maxBuffer: 1024 * 1024 * 10
            },
            (error, stdout, stderr) => {
                if (error) {
                    error.stdout = stdout;
                    error.stderr = stderr;
                    return reject(error);
                }

                resolve({ stdout, stderr });
            }
        );
    });
}

function getRequiredPackages(code) {
    const packages = new Set();

    const patterns = [
        /require\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
        /import\s+(?:[^"'`]+?\s+from\s+)?["'`]([^"'`]+)["'`]/g
    ];

    for (const regex of patterns) {
        let match;

        while ((match = regex.exec(code)) !== null) {
            let packageName = match[1];

            if (!packageName)
                continue;

            if (
                packageName.startsWith(".") ||
                packageName.startsWith("/") ||
                path.isAbsolute(packageName)
            )
                continue;

            if (Module.builtinModules.includes(packageName))
                continue;

            if (packageName.startsWith("node:"))
                continue;

            if (packageName.startsWith("@")) {
                packageName = packageName
                    .split("/")
                    .slice(0, 2)
                    .join("/");
            }
            else {
                packageName = packageName.split("/")[0];
            }

            packages.add(packageName);
        }
    }

    return [...packages];
}

async function installMissingPackages(code) {
    const packages = getRequiredPackages(code);

    if (!packages.length)
        return [];

    const installed = [];

    for (const packageName of packages) {
        let exists = false;

        try {
            require.resolve(packageName, {
                paths: [process.cwd()]
            });
            exists = true;
        }
        catch {
            exists = false;
        }

        if (exists)
            continue;

        try {
            await runCommand(
                `npm install ${packageName} --save`,
                { cwd: process.cwd() }
            );

            installed.push(packageName);
        }
        catch (error) {
            throw new Error(
                `Failed to install package "${packageName}"` +
                (error.stderr
                    ? `\n${String(error.stderr).trim()}`
                    : "")
            );
        }
    }

    return installed;
}

function validateCommandExport(command) {
    if (!command || typeof command !== "object")
        throw new Error("Command must export an object.");

    const config = command.config;

    if (!config)
        throw new Error("Command config is undefined.");

    if (
        typeof config.name !== "string" ||
        !config.name.trim()
    )
        throw new Error("Command config.name is missing.");

    if (!config.category || typeof config.category !== "string")
        throw new Error(
            `Command "${config.name}" is missing config.category.`
        );

    if (typeof command.onStart !== "function")
        throw new Error(
            `Command "${config.name}" must have onStart().`
        );

    const role = Number(config.role ?? 0);

    if (
        !Number.isInteger(role) ||
        role < 0 ||
        role > 2
    )
        throw new Error(
            `Invalid role for "${config.name}". Use 0, 1 or 2.`
        );

    config.role = role;
    return true;
}

function removeCommandRegistrations(commandName, command) {
    const lowerName = String(commandName).toLowerCase();

    if (GoatBot.commands && GoatBot.commands.has(lowerName))
        GoatBot.commands.delete(lowerName);

    if (GoatBot.aliases) {
        for (const [alias, target] of GoatBot.aliases.entries()) {
            if (
                String(target).toLowerCase() === lowerName ||
                (
                    command?.config?.aliases &&
                    command.config.aliases.includes(alias)
                )
            ) {
                GoatBot.aliases.delete(alias);
            }
        }
    }

    if (Array.isArray(GoatBot.onChat)) {
        GoatBot.onChat = GoatBot.onChat.filter(
            name => String(name).toLowerCase() !== lowerName
        );
    }

    if (Array.isArray(GoatBot.onEvent)) {
        GoatBot.onEvent = GoatBot.onEvent.filter(
            name => String(name).toLowerCase() !== lowerName
        );
    }

    if (Array.isArray(GoatBot.onAnyEvent)) {
        GoatBot.onAnyEvent = GoatBot.onAnyEvent.filter(
            name => String(name).toLowerCase() !== lowerName
        );
    }

    if (Array.isArray(GoatBot.onFirstChat)) {
        GoatBot.onFirstChat = GoatBot.onFirstChat.filter(
            item => String(item?.commandName).toLowerCase() !== lowerName
        );
    }

    if (Array.isArray(GoatBot.commandFilesPath)) {
        GoatBot.commandFilesPath = GoatBot.commandFilesPath.filter(
            item => !item?.commandName?.some(
                name => String(name).toLowerCase() === lowerName
            )
        );
    }
}

function registerCommand(command, filePath) {
    validateCommandExport(command);

    const commandName = command.config.name.trim();
    const lowerName = commandName.toLowerCase();

    command.location = filePath;

    if (!GoatBot.commands)
        throw new Error("GoatBot.commands is not initialized.");

    if (!GoatBot.aliases)
        throw new Error("GoatBot.aliases is not initialized.");

    const aliases = Array.isArray(command.config.aliases)
        ? command.config.aliases
        : [];

    const validAliases = [];

    for (const alias of aliases) {
        if (typeof alias !== "string" || !alias.trim())
            throw new Error(`Invalid alias in "${commandName}".`);

        const aliasName = alias.trim().toLowerCase();

        if (aliasName === lowerName)
            throw new Error(`Alias "${alias}" is same as command name.`);

        const duplicateAlias = aliases.filter(
            item => String(item).toLowerCase() === aliasName
        ).length > 1;

        if (duplicateAlias)
            throw new Error(`Duplicate alias "${alias}".`);

        const existingAlias = GoatBot.aliases.get(aliasName);

        if (
            existingAlias &&
            String(existingAlias).toLowerCase() !== lowerName
        ) {
            throw new Error(
                `Alias "${alias}" already belongs to "${existingAlias}".`
            );
        }

        validAliases.push(aliasName);
    }

    GoatBot.commands.set(lowerName, command);

    for (const alias of validAliases)
        GoatBot.aliases.set(alias, lowerName);

    if (typeof command.onChat === "function") {
        if (!Array.isArray(GoatBot.onChat))
            GoatBot.onChat = [];

        if (!GoatBot.onChat.some(
            name => String(name).toLowerCase() === lowerName
        )) {
            GoatBot.onChat.push(lowerName);
        }
    }

    if (typeof command.onFirstChat === "function") {
        if (!Array.isArray(GoatBot.onFirstChat))
            GoatBot.onFirstChat = [];

        GoatBot.onFirstChat.push({
            commandName: lowerName,
            threadIDsChattedFirstTime: []
        });
    }

    if (typeof command.onEvent === "function") {
        if (!Array.isArray(GoatBot.onEvent))
            GoatBot.onEvent = [];

        if (!GoatBot.onEvent.some(
            name => String(name).toLowerCase() === lowerName
        )) {
            GoatBot.onEvent.push(lowerName);
        }
    }

    if (typeof command.onAnyEvent === "function") {
        if (!Array.isArray(GoatBot.onAnyEvent))
            GoatBot.onAnyEvent = [];

        if (!GoatBot.onAnyEvent.some(
            name => String(name).toLowerCase() === lowerName
        )) {
            GoatBot.onAnyEvent.push(lowerName);
        }
    }

    if (!Array.isArray(GoatBot.commandFilesPath))
        GoatBot.commandFilesPath = [];

    GoatBot.commandFilesPath = GoatBot.commandFilesPath.filter(
        item => !item?.commandName?.some(
            name => String(name).toLowerCase() === lowerName
        )
    );

    GoatBot.commandFilesPath.push({
        filePath: path.normalize(filePath),
        commandName: [commandName, ...validAliases]
    });

    return command;
}

function clearRequireCache(filePath) {
    try {
        const resolved = require.resolve(filePath);
        delete require.cache[resolved];
    }
    catch {
        // File is not in require cache.
    }
}

async function callOnLoad(command, api) {
    if (typeof command.onLoad !== "function")
        return;

    await command.onLoad({
        api,
        threadModel: global.threadModel,
        userModel: global.userModel,
        dashBoardModel: global.dashBoardModel,
        globalModel: global.globalModel,
        threadsData: global.db?.threadsData,
        usersData: global.db?.usersData,
        dashBoardData: global.db?.dashBoardData,
        globalData: global.db?.globalData
    });
}

async function loadInstalledCommand(filePath, api, overwrite = false) {
    const normalizedPath = path.normalize(filePath);

    clearRequireCache(normalizedPath);

    let command;

    try {
        command = require(normalizedPath);
    }
    catch (error) {
        throw new Error(
            `Command could not be loaded.\n${error.stack || error.message}`
        );
    }

    validateCommandExport(command);

    const commandName = command.config.name.trim();
    const lowerName = commandName.toLowerCase();
    const existing = GoatBot.commands?.get(lowerName);

    if (existing && !overwrite)
        throw new Error(`Command "${commandName}" is already loaded.`);

    if (existing)
        removeCommandRegistrations(commandName, existing);

    try {
        registerCommand(command, normalizedPath);
        await callOnLoad(command, api);
        return command;
    }
    catch (error) {
        removeCommandRegistrations(commandName, command);
        throw error;
    }
}

function ensureCommandDirectory() {
    const dir = path.join(process.cwd(), "scripts", "cmds");
    fs.ensureDirSync(dir);
    return dir;
}

function getInstallMessage(type, fileName, extra = "") {
    if (type === "success") {
        return (
            `✅ 𝐈𝐧𝐬𝐭𝐚𝐥𝐥𝐞𝐝: ${fileName}\n` +
            `📌 𝐒𝐭𝐚𝐭𝐮𝐬: 𝐑𝐞𝐚𝐝𝐲` +
            (extra ? `\n${extra}` : "")
        );
    }

    return (
        `❌ 𝐈𝐧𝐬𝐭𝐚𝐥𝐥 𝐟𝐚𝐢𝐥𝐞𝐝: ${fileName}\n` +
        `⚠️ ${extra || "Unknown error"}`
    );
}

// ==================== COMMAND ====================

module.exports = {
    config: {
        name: "install",
        version: "1.0.0",
        author: "𝐌𝐚𝐑𝐮𝐅",
        countDown: 3,
        role: 2,
        hasPrefix: false,
        description: "Install command via reply, code or URL",
        category: "owner"
    },

    onStart: async function ({
        args,
        message,
        event,
        api
    }) {
        let rawCode = "";
        let fileName = "";
        let loading = null;

        try {
            if (event.messageReply?.body) {
                const replyText = event.messageReply.body.trim();
                const url = extractUrlFromText(replyText);

                if (url) {
                    rawCode = await fetchCodeFromUrl(url);

                    if (!rawCode)
                        return message.reply(
                            "❌ 𝐅𝐚𝐢𝐥𝐞𝐝 𝐭𝐨 𝐟𝐞𝐭𝐜𝐡 𝐜𝐨𝐝𝐞 𝐟𝐫𝐨𝐦 𝐔𝐑𝐋."
                        );
                }
                else {
                    rawCode = replyText;
                }

                fileName = extractCommandName(rawCode);
            }
            else if (args[0] && isURL(args[0])) {
                rawCode = await fetchCodeFromUrl(args[0]);

                if (!rawCode)
                    return message.reply(
                        "❌ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐨𝐫 𝐮𝐧𝐫𝐞𝐚𝐜𝐡𝐚𝐛𝐥𝐞 𝐔𝐑𝐋."
                    );

                fileName = extractCommandName(rawCode);
            }
            else if (args.length >= 2) {
                fileName = normalizeFileName(args[0]);
                rawCode = args.slice(1).join(" ");
            }

            if (!rawCode) {
                return message.reply(
                    "⚠️ 𝐍𝐨 𝐜𝐨𝐝𝐞 𝐩𝐫𝐨𝐯𝐢𝐝𝐞𝐝.\n\n" +
                    "𝐔𝐬𝐚𝐠𝐞:\n" +
                    "• 𝐑𝐞𝐩𝐥𝐲 𝐭𝐨 𝐜𝐨𝐝𝐞/𝐔𝐑𝐋\n" +
                    "• 𝐢𝐧𝐬𝐭𝐚𝐥𝐥 <𝐔𝐑𝐋>\n" +
                    "• 𝐢𝐧𝐬𝐭𝐚𝐥𝐥 <𝐧𝐚𝐦𝐞.𝐣𝐬> <𝐜𝐨𝐝𝐞>"
                );
            }

            rawCode = cleanCodeResponse(rawCode);

            if (!rawCode)
                return message.reply("❌ 𝐂𝐨𝐦𝐦𝐚𝐧𝐝 𝐜𝐨𝐝𝐞 𝐢𝐬 𝐞𝐦𝐩𝐭𝐲.");

            try {
                new Function(rawCode);
            }
            catch (error) {
                return message.reply(
                    `❌ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐉𝐚𝐯𝐚𝐒𝐜𝐫𝐢𝐩𝐭.\n\n` +
                    `⚠️ ${error.message}`
                );
            }

            if (!fileName)
                fileName = extractCommandName(rawCode);

            if (!fileName) {
                return message.reply(
                    "❌ 𝐂𝐨𝐮𝐥𝐝 𝐧𝐨𝐭 𝐝𝐞𝐭𝐞𝐜𝐭 𝐜𝐨𝐦𝐦𝐚𝐧𝐝 𝐧𝐚𝐦𝐞.\n\n" +
                    "𝐌𝐚𝐤𝐞 𝐬𝐮𝐫𝐞 𝐭𝐡𝐞 𝐜𝐨𝐝𝐞 𝐡𝐚𝐬:\n\n" +
                    `module.exports.config = {\n` +
                    `  name: "example"\n` +
                    `};`
                );
            }

            fileName = normalizeFileName(fileName);

            if (
                fileName === "." ||
                fileName === ".." ||
                fileName.includes("/") ||
                fileName.includes("\\") ||
                !fileName.toLowerCase().endsWith(".js")
            ) {
                return message.reply("❌ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐜𝐨𝐦𝐦𝐚𝐧𝐝 𝐟𝐢𝐥𝐞𝐧𝐚𝐦𝐞.");
            }

            const commandDir = ensureCommandDirectory();
            const filePath = path.join(commandDir, fileName);

            const tempPath = path.join(
                commandDir,
                `.install-${Date.now()}-${fileName}`
            );

            fs.writeFileSync(tempPath, rawCode, "utf8");

            let testCommand;

            try {
                clearRequireCache(tempPath);
                testCommand = require(tempPath);
                validateCommandExport(testCommand);
            }
            catch (error) {
                clearRequireCache(tempPath);
                fs.removeSync(tempPath);

                return message.reply(
                    `❌ 𝐂𝐨𝐦𝐦𝐚𝐧𝐝 𝐯𝐚𝐥𝐢𝐝𝐚𝐭𝐢𝐨𝐧 𝐟𝐚𝐢𝐥𝐞𝐝.\n\n` +
                    `⚠️ ${error.message}`
                );
            }

            clearRequireCache(tempPath);
            fs.removeSync(tempPath);

            const detectedFileName = `${testCommand.config.name}.js`;

            if (fileName.toLowerCase() !== detectedFileName.toLowerCase())
                fileName = detectedFileName;

            const finalFilePath = path.join(commandDir, fileName);
            const commandName = testCommand.config.name.trim();
            const commandKey = commandName.toLowerCase();

            const existingCommand = GoatBot.commands?.get(commandKey);

            if (existingCommand) {
                return message.reply(
                    `⚠️ ${commandName} 𝐚𝐥𝐫𝐞𝐚𝐝𝐲 𝐞𝐱𝐢𝐬𝐭𝐬.\n\n` +
                    `𝐑𝐞𝐚𝐜𝐭 𝐭𝐨 𝐭𝐡𝐢𝐬 𝐦𝐞𝐬𝐬𝐚𝐠𝐞 𝐭𝐨 𝐨𝐯𝐞𝐫𝐰𝐫𝐢𝐭𝐞.`,
                    (err, info) => {
                        if (err || !info?.messageID)
                            return;

                        if (!GoatBot.onReaction)
                            return;

                        GoatBot.onReaction.set(info.messageID, {
                            commandName: "install",
                            author: event.senderID,
                            data: {
                                rawCode,
                                fileName
                            }
                        });
                    }
                );
            }

            // Loading starts when installation begins.
            loading = await createLoading(message);

            let installedPackages = [];

            try {
                installedPackages = await installMissingPackages(rawCode);
            }
            catch (error) {
                return message.reply(
                    getInstallMessage("error", fileName, error.message)
                );
            }

            fs.ensureDirSync(commandDir);
            fs.writeFileSync(finalFilePath, rawCode, "utf8");

            try {
                await loadInstalledCommand(finalFilePath, api, false);
            }
            catch (error) {
                try {
                    if (fs.existsSync(finalFilePath))
                        fs.removeSync(finalFilePath);
                }
                catch {
                    // Ignore cleanup error.
                }

                return message.reply(
                    getInstallMessage("error", fileName, error.message)
                );
            }

            let extra = "";

            if (installedPackages.length)
                extra = `📦 𝐃𝐞𝐩𝐞𝐧𝐝𝐞𝐧𝐜𝐢𝐞𝐬: ${installedPackages.join(", ")}`;

            return message.reply(
                getInstallMessage("success", fileName, extra)
            );
        }
        catch (error) {
            return message.reply(
                `❌ 𝐈𝐧𝐬𝐭𝐚𝐥𝐥𝐚𝐭𝐢𝐨𝐧 𝐟𝐚𝐢𝐥𝐞𝐝.\n\n` +
                `⚠️ ${error.message || "Unknown error"}`
            );
        }
        finally {
            if (loading)
                await loading.stop();
        }
    },

    onReaction: async function ({
        Reaction,
        event,
        message,
        api
    }) {
        if (event.userID !== Reaction.author)
            return;

        const data = Reaction.data || {};
        const rawCode = data.rawCode;
        let fileName = data.fileName;

        if (!rawCode || !fileName)
            return message.reply("❌ 𝐈𝐧𝐬𝐭𝐚𝐥𝐥 𝐝𝐚𝐭𝐚 𝐢𝐬 𝐦𝐢𝐬𝐬𝐢𝐧𝐠.");

        let loading = null;

        try {
            fileName = normalizeFileName(fileName);

            const commandDir = ensureCommandDirectory();

            // Loading starts when overwrite begins.
            loading = await createLoading(message);

            let installedPackages = [];

            try {
                installedPackages = await installMissingPackages(rawCode);
            }
            catch (error) {
                return message.reply(
                    `❌ 𝐃𝐞𝐩𝐞𝐧𝐝𝐞𝐧𝐜𝐲 𝐢𝐧𝐬𝐭𝐚𝐥𝐥 𝐟𝐚𝐢𝐥𝐞𝐝.\n\n` +
                    `⚠️ ${error.message}`
                );
            }

            const tempPath = path.join(
                commandDir,
                `.overwrite-${Date.now()}-${fileName}`
            );

            fs.writeFileSync(tempPath, rawCode, "utf8");

            let newCommand;

            try {
                clearRequireCache(tempPath);
                newCommand = require(tempPath);
                validateCommandExport(newCommand);
            }
            catch (error) {
                clearRequireCache(tempPath);
                fs.removeSync(tempPath);

                return message.reply(
                    `❌ 𝐎𝐯𝐞𝐫𝐰𝐫𝐢𝐭𝐞 𝐯𝐚𝐥𝐢𝐝𝐚𝐭𝐢𝐨𝐧 𝐟𝐚𝐢𝐥𝐞𝐝.\n\n` +
                    `⚠️ ${error.message}`
                );
            }

            clearRequireCache(tempPath);
            fs.removeSync(tempPath);

            fileName = `${newCommand.config.name}.js`;

            const finalPath = path.join(commandDir, fileName);
            const backupPath = `${finalPath}.install-backup`;

            const hadOldFile = fs.existsSync(finalPath);

            if (hadOldFile)
                fs.copyFileSync(finalPath, backupPath);

            try {
                fs.writeFileSync(finalPath, rawCode, "utf8");

                await loadInstalledCommand(finalPath, api, true);

                if (fs.existsSync(backupPath))
                    fs.removeSync(backupPath);

                let extra = "";

                if (installedPackages.length)
                    extra = `\n📦 𝐃𝐞𝐩𝐞𝐧𝐝𝐞𝐧𝐜𝐢𝐞𝐬: ${installedPackages.join(", ")}`;

                return message.reply(
                    `✅ 𝐎𝐯𝐞𝐫𝐰𝐫𝐢𝐭𝐭𝐞𝐧: ${fileName}\n` +
                    `📌 𝐒𝐭𝐚𝐭𝐮𝐬: 𝐑𝐞𝐚𝐝𝐲${extra}`
                );
            }
            catch (error) {
                try {
                    if (fs.existsSync(backupPath)) {
                        fs.copyFileSync(backupPath, finalPath);
                        fs.removeSync(backupPath);

                        clearRequireCache(finalPath);

                        try {
                            await loadInstalledCommand(finalPath, api, true);
                        }
                        catch {
                            // Old command restore failed.
                        }
                    }
                }
                catch {
                    // Ignore restore error.
                }

                return message.reply(
                    `❌ 𝐎𝐯𝐞𝐫𝐰𝐫𝐢𝐭𝐞 𝐟𝐚𝐢𝐥𝐞𝐝: ${fileName}\n` +
                    `⚠️ ${error.message}`
                );
            }
        }
        catch (error) {
            return message.reply(
                `❌ 𝐎𝐯𝐞𝐫𝐰𝐫𝐢𝐭𝐞 𝐟𝐚𝐢𝐥𝐞𝐝.\n\n` +
                `⚠️ ${error.message}`
            );
        }
        finally {
            if (loading)
                await loading.stop();
        }
    }
};
