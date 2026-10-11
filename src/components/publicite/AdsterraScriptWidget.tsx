"use client";

import { useEffect, useRef } from "react";

export default function AdsterraScriptWidget() {
  const scriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      scriptContainerRef.current &&
      !document.querySelector('script[src*="544ea932c32e576f665f8070b00b3b37"]')
    ) {
      const script = document.createElement("script");
      script.src =
        "https://tuxedoarbourannouncement.com/54/4e/a9/544ea932c32e576f665f8070b00b3b37.js";
      script.async = true;
      scriptContainerRef.current.appendChild(script);
    }
  }, []);

  return (
    <div
      className="w-full flex justify-center my-4 min-h-[50px]"
      ref={scriptContainerRef}
    />
  );
}
