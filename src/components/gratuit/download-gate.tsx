// src/components/gratuit/download-gate.tsx
// Compte à rebours avant le téléchargement d'un PDF gratuit.
// L'attente est de toute façon imposée par le serveur : cette page n'est que l'affichage.
"use client";

import { useEffect, useState } from "react";

export function DownloadGate({
  slug,
  token,
  waitSeconds,
  maxAgeSeconds,
  sizeLabel,
}: {
  slug: string;
  token: string;
  waitSeconds: number;
  maxAgeSeconds: number;
  sizeLabel: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();

    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 500);

    return () => window.clearInterval(timer);
  }, []);

  const remaining = Math.max(0, waitSeconds - elapsed);
  const ready = remaining === 0;
  // Marge de 2 minutes : le jeton a été créé avant l'affichage de cette page.
  const expired = elapsed > maxAgeSeconds - 120;
  const percent = Math.min(100, Math.round((Math.min(elapsed, waitSeconds) / waitSeconds) * 100));

  const href = `/api/gratuit/telechargement?ressource=${encodeURIComponent(slug)}&t=${token}`;

  return (
    <div className="card space-y-4">
      <div aria-live="polite" className="text-sm text-slate-700">
        {expired ? (
          <p>Le délai de ce lien est dépassé. Rechargez la page pour recommencer.</p>
        ) : ready ? (
          <p className="font-semibold text-green-700">Votre téléchargement est prêt.</p>
        ) : (
          <p>
            Votre téléchargement sera disponible dans <strong>{remaining}</strong> seconde
            {remaining > 1 ? "s" : ""}. Merci de patienter : la publicité finance ce téléchargement
            gratuit. Aucun clic n&apos;est nécessaire.
          </p>
        )}
      </div>

      <div
        className="h-3 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Progression de l'attente"
      >
        <div
          className="h-full bg-brand-600 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {expired ? (
        <a href={`/gratuit/${encodeURIComponent(slug)}`} className="btn-secondary w-full">
          Recharger la page
        </a>
      ) : ready ? (
        <a href={href} className="btn-primary w-full">
          Télécharger le PDF ({sizeLabel})
        </a>
      ) : (
        <button type="button" disabled className="btn-primary w-full">
          Patientez encore {remaining} s
        </button>
      )}

      <noscript>
        <p className="text-xs text-red-700">
          JavaScript est nécessaire pour afficher le compte à rebours.
        </p>
      </noscript>
    </div>
  );
            }
