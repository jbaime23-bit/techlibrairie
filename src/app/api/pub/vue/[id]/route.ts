// src/app/api/pub/vue/[id]/route.ts
// Comptage d'une impression (affichage) d'une bannière locale.

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (/^[a-z0-9]{1,40}$/i.test(params.id)) {
    await prisma.adSpace
      .updateMany({
        where: { id: params.id, isActive: true },
        data: { impressions: { increment: 1 } },
      })
      .catch(() => undefined);
  }

  return new Response(null, { status: 204 });
}
