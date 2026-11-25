import { useRef, useState } from "react";
import { socket } from "../socket";

export function useWebRTC() {
  const [localStream, setLocalStream] =
    useState<MediaStream | null>(null);

  const [remoteStream, setRemoteStream] =
    useState<MediaStream | null>(null);

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const roomRef = useRef("");
  const localRef = useRef<MediaStream | null>(null);

  function createPeer() {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
      ],
    });

    peerRef.current = peer;

    // Add our camera and microphone tracks
    localRef.current?.getTracks().forEach((track) => {
      peer.addTrack(track, localRef.current!);
    });

    // Receive the other user's media
    peer.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    // Send ICE candidates to the other user
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          roomId: roomRef.current,
          candidate: event.candidate,
        });
      }
    };

    peer.onconnectionstatechange = () => {
      setConnected(peer.connectionState === "connected");
    };

    return peer;
  }

  async function startCall(roomId: string) {
    try {
      setError("");
      roomRef.current = roomId;

      // Get camera and microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localRef.current = stream;
      setLocalStream(stream);

      // Listen for signaling events
      socket.on("room-full", () => {
        setError("This room is full.");
      });

      socket.on("user-joined", async () => {
        const peer = createPeer();

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        socket.emit("offer", {
          roomId,
          offer,
        });
      });

      socket.on("offer", async (offer) => {
        const peer = createPeer();

        await peer.setRemoteDescription(offer);

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit("answer", {
          roomId,
          answer,
        });
      });

      socket.on("answer", async (answer) => {
        await peerRef.current?.setRemoteDescription(answer);
      });

      socket.on("ice-candidate", async (candidate) => {
        try {
          await peerRef.current?.addIceCandidate(candidate);
        } catch (err) {
          console.error("ICE error:", err);
        }
      });

      socket.on("user-left", () => {
        setRemoteStream(null);
        setConnected(false);
        peerRef.current?.close();
        peerRef.current = null;
      });

      socket.connect();

      socket.on("connect", () => {
        socket.emit("join-room", roomId);
      });
    } catch (err) {
      console.error(err);
      setError("Could not access camera or microphone.");
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
    socket.emit("leave-room", roomRef.current);

    peerRef.current?.close();
    peerRef.current = null;

    localRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    localRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setConnected(false);

    socket.disconnect();
  }

  return {
    localStream,
    remoteStream,
    connected,
    error,
    startCall,
    toggleCamera,
    toggleMic,
    leaveCall,
  };
}