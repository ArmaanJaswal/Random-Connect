// =========================
// SERVER
// =========================

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv"

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// OTP Storage
const otpStore={};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


transporter.verify((err, success) => {
  if (err) {
    console.log(err);
  } else {
    console.log("Mail server ready");
  }
});

// generating the otp
const generateOTP = () => {
  return Math.floor(
    100000 + Math.random() * 900000
  ).toString();
};

app.post(
  "/send-otp",
  async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email required",
        });
      }

      const otp = generateOTP();

      otpStore[email] = {
        otp,
        verified: false,
        expiresAt:
          Date.now() +
          5 * 60 * 1000,
      };

      await transporter.sendMail({
        from:
          process.env.EMAIL_USER,
        to: email,
        subject: "OTP Verification",
        html: `
          <h2>Your OTP</h2>
          <h1>${otp}</h1>
          <p>Valid for 5 minutes</p>
        `,
      });

      console.log(otpStore);

      res.json({
        success: true,
        message:
          "OTP sent successfully",
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        success: false,
        message:
          "Failed to send OTP",
      });
    }
  }
);

// =========================
// VERIFY OTP ROUTE
// =========================
app.post(
  "/verify-otp",
  (req, res) => {
    try {
      const { email, otp } =
        req.body;

      const storedData =
        otpStore[email];

      if (!storedData) {
        return res.status(400).json({
          success: false,
          message: "OTP not found",
        });
      }

      if (
        Date.now() >
        storedData.expiresAt
      ) {
        delete otpStore[email];

        return res.status(400).json({
          success: false,
          message: "OTP expired",
        });
      }

      if (
        storedData.otp === otp
      ) {
        otpStore[email].verified =
          true;

        return res.json({
          success: true,
          message:
            "OTP verified successfully",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        success: false,
        message: "Server Error",
      });
    }
  }
);

let group = [];

// =========================
// MATCH USERS
// =========================
const matchUsers = () => {

  if (group.length >= 2) {

    const user1 = group.shift();
    const user2 = group.shift();

    const room =
      `${user1.id}+${user2.id}`;

    user1.join(room);
    user2.join(room);

    user1.currentRoom = room;
    user2.currentRoom = room;

    console.log(`Room Created: ${room}`);

    io.to(room).emit(
      "receive-message",
      {
        text:
          "You are now connected",
        senderId: "system",
      }
    );

    io.to(room).emit("matched");
  }
};

io.on("connection", (socket) => {

  console.log(
    `User connected: ${socket.id}`
  );

  // ADD TO QUEUE
  group.push(socket);

  // TRY MATCHING
  matchUsers();

  // =========================
  // SEND MESSAGE
  // =========================
  socket.on(
    "send-message",
    (message) => {

      const room =
        socket.currentRoom;

      if (room) {

        io.to(room).emit(
          "receive-message",
          {
            text: message.text,
            senderId: socket.id,
          }
        );
      }
    }
  );

  // =========================
  // OFFER
  // =========================
  socket.on(
    "offer",
    (offer) => {

      const room =
        socket.currentRoom;

      if (room) {

        socket.to(room).emit(
          "offer",
          offer
        );

        console.log(
          "Offer Sent"
        );
      }
    }
  );

  // =========================
  // ANSWER
  // =========================
  socket.on(
    "answer",
    (answer) => {

      const room =
        socket.currentRoom;

      if (room) {

        socket.to(room).emit(
          "answer",
          answer
        );

        console.log(
          "Answer Sent"
        );
      }
    }
  );

  // =========================
  // ICE CANDIDATE
  // =========================
  socket.on(
    "sendCandidate",
    (candidate) => {

      const room =
        socket.currentRoom;

      if (room) {

        socket.to(room).emit(
          "receiveCandidate",
          candidate
        );
      }
    }
  );

  // =========================
  // NEXT USER
  // =========================
  socket.on(
    "next-user",
    () => {

      const room =
        socket.currentRoom;

      if (room) {

        socket.leave(room);

        socket.to(room).emit(
          "partner-disconnected"
        );

        socket.currentRoom = null;
      }

      // ADD BACK TO QUEUE
      group.push(socket);

      console.log(
        `${socket.id} joined queue again`
      );

      // REMATCH
      matchUsers();
    }
  );

  // =========================
  // DISCONNECT
  // =========================
  socket.on(
    "disconnect",
    () => {

      console.log(
        `User Disconnected: ${socket.id}`
      );

      group = group.filter(
        (user) =>
          user.id !== socket.id
      );

      const room =
        socket.currentRoom;

      if (room) {

        socket.to(room).emit(
          "partner-disconnected"
        );
      }
    }
  );
});

server.listen(3000, () => {
  console.log(
    "Server running on port 3000"
  );
});