// =========================
// SERVER
// =========================

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

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