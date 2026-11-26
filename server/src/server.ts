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

app.use(cors({ origin: allowedOrigins }));

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

const MAX_USERS = 4;

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("join-room", (payload) => {
    const roomId = payload?.roomId;
    const name = payload?.name;
    const createRoom = payload?.createRoom === true;

    if (typeof roomId !== "string" || !roomId.trim()) {
      socket.emit("room-error", "Invalid room ID");
      return;
    }

    if (socket.data.roomId) return;

    const normalizedRoomId = roomId.trim();
    const room = io.sockets.adapter.rooms.get(normalizedRoomId);
    const participants = room?.size ?? 0;

    if (!room && !createRoom) {
      socket.emit("room-error", "Room not found. Check the room ID and try again.");
      return;
    }

    if (participants >= MAX_USERS) {
      socket.emit("room-full");
      return;
    }

    const existingUsers = room
      ? [...room].map((id) => {
          const participant = io.sockets.sockets.get(id);

          return {
            id,
            name: participant?.data.name ?? "Guest",
            micOn: participant?.data.micOn ?? true,
            cameraOn: participant?.data.cameraOn ?? true,
          };
        })
      : [];

    const participantName =
      typeof name === "string" && name.trim()
        ? name.trim()
        : `Participant ${participants + 1}`;

    socket.data.roomId = normalizedRoomId;
    socket.data.name = participantName;
    socket.data.micOn = true;
    socket.data.cameraOn = true;

    socket.join(normalizedRoomId);

    socket.emit("room-users", existingUsers);

    socket.to(normalizedRoomId).emit("user-joined", {
      id: socket.id,
      name: participantName,
      micOn: true,
      cameraOn: true,
    });
  });

  socket.on("participant-update", ({ micOn, cameraOn }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    if (typeof micOn === "boolean") socket.data.micOn = micOn;
    if (typeof cameraOn === "boolean") socket.data.cameraOn = cameraOn;

    socket.to(roomId).emit("participant-update", {
      id: socket.id,
      micOn: socket.data.micOn,
      cameraOn: socket.data.cameraOn,
    });
  });

  // Send signaling messages to a specific peer
  socket.on("offer", ({ to, offer }) => {
    io.to(to).emit("offer", {
      from: socket.id,
      offer,
    });
  });

  socket.on("answer", ({ to, answer }) => {
    io.to(to).emit("answer", {
      from: socket.id,
      answer,
    });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", {
      from: socket.id,
      candidate,
    });
  });

  socket.on("leave-room", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    socket.to(roomId).emit("user-left", socket.id);
    socket.leave(roomId);

    delete socket.data.roomId;

    console.log(`${socket.id} left ${roomId}`);
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;

    if (roomId) {
      socket.to(roomId).emit("user-left", socket.id);
      delete socket.data.roomId;
    }

    console.log("Disconnected:", socket.id);
  });
});

const PORT = Number(process.env.PORT) || 3000;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
