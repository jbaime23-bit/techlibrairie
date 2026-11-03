// src/components/partage/share-buttons.tsx
// Boutons de partage : de simples liens vers les réseaux (aucun script tiers, aucun cookie),
// plus la copie du lien et le partage natif du téléphone.
"use client";

import { useEffect, useState } from "react";

export function ShareButtons({
  url,
  title,
  text,
}: {
  url: string;
  title: string;
  text: string;
}) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  const encodedTitle = encodeURIComponent(title);
  const encodedMessage = encodeURIComponent(`${text} ${url}`);

  const networks: { label: string; href: string; external: boolean }[] = [
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      external: true,
    },
    { label: "WhatsApp", href: `https://wa.me/?text=${encodedMessage}`, external: true },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      external: true,
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      external: true,
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      external: true,
    },
    {
      label: "Email",
      href: `mailto:?subject=${encodedTitle}&body=${encodedMessage}`,
      external: false,
    },
  ];

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copiez ce lien :", url);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text, url });
    } catch {
      // Partage annulé par l'utilisateur : rien à faire.
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">Partager</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {canShare && (
          <button type="button" onClick={nativeShare} className="btn-primary px-3 py-1 text-xs">
            Partager...
          </button>
        )}

        {networks.map((network) => (
          <a
            key={network.label}
            href={network.href}
            {...(network.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="btn-secondary px-3 py-1 text-xs"
          >
            {network.label}
          </a>
        ))}

        <button type="button" onClick={copyLink} className="btn-secondary px-3 py-1 text-xs">
          {copied ? "Lien copié" : "Copier le lien"}
        </button>
      </div>
    </div>
  );
      }
