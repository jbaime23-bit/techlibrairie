// src/components/auth/auth-shell.tsx
// Habillage des pages d'inscription et de connexion : un panneau coloré (selon l'espace) et le formulaire.

import type { ReactNode } from "react";
import type { SpaceKey } from "@/lib/auth-spaces";

const TONES: Record<SpaceKey, { panel: string; eyebrow: string; blob: string }> = {
  edition: {
    panel: "from-brand-900 via-brand-700 to-violet-700",
    eyebrow: "TechLibrairie Édition",
    blob: "bg-accent-500/30",
  },
  acheteur: {
    panel: "from-teal-900 via-teal-700 to-cyan-700",
    eyebrow: "Boutique TechLibrairie",
    blob: "bg-amber-300/25",
  },
  vendeur: {
    panel: "from-emerald-900 via-teal-800 to-teal-600",
    eyebrow: "Boutique TechLibrairie",
    blob: "bg-lime-300/25",
  },
};

export function AuthShell({
  tone,
  title,
  subtitle,
  perks,
  children,
}: {
  tone: SpaceKey;
  title: string;
  subtitle: string;
  perks: string[];
  children: ReactNode;
}) {
  const style = TONES[tone];

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft md:grid-cols-5">
        <aside
          className={`relative overflow-hidden bg-gradient-to-br ${style.panel} p-8 text-white md:col-span-2`}
        >
          <div
            className={`pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full ${style.blob} blur-3xl`}
          />
          <p className="eyebrow relative text-white/80">{style.eyebrow}</p>
          <h1 className="relative mt-3 text-3xl font-extrabold">{title}</h1>
          <p className="relative mt-3 text-sm text-white/85">{subtitle}</p>

          <ul className="relative mt-8 space-y-3 text-sm">
            {perks.map((perk) => (
              <li key={perk} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold"
                >
                  ✓
                </span>
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        </aside>

        <section className="p-6 sm:p-8 md:col-span-3">{children}</section>
      </div>
    </div>
  );
}
