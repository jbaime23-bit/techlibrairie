// src/app/api/pub/clic/[id]/route.ts
// Comptage du clic puis redirection vers le site de l'annonceur.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const home = new URL("/", request.url);

  if (!/^[a-z0-9]{1,40}$/i.test(params.id)) {
    return NextResponse.redirect(home, 302);
  }

  const ad = await prisma.adSpace.findFirst({
    where: { id: params.id, isActive: true, kind: "LOCAL_BANNER" },
    select: { id: true, targetUrl: true },
  });

  if (!ad || !ad.targetUrl) {
    return NextResponse.redirect(home, 302);
  }

  let target: URL;
  try {
    target = new URL(ad.targetUrl);
  } catch {
    return NextResponse.redirect(home, 302);
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return NextResponse.redirect(home, 302);
  }

  await prisma.adSpace
    .update({ where: { id: ad.id }, data: { clicks: { increment: 1 } } })
    .catch(() => undefined);

  return NextResponse.redirect(target, 302);
}
