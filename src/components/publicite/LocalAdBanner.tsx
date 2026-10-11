// src/components/publicite/LocalAdBanner.tsx
// Bannière d'une entreprise tierce, avec comptage des vues et des clics.
"use client";

import { useEffect, useRef } from "react";

interface LocalAdBannerProps {
  id: string;
  imageUrl: string;
  altText: string;
}

export default function LocalAdBanner({ id, imageUrl, altText }: LocalAdBannerProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    fetch(`/api/pub/vue/${id}`, { method: "POST", keepalive: true }).catch(
      () => undefined
    );
  }, [id]);

  return (
    <div className="my-4 flex w-full justify-center">
      <a
        href={`/api/pub/clic/${id}`}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block max-w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={altText}
          loading="lazy"
          className="h-auto max-h-[120px] w-auto max-w-full rounded-lg border border-slate-200 object-contain"
        />
        <span className="mt-1 block text-center text-[10px] uppercase tracking-wide text-slate-400">
          Publicité
        </span>
      </a>
    </div>
  );
}
