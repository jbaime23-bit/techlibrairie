"use client";

import { useEffect, useRef } from "react";

export default function AdsterraPopUnderWidget() {
  const popunderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      popunderRef.current &&
      !document.querySelector('script[src*="68d6dd033c01732903af08fc18e40163"]')
    ) {
      const script = document.createElement("script");
      script.src =
        "https://tuxedoarbourannouncement.com/68/d6/dd/68d6dd033c01732903af08fc18e40163.js";
      script.async = true;
      popunderRef.current.appendChild(script);
    }
  }, []);

  return <div className="hidden" ref={popunderRef} />;
}
