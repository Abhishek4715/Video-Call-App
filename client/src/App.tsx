import { useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Copy,
  ArrowLeft,
  Users,
} from "lucide-react";

import VideoTile from "./components/VideoTile";
import { useWebRTC } from "./hooks/useWebRTC";

function Home() {
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const navigate = useNavigate();

  function createRoom() {
    const id = crypto.randomUUID().slice(0, 8);
    navigate(`/room/${id}`, {
      state: { name: name.trim(), createRoom: true },
    });
  }

  function joinRoom() {
    const id = roomId.trim();

    if (id) {
      navigate(`/room/${id}`, {
        state: { name: name.trim(), createRoom: false },
      });
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center">
      <header className="h-16 border-b border-white/10 flex items-center px-6">
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center font-bold">
          P
        </div>
        <span className="font-semibold text-lg ml-3">Portal</span>
      </header>

      <main className="relative flex-1 min-h-0 p-4 flex flex-col gap-4">
        <div className="w-full max-w-md bg-[#18181b] border border-white/10 rounded-2xl p-8">
          <h1 className="text-2xl font-semibold mb-2">
            Video calls, made simple.
          </h1>

          <p className="text-zinc-400 mb-8">
            Create a room or join an existing meeting.
          </p>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={25}
            className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 mb-3"
          />

          <button
            onClick={createRoom}
            className="w-full mt-10 bg-indigo-600 hover:bg-indigo-700 rounded-xl py-3 font-medium mb-6"
          >
            Create New Room
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="h-px bg-white/10 flex-1" />
            <span className="text-zinc-500 text-sm">OR</span>
            <div className="h-px bg-white/10 flex-1" />
          </div>

          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            placeholder="Enter room ID"
            className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 mb-3"
          />

          <button
            onClick={joinRoom}
            disabled={!roomId.trim()}
            className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 rounded-xl py-3 font-medium"
          >
            Join Room
          </button>
        </div>
      </main>
    </div>
  );
}

function RoomPage() {
  const { roomId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const name = location.state?.name?.trim() || "Guest";
  const createRoom = location.state?.createRoom === true;

  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);

  const startedRef = useRef(false);

  const {
    localStream,
    remoteStreams,
    connected,
    inRoom,
    error,
    startCall,
    toggleCamera,
    toggleMic,
    leaveCall,
  } = useWebRTC();


  const participantCount = remoteStreams.length + 1;

  useEffect(() => {
    if (!roomId || startedRef.current) return;

    startedRef.current = true;
    void startCall(roomId, name, createRoom);
  }, [roomId, name, createRoom, startCall]);

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
    navigate("/");
  }

  async function copyRoomLink() {
    const link = `${window.location.origin}/room/${roomId}`;

    try {
      await navigator.clipboard.writeText(link);
    } catch {
      console.error("Could not copy the room link.");
    }
  }

  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId);
    } catch {
      console.error("Could not copy the room ID.");
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col">
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeave}
            className="text-zinc-400 hover:text-white"
          >
            <ArrowLeft />
          </button>

          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center font-bold">
            P
          </div>

          <span className="font-semibold text-lg">Portal</span>
        </div>

        <div className="text-sm text-zinc-400">
          {connected
            ? "Connected"
            : inRoom
              ? "Waiting for participants..."
              : "Joining room..."}
        </div>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-4">

        {error && (
          <p className="text-center text-red-400">{error}</p>
        )}



        {showParticipants && (
          <div className="absolute top-4 right-4 bottom-24 z-20
                  w-72 max-h-[calc(100%-7rem)]
                  bg-[#18181b] border border-white/10
                  rounded-xl p-4 shadow-xl flex flex-col">

            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">
                Participants ({participantCount})
              </h2>

              <button
                onClick={() => setShowParticipants(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center">
                  {name[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{name} (You)</p>
                  <p className="text-xs text-zinc-400">Local participant</p>
                </div>
              </div>

              {remoteStreams.map((participant, index) => (
                <div key={participant.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center">
                    {index + 1}
                  </div>

                  <div>
                    <p className="text-sm font-medium">
                      {participant.name}
                    </p>
                    <p className="text-xs text-zinc-400">
                      Remote participant
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-4 mt-4 flex flex-col gap-3">
              <div>
                <p className="text-xs text-zinc-400">Room ID</p>
                <button
                  type="button"
                  onClick={copyRoomId}
                  className="font-medium hover:text-indigo-300"
                  aria-label="Copy room ID"
                  title="Copy room ID"
                >
                  {roomId}
                </button>
                <p className="text-xs text-zinc-400 mt-1">
                  {participantCount}/4 participants
                </p>
              </div>

              <button
                onClick={copyRoomLink}
                className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl text-sm"
              >
                <Copy size={16} />
                Share link
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {remoteStreams.map((participant) => (
            <VideoTile
              key={participant.id}
              name={participant.name}
              stream={participant.stream}
            />
          ))}

          <VideoTile
            name={name}
            stream={localStream}
            cameraOn={cameraOn}
            micOn={micOn}
            isLocal
            className={
              participantCount === 3
                ? "sm:col-span-2 sm:w-1/2 sm:justify-self-center"
                : ""
            }
          />
        </div>

        <div className="flex justify-center items-center gap-4 py-4">
          <button
            onClick={handleMic}
            className={`p-4 rounded-xl ${micOn ? "bg-zinc-800" : "bg-red-600"
              }`}
          >
            {micOn ? <Mic /> : <MicOff />}
          </button>

          <button
            onClick={handleCamera}
            className={`p-4 rounded-xl ${cameraOn ? "bg-zinc-800" : "bg-red-600"
              }`}
          >
            {cameraOn ? <Video /> : <VideoOff />}
          </button>

          <button
            onClick={() => setShowParticipants((prev) => !prev)}
            className={`p-4 rounded-xl ${showParticipants ? "bg-indigo-600" : "bg-zinc-800"
              }`}
          >
            <Users />
          </button>

          <button
            onClick={handleLeave}
            className="p-4 px-6 rounded-xl bg-red-600 hover:bg-red-700"
          >
            <PhoneOff />
          </button>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
