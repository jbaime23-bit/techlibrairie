// src/app/api/produits/[id]/route.ts
// Publication / retrait d'un produit par son vendeur.

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
    select: { id: true, sellerId: true, status: true },
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
