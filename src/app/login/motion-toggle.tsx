"use client";

import { useState } from "react";

// Lets anyone stop the looping hero animation. The attribute is read by a
// rule in globals.css that pauses every animation inside the header.
export function MotionToggle() {
  const [paused, setPaused] = useState(false);

  return (
    <button
      type="button"
      aria-pressed={paused}
      onClick={(event) => {
        event.currentTarget
          .closest("header")
          ?.toggleAttribute("data-motion-paused", !paused);
        setPaused(!paused);
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-slate-950/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition-colors duration-150 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:hidden"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="size-3"
        fill="currentColor"
      >
        {paused ? (
          <path d="M4 2.5v11l9-5.5-9-5.5Z" />
        ) : (
          <path d="M3.5 2.5h3v11h-3zm6 0h3v11h-3z" />
        )}
      </svg>
      {paused ? "Play animation" : "Pause animation"}
    </button>
  );
}
