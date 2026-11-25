import { useEffect, useRef } from "react";
import { MicOff } from "lucide-react";

type VideoTileProps = {
  name: string;
  stream: MediaStream | null;
  cameraOn?: boolean;
  micOn?: boolean;
};

function VideoTile({
  name,
  stream,
  cameraOn = true,
  micOn = true,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream;

    if (stream) {
      video.play().catch((err) => {
        console.log("Video playback issue:", err);
      });
    }

    return () => {
      video.srcObject = null;
    };
  }, [stream, cameraOn]);

  return (
    <div className="relative rounded-2xl bg-[#18181b] border border-white/5 overflow-hidden flex items-center justify-center min-h-75">

      {/* Keep the video element mounted */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={name === "You"}
        className={`absolute inset-0 w-full h-full object-cover ${
          cameraOn && stream ? "visible" : "invisible"
        }`}
      />

      {/* Camera-off placeholder */}
      {(!stream || !cameraOn) && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#18181b]">
          <div className="w-24 h-24 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-3xl font-semibold">
            {name[0].toUpperCase()}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-2 rounded-lg text-sm">
        {name}
      </div>

      {!micOn && (
        <div className="absolute top-4 right-4 bg-red-500/80 p-2 rounded-full">
          <MicOff size={16} />
        </div>
      )}
    </div>
  );
}

export default VideoTile;