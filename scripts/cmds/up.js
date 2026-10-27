const os = require("os");
const fs = require("fs");
const path = require("path");
const { createCanvas } = require("canvas");

module.exports = {
  config: {
    name: "up",
    aliases: ["uptime", "status", "sysinfo"],
    version: "16.0.0",
    author: "EGO",
    countDown: 5,
    role: 0,
    shortDescription: "EGO Live System Monitor",
    longDescription: "Real-time bot uptime and system dashboard",
    category: "system",
    guide: "{p}up"
  },

  onStart: async function ({ api, event }) {
    const threadID = event.threadID;
    const output = path.join(__dirname, "ego-monitor.png");
    let loadingID = null;

    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    const send = body => new Promise((resolve, reject) => {
      api.sendMessage(body, threadID, (err, info) => {
        if (err) return reject(err);
        resolve(info);
      });
    });

    const edit = (body, id) => new Promise((resolve, reject) => {
      if (typeof api.editMessage !== "function") {
        return reject(new Error("Message editing is not supported"));
      }
      api.editMessage(body, id, err => err ? reject(err) : resolve());
    });

    try {
      const loading = await send(
        "⚡ 𝙀𝙂𝙊 𝙎𝙔𝙎𝙏𝙀𝙈 𝙈𝙊𝙉𝙄𝙏𝙊𝙍\n\n" +
        "▰▰▱▱▱▱▱▱▱▱ 20%"
      );

      loadingID = loading && loading.messageID;

      const stages = [
        "▰▰▱▱▱▱▱▱▱▱ 20%",
        "▰▰▰▰▱▱▱▱▱▱ 40%",
        "▰▰▰▰▰▰▱▱▱▱ 60%",
        "▰▰▰▰▰▰▰▰▱▱ 80%",
        "▰▰▰▰▰▰▰▰▰▰ 100%"
      ];

      for (let index = 0; index < stages.length; index++) {
        if (index > 0) await wait(600);

        const loadingText =
          "⚡ 𝙀𝙂𝙊 𝙎𝙔𝙎𝙏𝙀𝙈 𝙈𝙊𝙉𝙄𝙏𝙊𝙍\n\n" +
          stages[index];

        if (loadingID) {
          try {
            await edit(loadingText, loadingID);
          } catch (_) {
            // Continue if editing is unsupported by this bot fork.
          }
        }
      }

      const info = getInfo();
      drawCard(info, output);

      await new Promise((resolve, reject) => {
        api.sendMessage({
          body:
            "⚡ 𝙀𝙂𝙊 𝙇𝙄𝙑𝙀 𝙎𝙔𝙎𝙏𝙀𝙈\n\n" +
            "🤖 BOT UPTIME: " + info.botUptime + "\n" +
            "🕒 STARTED AT: " + info.startedAt + "\n" +
            "🧠 BOT RAM: " + info.botRAM + "\n" +
            "💾 SERVER RAM: " + info.ramPercent + "%\n" +
            "🌡️ CPU TEMP: " + info.temperature + "\n\n" +
            "✨ CREATE BY EGO",
          attachment: fs.createReadStream(output)
        }, threadID, (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });

      if (loadingID) {
        try {
          await new Promise(resolve =>
            api.unsendMessage(loadingID, () => resolve())
          );
        } catch (_) {}
      }
    } catch (error) {
      if (loadingID) {
        try {
          api.unsendMessage(loadingID, () => {});
        } catch (_) {}
      }

      api.sendMessage(
        "❌ EGO MONITOR ERROR\n" + String(error.message || error),
        threadID
      );
    } finally {
      setTimeout(() => {
        try {
          if (fs.existsSync(output)) fs.unlinkSync(output);
        } catch (_) {}
      }, 10000);
    }
  }
};

function getInfo() {
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  const total = os.totalmem();
  const used = total - os.freemem();
  const cpus = os.cpus() || [];

  return {
    botUptime: formatTime(uptime),
    startedAt: new Date(Date.now() - uptime * 1000)
      .toLocaleString("en-GB", { hour12: false }),
    botRAM: formatBytes(memory.rss),
    heap: formatBytes(memory.heapUsed),
    serverRAM: formatBytes(used) + " / " + formatBytes(total),
    ramPercent: Math.round(used / total * 100),
    cpu: cpus[0] ? cpus[0].model : "Unknown CPU",
    cores: cpus.length,
    temperature: getTemperature(),
    hostname: os.hostname(),
    platform: os.type() + " " + os.release(),
    arch: os.arch(),
    node: process.version,
    serverUptime: formatTime(os.uptime())
  };
}

function getTemperature() {
  const files = [
    "/sys/class/thermal/thermal_zone0/temp",
    "/sys/class/hwmon/hwmon0/temp1_input"
  ];

  for (const file of files) {
    try {
      const n = Number(fs.readFileSync(file, "utf8").trim());
      if (n > 0) {
        return (n > 1000 ? n / 1000 : n).toFixed(1) + " °C";
      }
    } catch (_) {}
  }

  return "N/A";
}

function formatTime(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  const d = Math.floor(seconds / 86400);
  const h = Math.floor(seconds % 86400 / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = seconds % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

function formatBytes(bytes) {
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

function drawCard(i, file) {
  const W = 1200, H = 1050;
  const canvas = createCanvas(W, H);
  const c = canvas.getContext("2d");

  c.fillStyle = "#050712";
  c.fillRect(0, 0, W, H);

  glow(c, 160, 170, 280, "#00ffd5", 0.24);
  glow(c, 1000, 430, 300, "#008cff", 0.19);
  glow(c, 200, 900, 250, "#c342ff", 0.2);

  c.save();
  c.strokeStyle = "#00ffd5";
  c.lineWidth = 3;
  c.shadowColor = "#00ffd5";
  c.shadowBlur = 25;
  roundRect(c, 28, 28, W - 56, H - 56, 32);
  c.stroke();
  c.restore();

  txt(c, "EGO // SYSTEM MONITOR", 72, 90, 30, "#00ffd5", 800);
  txt(c, "PREMIUM EDITION", 1128, 90, 21, "#b5c9df", 700, "right");
  txt(c, "SYSTEM STATUS", 72, 170, 64, "#f5f8ff", 900);
  txt(c, "LIVE BOT PERFORMANCE DASHBOARD", 76, 220, 26, "#9aabc1", 500);
  line(c, 72, 252, 1128, 252, "#00ffd5", 3);

  panel(c, 72, 285, 510, 225);
  txt(c, "BOT PROCESS UPTIME", 102, 330, 25, "#00ffd5", 800);
  txt(c, i.botUptime, 102, 390, 37, "#ffffff", 800);
  txt(c, "Current process runtime", 102, 440, 20, "#a4b5ca", 500);
  txt(c, "STARTED AT", 102, 480, 18, "#00ffd5", 700);
  txt(c, i.startedAt, 245, 480, 17, "#ffffff", 600);

  panel(c, 610, 285, 518, 225);
  txt(c, "SERVER MEMORY", 642, 330, 25, "#00ffd5", 800);
  txt(c, i.ramPercent + "%", 642, 385, 43, "#ffffff", 800);
  bar(c, 642, 408, 452, 18, i.ramPercent / 100);
  txt(c, i.serverRAM, 642, 462, 20, "#a4b5ca", 600);
  txt(c, "BOT RAM: " + i.botRAM, 642, 492, 19, "#00ffd5", 700);

  panel(c, 72, 535, 1056, 155);
  txt(c, "PROCESSOR", 102, 580, 25, "#00ffd5", 800);
  txt(c, fit(i.cpu, 48), 102, 625, 28, "#ffffff", 700);
  txt(c, "LOGICAL CORES: " + i.cores, 102, 662, 21, "#69f5df", 600);

  panel(c, 72, 715, 1056, 225);
  txt(c, "DEVICE / RUNTIME INFORMATION", 102, 760, 25, "#00ffd5", 800);
  txt(c, "HOSTNAME", 102, 810, 18, "#8fa5bf", 700);
  txt(c, fit(i.hostname, 24), 245, 810, 19, "#ffffff", 600);
  txt(c, "PLATFORM", 650, 810, 18, "#8fa5bf", 700);
  txt(c, fit(i.platform, 28), 790, 810, 19, "#ffffff", 600);

  txt(c, "NODE VERSION", 102, 855, 18, "#8fa5bf", 700);
  txt(c, i.node, 270, 855, 20, "#ffffff", 600);
  txt(c, "ARCHITECTURE", 650, 855, 18, "#8fa5bf", 700);
  txt(c, i.arch, 820, 855, 20, "#ffffff", 600);

  txt(c, "CPU TEMPERATURE", 102, 900, 18, "#8fa5bf", 700);
  txt(c, i.temperature, 310, 900, 20, "#ffffff", 600);
  txt(c, "SERVER UPTIME", 650, 900, 18, "#8fa5bf", 700);
  txt(c, i.serverUptime, 820, 900, 20, "#ffffff", 600);

  line(c, 72, 965, 1128, 965, "#20434f", 2);
  txt(c, "CREATE BY EGO", 72, 1010, 32, "#c66bff", 900);
  txt(c, "● SYSTEM ONLINE", 1128, 1010, 22, "#00ffd5", 800, "right");

  fs.writeFileSync(file, canvas.toBuffer("image/png"));
}

function panel(c, x, y, w, h) {
  c.save();
  c.fillStyle = "rgba(13,23,42,0.96)";
  c.strokeStyle = "#17434d";
  c.lineWidth = 2;
  roundRect(c, x, y, w, h, 25);
  c.fill();
  c.shadowColor = "#00ffd5";
  c.shadowBlur = 10;
  c.stroke();
  c.restore();
}

function bar(c, x, y, w, h, value) {
  c.fillStyle = "#202d43";
  roundRect(c, x, y, w, h, h / 2);
  c.fill();

  const width = Math.max(0, Math.min(w, w * value));
  if (!width) return;

  const gradient = c.createLinearGradient(x, y, x + w, y);
  gradient.addColorStop(0, "#00ffd5");
  gradient.addColorStop(1, "#8c8bff");

  c.save();
  c.fillStyle = gradient;
  c.shadowColor = "#00ffd5";
  c.shadowBlur = 15;
  roundRect(c, x, y, width, h, h / 2);
  c.fill();
  c.restore();
}

function glow(c, x, y, r, color, alpha) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "transparent");
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

function line(c, x1, y1, x2, y2, color, width) {
  c.save();
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
  c.restore();
}

function txt(c, value, x, y, size, color, weight, align = "left") {
  c.save();
  c.font = `${weight} ${size}px Arial`;
  c.fillStyle = color;
  c.textAlign = align;
  c.shadowColor = color;
  c.shadowBlur = color === "#00ffd5" ? 6 : 0;
  c.fillText(String(value), x, y);
  c.restore();
}

function fit(value, max) {
  value = String(value);
  return value.length > max ? value.slice(0, max - 3) + "..." : value;
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
