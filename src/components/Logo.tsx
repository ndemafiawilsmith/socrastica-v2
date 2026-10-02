"use client";

import { useId } from "react";

export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} role="img" aria-label="Socrastica">
      <defs>
        <linearGradient id={`${id}-glass`} x1="6" y1="6" x2="42" y2="43" gradientUnits="userSpaceOnUse"><stop stopColor="#d2c7ff" stopOpacity=".85"/><stop offset="1" stopColor="#7865da" stopOpacity=".15"/></linearGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>
      </defs>
      <path d="M24 5 41 15v19L24 44 7 34V15Z" fill="#ac95ff" opacity=".35" filter={`url(#${id}-glow)`}/>
      <path d="M24 4 41 14v20L24 44 7 34V14Z" fill={`url(#${id}-glass)`} stroke="#e4dbff" strokeOpacity=".65"/>
      <path d="m17 15-8 9 8 9m14-18 8 9-8 9M28 13l-8 22" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="m24 4 1 20 16 10M7 14l18 10-1 20" stroke="white" strokeOpacity=".18"/>
    </svg>
  );
}
