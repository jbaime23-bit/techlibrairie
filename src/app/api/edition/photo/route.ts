// src/app/api/edition/photo/route.ts
// Photo du profil d'auteur : envoi ou remplacement (POST), suppression (DELETE).
// La photo est publique (page de l'auteur) ; l'ancien fichier est supprimé du stockage.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSellerContext } from "@/lib/seller";
import { deletePublicCover, uploadPublicCover } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = await getSellerContext();
  if (context.status !== "ok") {
    return NextResponse.json(
      { error: "Accès refusé : un espace auteur actif est requis." },
      { status: 403 }
    );
  }
  const { seller } = context;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json(
      { error: "Sélectionnez une photo.", fieldErrors: { photo: ["Sélectionnez une photo."] } },
      { status: 422 }
    );
  }

  let url: string;
  try {
    url = await uploadPublicCover(photo, seller.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible d'envoyer la photo.";
    return NextResponse.json({ error: message, fieldErrors: { photo: [message] } }, { status: 422 });
  }

  try {
    const previous = await prisma.sellerProfile.findUnique({
      where: { id: seller.id },
      select: { avatarUrl: true },
    });

    await prisma.sellerProfile.update({
      where: { id: seller.id },
      data: { avatarUrl: url },
    });

    if (previous?.avatarUrl && previous.avatarUrl !== url) {
      await deletePublicCover(previous.avatarUrl).catch(() => undefined);
    }
  } catch (error) {
    console.error("Enregistrement de la photo d'auteur impossible :", error);
    await deletePublicCover(url).catch(() => undefined);
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer dans un instant." },
      { status: 500 }
    );
  }

  revalidatePath("/edition/espace");
  return NextResponse.json({ ok: true, url });
}

export async function DELETE() {
  const context = await getSellerContext();
  if (context.status !== "ok") {
    return NextResponse.json(
      { error: "Accès refusé : un espace auteur actif est requis." },
      { status: 403 }
    );
  }
  const { seller } = context;

  try {
    const current = await prisma.sellerProfile.findUnique({
      where: { id: seller.id },
      select: { avatarUrl: true },
    });

    await prisma.sellerProfile.update({
      where: { id: seller.id },
      data: { avatarUrl: null },
    });

    if (current?.avatarUrl) {
      await deletePublicCover(current.avatarUrl).catch(() => undefined);
    }
  } catch (error) {
    console.error("Suppression de la photo d'auteur impossible :", error);
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer dans un instant." },
      { status: 500 }
    );
  }

  revalidatePath("/edition/espace");
  return NextResponse.json({ ok: true });
}
