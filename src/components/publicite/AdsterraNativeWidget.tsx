"use client";

import { useEffect, useRef } from "react";

export default function AdsterraNativeWidget() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      containerRef.current &&
      !document.querySelector('script[src*="7023354967c684fbf7dac008b4795fc5"]')
    ) {
      const script = document.createElement("script");
      script.src =
        "https://tuxedoarbourannouncement.com/7023354967c684fbf7dac008b4795fc5/invoke.js";
      script.async = true;
      script.setAttribute("data-cfasync", "false");
      containerRef.current.appendChild(script);
    }
  }, []);

  return (
    <div className="w-full flex justify-center my-4 min-h-[150px]">
      <div id="container-7023354967c684fbf7dac008b4795fc5" ref={containerRef} />
    </div>
  );
}
