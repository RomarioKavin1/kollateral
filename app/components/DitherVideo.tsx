"use client";

import { useEffect, useRef } from "react";

// The pre-rendered Remotion hero reel, graded to forensic near-monochrome, with
// an ordered-dot dither field + scanlines layered on top. A muted autoplay loop
// <video> keeps decoding and advancing in any tab state, so it is robust.
export function DitherVideo({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const play = () => v.play().catch(() => {});
    play();
    v.addEventListener("canplay", play);
    v.addEventListener("loadeddata", play);
    return () => {
      v.removeEventListener("canplay", play);
      v.removeEventListener("loadeddata", play);
    };
  }, []);

  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        overflow: "hidden",
        // the dense poster frame is the always-present base; the video plays over
        // it for real users, and it shows through wherever video can't decode
        backgroundImage: "url(/hero-poster.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        filter: "grayscale(0.5) contrast(1.22) brightness(1.12)",
      }}
    >
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        poster="/hero-poster.png"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      >
        {/* WebM (VP8) first for Chromium, which lacks the H.264 decoder; mp4 fallback for Safari */}
        <source src="/hero.webm?v=6" type="video/webm" />
        <source src="/hero.mp4?v=6" type="video/mp4" />
      </video>
      {/* dither dot field on top */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(oklch(1 0 0 / 0.9) 0.6px, transparent 0.7px)",
          backgroundSize: "3px 3px",
          mixBlendMode: "overlay",
          opacity: 0.55,
        }}
      />
      {/* second, coarser dither layer for depth */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(oklch(0 0 0 / 0.9) 0.7px, transparent 0.8px)",
          backgroundSize: "5px 5px",
          mixBlendMode: "multiply",
          opacity: 0.26,
        }}
      />
      {/* scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, transparent 0 2px, oklch(0 0 0 / 0.22) 2px 3px)",
          mixBlendMode: "multiply",
          opacity: 0.4,
        }}
      />
    </div>
  );
}
