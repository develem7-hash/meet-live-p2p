import { useEffect, useRef } from 'react';

export function VideoPlayer({ stream, isLocal = false, className = '' }: { stream: MediaStream | null, isLocal?: boolean, className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal}
      className={`object-cover ${className}`}
    />
  );
}
