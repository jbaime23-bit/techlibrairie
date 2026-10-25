// src/app/admin/gratuit/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";
import { recordAdminAction } from "@/lib/audit";
import { deletePrivateFile, deletePublicCover } from "@/lib/storage";

const BACK = "/admin/gratuit";

function readId(formData: FormData): string | null {
  const value = formData.get("resourceId");
  if (typeof value !== "string") return null;
  return /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
}

/** Publie ou retire une ressource gratuite (elle reste enregistrée). */
export async function toggleFreeResourceAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const resourceId = readId(formData);
  if (!resourceId) {
    redirect(BACK);
  }

  const resource = await prisma.freeResource.findUnique({
    where: { id: resourceId },
    select: { id: true, title: true, isActive: true },
  });
  if (!resource) {
    redirect(BACK);
  }

  await prisma.freeResource.update({
    where: { id: resource.id },
    data: { isActive: !resource.isActive },
  });

  await recordAdminAction(admin, {
    action: "gratuit.bascule",
    targetType: "ressource",
    targetId: resource.id,
    details: { titre: resource.title, publie: !resource.isActive },
  });

  revalidatePath("/gratuit");
  revalidatePath(BACK);
  redirect(`${BACK}?message=bascule`);
}

/** Supprime une ressource gratuite et ses fichiers (définitif). */
export async function deleteFreeResourceAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const resourceId = readId(formData);
  if (!resourceId) {
    redirect(BACK);
  }

  const resource = await prisma.freeResource.findUnique({
    where: { id: resourceId },
    select: { id: true, title: true, pdfStorageKey: true, coverImageUrl: true },
  });
  if (!resource) {
    redirect(BACK);
  }

  await prisma.freeResource.delete({ where: { id: resource.id } });

  await deletePrivateFile(resource.pdfStorageKey).catch(() => undefined);
  if (resource.coverImageUrl) {
    await deletePublicCover(resource.coverImageUrl).catch(() => undefined);
  }

  await recordAdminAction(admin, {
    action: "gratuit.supprime",
    targetType: "ressource",
    targetId: resource.id,
    details: { titre: resource.title },
  });

  revalidatePath("/gratuit");
  revalidatePath(BACK);
  redirect(`${BACK}?message=supprime`);
}
