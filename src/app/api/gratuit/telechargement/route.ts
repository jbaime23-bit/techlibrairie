// src/app/api/gratuit/telechargement/route.ts
// Livre un PDF gratuit, seulement avec un jeton signé vieux d'au moins 30 secondes.
// Le PDF reste dans le stockage privé : il est lu côté serveur et transmis en flux.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openPrivatePdfStream } from "@/lib/storage";
import { downloadFileNames, verifyWaitToken } from "@/lib/free-resources";
import {
  hashClientIp,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get("ressource") ?? "";
  const token = params.get("t") ?? "";

  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, request.url), 303);

  if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
    return redirectTo("/gratuit");
  }

  const resource = await prisma.freeResource.findUnique({ where: { slug } });
  if (!resource || !resource.isActive) {
    return redirectTo("/gratuit");
  }

  const back = `/gratuit/${resource.slug}`;

  const check = verifyWaitToken(resource.id, token);
  if (!check.ok) {
    return redirectTo(`${back}?erreur=${check.reason === "invalide" ? "lien" : check.reason}`);
  }

  // Limitation : 5 téléchargements du même fichier par quart d'heure et par connexion internet.
  const ipHash = hashClientIp(request.headers.get("x-forwarded-for"));
  const throttleKey = `free:${resource.id}`;

  if (await isLoginThrottled(throttleKey, ipHash)) {
    return redirectTo(`${back}?erreur=limite`);
  }
  await recordLoginFailure(throttleKey, ipHash);

  let stream: ReadableStream<Uint8Array> | null = null;
  try {
    stream = await openPrivatePdfStream(resource.pdfStorageKey);
  } catch (error) {
    console.error("Lecture du PDF gratuit impossible :", error);
  }

  if (!stream) {
    return redirectTo(`${back}?erreur=fichier`);
  }

  try {
    await prisma.freeResource.update({
      where: { id: resource.id },
      data: { downloadCount: { increment: 1 } },
    });
  } catch (error) {
    console.error("Compteur de téléchargements impossible :", error);
  }

  const names = downloadFileNames(resource.pdfFileName, resource.title);

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${names.ascii}"; filename*=UTF-8''${names.utf8}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
