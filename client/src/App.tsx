import { useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
} from "lucide-react";
import VideoTile from "./components/VideoTile";
import { useWebRTC } from "./hooks/useWebRTC";

function App() {
  const [roomId, setRoomId] = useState("demo-room");
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);

  const {
    localStream,
    remoteStream,
    connected,
    error,
    startCall,
    toggleCamera,
    toggleMic,
    leaveCall,
  } = useWebRTC();

  async function joinCall() {
    if (!roomId.trim()) return;

    await startCall(roomId);
    setJoined(true);
  }

  function handleMic() {
    const next = !micOn;
    setMicOn(next);
    toggleMic(next);
  }

  function handleCamera() {
    const next = !cameraOn;
    setCameraOn(next);
    toggleCamera(next);
  }

  function handleLeave() {
    leaveCall();
    setJoined(false);
    setMicOn(true);
    setCameraOn(true);
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col">

      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center font-bold">
            V
          </div>
          <span className="font-semibold text-lg">VConnect</span>
        </div>

        <div className="text-sm text-zinc-400">
          {connected ? "Connected" : joined ? "Waiting for participant..." : "Not in a call"}
        </div>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-4">

        {!joined && (
          <div className="flex justify-center items-center gap-3 py-6">
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room ID"
              className="bg-[#18181b] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-indigo-500"
            />

            <button
              onClick={joinCall}
              className="bg-indigo-600 hover:bg-indigo-700 px-5 py-3 rounded-xl font-medium"
            >
              Join Call
            </button>
          </div>
        )}

        {error && (
          <p className="text-center text-red-400">{error}</p>
        )}

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          <VideoTile
            name="Participant"
            stream={remoteStream}
          />

          <VideoTile
            name="You"
            stream={localStream}
            cameraOn={cameraOn}
            micOn={micOn}
          />
        </div>

        {joined && (
          <div className="flex justify-center items-center gap-4 py-4">

            <button
              onClick={handleMic}
              className={`p-4 rounded-xl ${
                micOn ? "bg-zinc-800" : "bg-red-600"
              }`}
            >
              {micOn ? <Mic /> : <MicOff />}
            </button>

            <button
              onClick={handleCamera}
              className={`p-4 rounded-xl ${
                cameraOn ? "bg-zinc-800" : "bg-red-600"
              }`}
            >
              {cameraOn ? <Video /> : <VideoOff />}
            </button>

            <button className="p-4 rounded-xl bg-zinc-800">
              <Users />
            </button>

            <button
              onClick={handleLeave}
              className="p-4 px-6 rounded-xl bg-red-600 hover:bg-red-700"
            >
              <PhoneOff />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;