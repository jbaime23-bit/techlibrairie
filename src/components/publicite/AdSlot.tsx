// src/components/publicite/AdSlot.tsx
// Emplacement publicitaire : affiche les annonces actives de la table AdSpace
// pour un emplacement donné. Ne fait jamais planter la page.
// SÉCURITÉ : aucune publicité (donc aucun script tiers) n'est jamais affichée
// à un administrateur connecté.

import { unstable_cache } from "next/cache";
import type { AdKind, AdPlacement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import AdsterraBanner from "@/components/publicite/AdsterraBanner";
import AdsterraNativeWidget from "@/components/publicite/AdsterraNativeWidget";
import AdsterraScriptWidget from "@/components/publicite/AdsterraScriptWidget";
import AdsterraDirectLink from "@/components/publicite/AdsterraDirectLink";
import AdsterraPopUnderWidget from "@/components/publicite/AdsterraPopUnderWidget";
import LocalAdBanner from "@/components/publicite/LocalAdBanner";

interface SlotAd {
  id: string;
  kind: AdKind;
  imageUrl: string | null;
  altText: string | null;
}

function loadAds(placement: AdPlacement): Promise<SlotAd[]> {
  const cached = unstable_cache(
    async (): Promise<SlotAd[]> => {
      const now = new Date();

      return prisma.adSpace.findMany({
        where: {
          placement,
          isActive: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          ],
        },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: 5,
        select: { id: true, kind: true, imageUrl: true, altText: true },
      });
    },
    ["ad-slot", placement],
    { revalidate: 60, tags: ["ads"] }
  );

  return cached();
}

function renderAd(ad: SlotAd) {
  switch (ad.kind) {
    case "LOCAL_BANNER":
      if (!ad.imageUrl) return null;
      return (
        <LocalAdBanner
          key={ad.id}
          id={ad.id}
          imageUrl={ad.imageUrl}
          altText={ad.altText ?? "Publicité"}
        />
      );

    case "ADSTERRA_BANNER":
      return (
        <div key={ad.id} className="max-w-full overflow-x-auto">
          <AdsterraBanner />
        </div>
      );

    case "ADSTERRA_NATIVE":
      return <AdsterraNativeWidget key={ad.id} />;

    case "ADSTERRA_SCRIPT":
      return <AdsterraScriptWidget key={ad.id} />;

    case "ADSTERRA_DIRECT_LINK":
      return (
        <AdsterraDirectLink key={ad.id} label={ad.altText ?? undefined} />
      );

    case "ADSTERRA_POPUNDER":
      return <AdsterraPopUnderWidget key={ad.id} />;

    default:
      return null;
  }
}

export default async function AdSlot({ placement }: { placement: AdPlacement }) {
  // En cas de doute sur l'identité du visiteur, on n'affiche rien.
  try {
    const session = await getSession();
    if (session?.user?.role === "ADMIN") return null;
  } catch {
    return null;
  }

  let ads: SlotAd[] = [];

  try {
    ads = await loadAds(placement);
  } catch (error) {
    console.error(`Publicité : lecture impossible (${placement}) :`, error);
    return null;
  }

  if (ads.length === 0) return null;

  return <div aria-label="Publicité">{ads.map((ad) => renderAd(ad))}</div>;
  }
