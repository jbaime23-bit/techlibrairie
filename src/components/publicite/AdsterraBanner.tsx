"use client";

import { useEffect, useRef } from "react";

export default function AdsterraBanner() {
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bannerRef.current && !bannerRef.current.firstChild) {
      const atOptions = document.createElement("script");
      atOptions.innerHTML = `atOptions = { 'key' : 'a4e17577c357e76752483752b36289fc', 'format' : 'iframe', 'height' : 90, 'width' : 728, 'params' : {} };`;
      const script = document.createElement("script");
      script.src =
        "https://tuxedoarbourannouncement.com/a4e17577c357e76752483752b36289fc/invoke.js";
      script.async = true;
      bannerRef.current.appendChild(atOptions);
      bannerRef.current.appendChild(script);
    }
  }, []);

  return (
    <div className="w-full flex justify-center my-4 overflow-hidden min-h-[90px]">
      <div ref={bannerRef} />
    </div>
  );
}
