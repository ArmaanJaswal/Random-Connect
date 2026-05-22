// =========================
// SERVER
// =========================

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// ✅ Allow your deployed frontend URL + localhost for dev
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  // Add your Vercel/Netlify URL here after deploying, e.g.:
  // "https://your-app.vercel.app",
  process.env.FRONTEND_URL,         // set this env var on Render/Railway
].filter(Boolean);

app.use(cors({ origin: ALLOWED_ORIGINS, methods: ["GET", "POST"] }));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
  },
});

// =========================
// OTP STORAGE
// =========================
const otpStore = {};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,   // Use Gmail App Password, NOT your real password
  },
});

transporter.verify((err) => {
  if (err) console.error("Mail server error:", err);
  else     console.log("✅ Mail server ready");
});

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// =========================
// SEND OTP
// =========================
app.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    const otp = generateOTP();

    otpStore[email] = {
      otp,
      verified: false,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    await transporter.sendMail({
      from:    process.env.EMAIL_USER,
      to:      email,
      subject: "Your OTP Code",
      html: `
        <div style="font-family:sans-serif;max-width:400px;margin:auto;padding:32px;border-radius:16px;border:1px solid #eee">
          <h2 style="margin-bottom:8px">Verification Code</h2>
          <p style="color:#555">Use this OTP to verify your identity. It expires in 5 minutes.</p>
          <div style="font-size:40px;font-weight:bold;letter-spacing:8px;text-align:center;padding:24px 0;color:#2563eb">
            ${otp}
          </div>
          <p style="color:#999;font-size:12px">If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
});

// =========================
// VERIFY OTP
// =========================
app.post("/verify-otp", (req, res) => {
  try {
    const { email, otp } = req.body;

    const storedData = otpStore[email];

    if (!storedData) {
      return res.status(400).json({ success: false, message: "OTP not found. Please request a new one." });
    }

    if (Date.now() > storedData.expiresAt) {
      delete otpStore[email];
      return res.status(400).json({ success: false, message: "OTP expired. Please request a new one." });
    }

    if (storedData.otp === otp) {
      otpStore[email].verified = true;
      return res.json({ success: true, message: "OTP verified successfully" });
    }

    return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// =========================
// MATCH USERS
// =========================
let group = [];

const matchUsers = () => {
  if (group.length >= 2) {
    const user1 = group.shift();
    const user2 = group.shift();

    const room = `${user1.id}+${user2.id}`;

    user1.join(room);
    user2.join(room);

    user1.currentRoom = room;
    user2.currentRoom = room;

    console.log(`Room Created: ${room}`);

    io.to(room).emit("receive-message", {
      text: "You are now connected with a stranger. Say hi! 👋",
      senderId: "system",
    });

    io.to(room).emit("matched");
  }
};

// =========================
// SOCKET.IO
// =========================
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  group.push(socket);
  matchUsers();

  socket.on("send-message", (message) => {
    const room = socket.currentRoom;
    if (room) {
      io.to(room).emit("receive-message", { text: message.text, senderId: socket.id });
    }
  });

  socket.on("offer", (offer) => {
    const room = socket.currentRoom;
    if (room) socket.to(room).emit("offer", offer);
  });

  socket.on("answer", (answer) => {
    const room = socket.currentRoom;
    if (room) socket.to(room).emit("answer", answer);
  });

  socket.on("sendCandidate", (candidate) => {
    const room = socket.currentRoom;
    if (room) socket.to(room).emit("receiveCandidate", candidate);
  });

  socket.on("next-user", () => {
    const room = socket.currentRoom;
    if (room) {
      socket.leave(room);
      socket.to(room).emit("partner-disconnected");
      socket.currentRoom = null;
    }
    group.push(socket);
    matchUsers();
  });

  socket.on("disconnect", () => {
    console.log(`User Disconnected: ${socket.id}`);
    group = group.filter((u) => u.id !== socket.id);
    const room = socket.currentRoom;
    if (room) socket.to(room).emit("partner-disconnected");
  });
});

// ✅ Use PORT from env (required by Render/Railway)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});