
"use strict";

const { createCanvas } = require("canvas");
const fs = require("fs-extra");
const path = require("path");

const START_TIME = Date.now();

module.exports = {
  config: {
    name: "rtm",
    aliases: ["uptime"],
    version: "4.0.0",
    author: "EGO",
    countDown: 5,
    role: 0,
    shortDescription: "EGO Premium Uptime",
    category: "system",
    guide: "{p}rtm"
  },

  onStart: async function ({ api, event }) {
    const { threadID, messageID } = event;
    const cache = path.join(__dirname, "cache");
    const filePath = path.join(cache, "ego-rtm.png");
    let loading;

    try {
      await fs.ensureDir(cache);

      loading = await api.sendMessage(
        "⚡ 𝙀𝙂𝙊 𝙍𝙏𝙈\n▰▱▱▱▱▱▱▱▱▱ 20%",
        threadID
      );

      const frames = [
        "⚡ 𝙀𝙂𝙊 𝙍𝙏𝙈\n▰▰▰▰▱▱▱▱▱▱ 40%",
        "⚡ 𝙀𝙂𝙊 𝙍𝙏𝙈\n▰▰▰▰▰▰▱▱▱▱ 60%",
        "⚡ 𝙀𝙂𝙊 𝙍𝙏𝙈\n▰▰▰▰▰▰▰▰▱▱ 80%",
        "⚡ 𝙀𝙂𝙊 𝙍𝙏𝙈\n▰▰▰▰▰▰▰▰▰▰ 100%"
      ];

      for (const frame of frames) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await api.editMessage(frame, loading.messageID);
      }

      const now = new Date();

      const bdTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Dhaka",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      }).format(now);

      const bdDate = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Dhaka",
        day: "2-digit",
        month: "long",
        year: "numeric"
      }).format(now);

      const uptime = Math.floor(
        (Date.now() - START_TIME) / 1000
      );

      const h = String(Math.floor(uptime / 3600)).padStart(2, "0");
      const m = String(Math.floor((uptime % 3600) / 60)).padStart(2, "0");
      const s = String(uptime % 60).padStart(2, "0");

      const canvas = createCanvas(1702, 630);
      const ctx = canvas.getContext("2d");

      const w = canvas.width;
      const height = canvas.height;

      // Premium Background
      const bg = ctx.createLinearGradient(0, 0, w, height);
      bg.addColorStop(0, "#020611");
      bg.addColorStop(0.5, "#07172d");
      bg.addColorStop(1, "#010309");

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, height);

      // Background glow
      ctx.fillStyle = "rgba(0,220,255,0.08)";
      ctx.beginPath();
      ctx.arc(200, 100, 300, 0, Math.PI * 2);
      ctx.fill();

      // Neon border
      ctx.strokeStyle = "#00eaff";
      ctx.lineWidth = 5;
      ctx.shadowColor = "#00dfff";
      ctx.shadowBlur = 25;

      roundRect(ctx, 20, 20, w - 40, height - 40, 35);
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Cute Robot pointing toward timer
      drawRobot(ctx, 1400, 140);

      // Timer
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.font = "bold 145px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#00dfff";
      ctx.shadowBlur = 30;

      ctx.fillText(`${h}:${m}:${s}`, 820, 250);

      ctx.shadowBlur = 0;

      // Labels
      ctx.font = "bold 30px Arial";
      ctx.fillStyle = "#00eaff";

      ctx.fillText("HOURS", 450, 350);
      ctx.fillText("MINUTE", 820, 350);
      ctx.fillText("SECOND", 1190, 350);

      // Bangladesh Time
      ctx.font = "bold 30px Arial";
      ctx.fillStyle = "#ffffff";

      ctx.fillText(`BANGLADESH TIME  ${bdTime}`, 820, 420);

      // Date
      ctx.font = "26px Arial";
      ctx.fillStyle = "#a8dfff";

      ctx.fillText(`DATE  ${bdDate}`, 820, 470);

      // Creator
      ctx.font = "italic bold 38px Arial";
      ctx.fillStyle = "#00eaff";
      ctx.shadowColor = "#00dfff";
      ctx.shadowBlur = 20;

      ctx.fillText("Create By Ego", 820, 550);

      ctx.shadowBlur = 0;

      // Save
      await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(filePath);
        canvas.createPNGStream().pipe(output);
        output.on("finish", resolve);
        output.on("error", reject);
      });

      await api.unsendMessage(loading.messageID);

      await api.sendMessage(
        {
          attachment: fs.createReadStream(filePath)
        },
        threadID,
        messageID
      );

      setTimeout(() => {
        fs.remove(filePath).catch(() => {});
      }, 10000);

    } catch (error) {
      console.error(error);

      if (loading && loading.messageID) {
        api.unsendMessage(loading.messageID).catch(() => {});
      }

      api.sendMessage("❌ RTM ERROR!", threadID, messageID);
    }
  }
};

// Cute Robot Pointing at Timer
function drawRobot(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);

  // Antenna
  ctx.strokeStyle = "#00eaff";
  ctx.lineWidth = 7;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -35);
  ctx.stroke();

  ctx.fillStyle = "#ff4dff";
  ctx.beginPath();
  ctx.arc(0, -45, 12, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = "#102a45";
  ctx.strokeStyle = "#00eaff";
  ctx.lineWidth = 7;

  roundRect(ctx, -100, 0, 200, 145, 35);
  ctx.fill();
  ctx.stroke();

  // Face
  ctx.fillStyle = "#020914";
  roundRect(ctx, -80, 20, 160, 105, 25);
  ctx.fill();

  // Eyes
  ctx.fillStyle = "#00eaff";
  ctx.shadowColor = "#00eaff";
  ctx.shadowBlur = 20;

  ctx.beginPath();
  ctx.arc(-40, 65, 17, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(40, 65, 17, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;

  // Cute smile
  ctx.strokeStyle = "#ff5cff";
  ctx.lineWidth = 6;

  ctx.beginPath();
  ctx.arc(0, 80, 25, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Body
  ctx.fillStyle = "#102a45";
  ctx.strokeStyle = "#00eaff";
  ctx.lineWidth = 7;

  roundRect(ctx, -75, 165, 150, 125, 25);
  ctx.fill();
  ctx.stroke();

  // Body light
  ctx.fillStyle = "#ff4dff";

  ctx.beginPath();
  ctx.arc(0, 220, 15, 0, Math.PI * 2);
  ctx.fill();

  // Left arm
  ctx.strokeStyle = "#00eaff";
  ctx.lineWidth = 16;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(-75, 190);
  ctx.lineTo(-105, 245);
  ctx.stroke();

  // RIGHT ARM POINTING LEFT TOWARD TIMER
  ctx.strokeStyle = "#00eaff";
  ctx.lineWidth = 18;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(75, 190);
  ctx.lineTo(115, 150);
  ctx.lineTo(200, 150);
  ctx.stroke();

  // Pointing finger
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 15;

  ctx.beginPath();
  ctx.moveTo(200, 150);
  ctx.lineTo(240, 150);
  ctx.stroke();

  // Finger tip
  ctx.fillStyle = "#00eaff";

  ctx.beginPath();
  ctx.arc(240, 150, 9, 0, Math.PI * 2);
  ctx.fill();

  // Feet
  ctx.fillStyle = "#00dfff";

  roundRect(ctx, -65, 290, 50, 20, 10);
  ctx.fill();

  roundRect(ctx, 15, 290, 50, 20, 10);
  ctx.fill();

  ctx.restore();
}

// Rounded Rectangle
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();

  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);

  ctx.quadraticCurveTo(
    x + width, y,
    x + width, y + radius
  );

  ctx.lineTo(x + width, y + height - radius);

  ctx.quadraticCurveTo(
    x + width, y + height,
    x + width - radius, y + height
  );

  ctx.lineTo(x + radius, y + height);

  ctx.quadraticCurveTo(
    x, y + height,
    x, y + height - radius
  );

  ctx.lineTo(x, y + radius);

  ctx.quadraticCurveTo(
    x, y,
    x + radius, y
  );

  ctx.closePath();
}
