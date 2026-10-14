// src/components/legal/consent-banner.tsx
// Bandeau de choix concernant les cookies publicitaires.
// Les deux boutons ont la même importance visuelle.
"use client";

import Link from "next/link";
import { useState } from "react";

// Même nom que dans src/lib/consent.ts (ce fichier ne peut pas l'importer : il s'exécute dans le navigateur).
const COOKIE_NAME = "tl_consent";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 6 mois

function saveChoice(choice: "granted" | "denied") {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${choice}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  // Rechargement complet : les publicités sont décidées côté serveur.
  window.location.reload();
}

export function ConsentBanner() {
  const [saving, setSaving] = useState(false);

  function choose(choice: "granted" | "denied") {
    setSaving(true);
    saveChoice(choice);
  }

  return (
    <div
      role="dialog"
      aria-label="Choix concernant les cookies publicitaires"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-300 bg-white p-4 shadow-lg"
    >
      <div className="container-page flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-700">
          Ce site affiche des publicités, dont certaines proviennent de partenaires
          tiers qui peuvent utiliser des cookies et des traceurs. Acceptez-vous leur
          affichage ? Les cookies nécessaires au fonctionnement du site (connexion,
          panier) sont toujours utilisés. Votre choix est conservé 6 mois et modifiable
          à tout moment depuis le pied de page.{" "}
          <Link href="/confidentialite" className="font-semibold text-brand-700 hover:underline">
            En savoir plus
          </Link>
        </p>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("denied")}
            disabled={saving}
            className="btn-secondary"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            disabled={saving}
            className="btn-secondary"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
