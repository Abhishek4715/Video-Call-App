import { useRef, useState } from "react";
import { socket } from "../socket";

export type RemoteParticipant = {
  id: string;
  name: string;
  stream: MediaStream;
  micOn: boolean;
  cameraOn: boolean;
  connectionStatus: "connecting" | "connected";
};

type RoomParticipant = {
  id: string;
  name: string;
  micOn: boolean;
  cameraOn: boolean;
};

function getIceServers(): RTCIceServer[] {
  const configuredTurnUrls = import.meta.env.VITE_TURN_URLS;
  const turnUrls = (typeof configuredTurnUrls === "string"
    ? configuredTurnUrls.split(",")
    : []
  )
    .map((url: string) => url.trim())
    .filter(Boolean);

  const iceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
  ];

  if (!turnUrls?.length) return iceServers;

  const configuredUsername = import.meta.env.VITE_TURN_USERNAME;
  const configuredCredential = import.meta.env.VITE_TURN_CREDENTIAL;
  const username =
    typeof configuredUsername === "string" ? configuredUsername.trim() : "";
  const credential =
    typeof configuredCredential === "string" ? configuredCredential : "";

  if (!username || !credential) {
    throw new Error(
      "TURN is configured without credentials. Set VITE_TURN_USERNAME and VITE_TURN_CREDENTIAL."
    );
  }

  iceServers.push({
    urls: turnUrls,
    username,
    credential,
  });

  return iceServers;
}

export function useWebRTC() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteParticipant[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  const localRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const candidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const participantNamesRef = useRef<Map<string, string>>(new Map());
  const iceServersRef = useRef<RTCIceServer[]>([
    { urls: "stun:stun.l.google.com:19302" },
  ]);
  const roomRef = useRef("");
  const connectHandlerRef = useRef<(() => void) | null>(null);
  const [inRoom, setInRoom] = useState(false);

  function updateRemoteStream(id: string, stream: MediaStream) {
    setRemoteStreams((previous) => {
      const existing = previous.find((user) => user.id === id);

      if (existing) {
        return previous.map((user) =>
          user.id === id ? { ...user, stream } : user
        );
      }

      return [
        ...previous,
        {
          id,
          name: participantNamesRef.current.get(id) ?? "Guest",
          stream,
          micOn: true,
          cameraOn: true,
          connectionStatus: "connecting",
        },
      ];
    });
  }

  function removePeer(id: string) {
    const peer = peersRef.current.get(id);

    if (peer) {
      peer.close();
      peersRef.current.delete(id);
    }

    candidatesRef.current.delete(id);

    setRemoteStreams((previous) =>
      previous.filter((user) => user.id !== id)
    );

    setConnected(
      [...peersRef.current.values()].some(
        (connection) => connection.connectionState === "connected"
      )
    );
  }

  function createPeer(id: string) {
    const existingPeer = peersRef.current.get(id);
    if (existingPeer) return existingPeer;

    const peer = new RTCPeerConnection({
      iceServers: iceServersRef.current,
    });

    peersRef.current.set(id, peer);

    localRef.current?.getTracks().forEach((track) => {
      peer.addTrack(track, localRef.current!);
    });

    peer.ontrack = (event) => {
      const stream = event.streams[0];

      if (stream) {
        updateRemoteStream(id, stream);
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          to: id,
          candidate: event.candidate,
        });
      }
    };

    peer.onconnectionstatechange = () => {
      const isConnected = [...peersRef.current.values()].some(
        (connection) => connection.connectionState === "connected"
      );

      setConnected(isConnected);

      if (peer.connectionState === "failed") {
        removePeer(id);
      }

      if (peer.connectionState === "closed") {
        removePeer(id);
      }
    };

    return peer;
  }

  async function addPendingCandidates(id: string, peer: RTCPeerConnection) {
    const candidates = candidatesRef.current.get(id) ?? [];

    for (const candidate of candidates) {
      try {
        await peer.addIceCandidate(candidate);
      } catch (err) {
        console.error("ICE candidate error:", err);
      }
    }

    candidatesRef.current.delete(id);
  }

  async function makeOffer(id: string) {
    try {
      const peer = createPeer(id);
      const offer = await peer.createOffer();

      await peer.setLocalDescription(offer);

      socket.emit("offer", {
        to: id,
        offer,
      });
    } catch (err) {
      console.error("Offer error:", err);
      setError("Could not start a connection with a participant.");
    }
  }

  async function handleOffer({
    from,
    offer,
  }: {
    from: string;
    offer: RTCSessionDescriptionInit;
  }) {
    try {
      const peer = createPeer(from);

      await peer.setRemoteDescription(offer);
      await addPendingCandidates(from, peer);

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit("answer", {
        to: from,
        answer,
      });
    } catch (err) {
      console.error("Offer handling error:", err);
    }
  }

  async function handleAnswer({
    from,
    answer,
  }: {
    from: string;
    answer: RTCSessionDescriptionInit;
  }) {
    try {
      const peer = peersRef.current.get(from);
      if (!peer) return;

      await peer.setRemoteDescription(answer);
      await addPendingCandidates(from, peer);
    } catch (err) {
      console.error("Answer handling error:", err);
    }
  }

  async function handleCandidate({
    from,
    candidate,
  }: {
    from: string;
    candidate: RTCIceCandidateInit;
  }) {
    const peer = peersRef.current.get(from);

    if (peer?.remoteDescription) {
      try {
        await peer.addIceCandidate(candidate);
      } catch (err) {
        console.error("ICE candidate error:", err);
      }
    } else {
      const pending = candidatesRef.current.get(from) ?? [];
      pending.push(candidate);
      candidatesRef.current.set(from, pending);
    }
  }

  function handleRoomUsers(users: RoomParticipant[]) {
    setInRoom(true);
    users.forEach(({ id, name }) => {
      participantNamesRef.current.set(id, name);
    });
  }

  function handleUserJoined(participant: RoomParticipant) {
    participantNamesRef.current.set(participant.id, participant.name);
    makeOffer(participant.id);
  }

  function handleUserLeft(id: string) {
    removePeer(id);
    participantNamesRef.current.delete(id);
  }

  function handleRoomFull() {
    setError("This room is full.");
    leaveCall();
  }

  function handleRoomError(message: string) {
    setError(message);
    leaveCall();
  }

  function handleSocketDisconnect() {
    setConnected(false);

    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();

    candidatesRef.current.clear();
    setRemoteStreams([]);
  }

  async function startCall(
    roomId: string,
    name: string,
    createRoom = false
  ) {
    try {
      iceServersRef.current = getIceServers();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid TURN configuration.";
      setError(message);
      return false;
    }

    try {
      setError("");
      roomRef.current = roomId;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      socket.on("disconnect", handleSocketDisconnect);
      localRef.current = stream;
      setLocalStream(stream);

      socket.on("room-users", handleRoomUsers);
      socket.on("user-joined", handleUserJoined);
      socket.on("user-left", handleUserLeft);
      socket.on("offer", handleOffer);
      socket.on("answer", handleAnswer);
      socket.on("ice-candidate", handleCandidate);
      socket.on("room-full", handleRoomFull);
      socket.on("room-error", handleRoomError);

      const joinRoom = () => {
        socket.emit("join-room", {
          roomId,
          name: name.trim(),
          createRoom,
        });
      };

      connectHandlerRef.current = joinRoom;

      socket.on("connect", joinRoom);

      if (socket.connected) {
        joinRoom();
      } else {
        socket.connect();
      }

      return true;
    } catch (err) {
      console.error("Could not start call:", err);
      setError("Could not access camera or microphone.");
      leaveCall();
      return false;
    }
  }

  function toggleCamera(enabled: boolean) {
    localRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  function toggleMic(enabled: boolean) {
    localRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  function leaveCall() {
    if (connectHandlerRef.current) {
      socket.off("connect", connectHandlerRef.current);
      connectHandlerRef.current = null;
    }

    socket.off("disconnect", handleSocketDisconnect);

    socket.off("room-users", handleRoomUsers);
    socket.off("user-joined", handleUserJoined);
    socket.off("user-left", handleUserLeft);
    socket.off("offer", handleOffer);
    socket.off("answer", handleAnswer);
    socket.off("ice-candidate", handleCandidate);
    socket.off("room-full", handleRoomFull);
    socket.off("room-error", handleRoomError);

    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();
    candidatesRef.current.clear();
    participantNamesRef.current.clear();

    localRef.current?.getTracks().forEach((track) => track.stop());
    localRef.current = null;

    setLocalStream(null);
    setRemoteStreams([]);
    setConnected(false);
    setInRoom(false);

    roomRef.current = "";
    socket.disconnect();
  }

  return {
    localStream,
    remoteStreams,
    connected,
    inRoom,
    error,
    startCall,
    toggleCamera,
    toggleMic,
    leaveCall,
  };
}
