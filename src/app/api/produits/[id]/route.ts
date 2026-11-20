// src/app/api/produits/[id]/route.ts
// Retrait / remise en vente d'un produit par son vendeur.
// Un vendeur ne peut JAMAIS publier un ouvrage que TechLibrairie n'a pas validé : il peut seulement
// retirer un ouvrage en vente, et remettre en vente un ouvrage déjà validé qu'il avait retiré.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSellerContext } from "@/lib/seller";

const patchSchema = z.object({
  status: z.enum(["PUBLISHED", "UNPUBLISHED"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const context = await getSellerContext();
  if (context.status !== "ok") {
    return NextResponse.json(
      { error: "Accès refusé : un compte vendeur actif est requis." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Statut invalide." }, { status: 422 });
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, sellerId: true, status: true, validatedAt: true },
  });

  if (!product || product.sellerId !== context.seller.id) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }

  if (product.status === "SUSPENDED") {
    return NextResponse.json(
      {
        error:
          "Ce produit a été suspendu par l'administration. Contactez-la pour le rétablir.",
      },
      { status: 403 }
    );
  }

  if (product.status === "PENDING_PAYMENT") {
    return NextResponse.json(
      {
        error:
          "Cet ouvrage est en cours d'édition : TechLibrairie Édition le met en ligne une fois l'édition terminée.",
      },
      { status: 403 }
    );
  }

  if (product.status === "PENDING_REVIEW") {
    return NextResponse.json(
      {
        error:
          "Cet ouvrage est en attente de validation par TechLibrairie : il sera visible dès sa validation.",
      },
      { status: 403 }
    );
  }

  if (parsed.data.status === "PUBLISHED" && product.validatedAt === null) {
    return NextResponse.json(
      {
        error:
          "La mise en ligne est réservée à TechLibrairie : contactez l'administration pour remettre cet ouvrage en vente.",
      },
      { status: 403 }
    );
  }

  await prisma.product.update({
    where: { id: product.id },
    data: {
      status: parsed.data.status,
      ...(parsed.data.status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
    },
  });

  revalidatePath("/vendeur");
  revalidatePath("/vendeur/produits");
  revalidatePath("/catalogue");

  return NextResponse.json({ ok: true });
}
