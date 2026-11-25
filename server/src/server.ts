import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();

const allowedOrigins = (
  process.env.CLIENT_URL || "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
  })
);

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("join-room", (roomId: string) => {
    if (typeof roomId !== "string" || !roomId.trim()) {
      socket.emit("room-error", "Invalid room ID");
      return;
    }

    // Prevent joining multiple rooms with the same socket
    if (socket.data.roomId) {
      socket.emit("room-error", "Already in a room");
      return;
    }

    const room = io.sockets.adapter.rooms.get(roomId);
    const participants = room?.size ?? 0;

    // Allow only two participants
    if (participants >= 2) {
      socket.emit("room-full");
      return;
    }

    socket.join(roomId);
    socket.data.roomId = roomId;

    socket.emit("room-users", participants);

    socket.to(roomId).emit("user-joined", socket.id);

    console.log(`${socket.id} joined room ${roomId}`);
  });

  // WebRTC offer
  socket.on("offer", ({ roomId, offer }) => {
    if (socket.data.roomId !== roomId) return;

    socket.to(roomId).emit("offer", offer);
  });

  // WebRTC answer
  socket.on("answer", ({ roomId, answer }) => {
    if (socket.data.roomId !== roomId) return;

    socket.to(roomId).emit("answer", answer);
  });

  // ICE candidates
  socket.on("ice-candidate", ({ roomId, candidate }) => {
    if (socket.data.roomId !== roomId) return;

    socket.to(roomId).emit("ice-candidate", candidate);
  });

  // Leave room
  socket.on("leave-room", (roomId: string) => {
    if (socket.data.roomId !== roomId) return;

    socket.to(roomId).emit("user-left");

    socket.leave(roomId);
    delete socket.data.roomId;

    console.log(`${socket.id} left room ${roomId}`);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;

    if (roomId) {
      socket.to(roomId).emit("user-left");
      console.log(`${socket.id} disconnected from ${roomId}`);
    }

    console.log("Disconnected:", socket.id);
  });
});

// Render deployment configuration
const PORT = Number(process.env.PORT) || 3000;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
