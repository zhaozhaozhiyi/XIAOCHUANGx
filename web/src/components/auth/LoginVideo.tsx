"use client";

import { useEffect, useRef } from "react";

const PLAYBACK_RATE = 1.5;

export function LoginVideo({
  src,
  poster,
}: {
  src: string;
  poster?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const applyRate = () => {
      video.defaultPlaybackRate = PLAYBACK_RATE;
      video.playbackRate = PLAYBACK_RATE;
    };

    applyRate();
    video.addEventListener("loadedmetadata", applyRate);
    video.addEventListener("play", applyRate);
    return () => {
      video.removeEventListener("loadedmetadata", applyRate);
      video.removeEventListener("play", applyRate);
    };
  }, [src]);

  return (
    <video
      ref={ref}
      className="login-video"
      src={src}
      poster={poster}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      controls={false}
      disablePictureInPicture
      controlsList="nodownload nofullscreen noremoteplayback"
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
