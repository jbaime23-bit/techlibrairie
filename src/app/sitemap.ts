// src/app/sitemap.ts
// Plan du site : pages publiques, ouvrages en vente, PDF gratuits, auteurs et catégories.

import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

// Généré à la demande (jamais pendant la compilation) pour toujours refléter la base.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/catalogue`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/gratuit`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/a-propos`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/conditions`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/mentions-legales`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/confidentialite`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const [products, freeResources, sellers, categories] = await Promise.all([
      prisma.product.findMany({
        where: { status: "PUBLISHED", seller: { status: "ACTIVE" } },
        select: { slug: true, updatedAt: true },
        orderBy: { publishedAt: "desc" },
        take: 5000,
      }),
      prisma.freeResource.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
        orderBy: { createdAt: "desc" },
        take: 2000,
      }),
      prisma.sellerProfile.findMany({
        where: { status: "ACTIVE", user: { isActive: true } },
        select: { slug: true, updatedAt: true },
        take: 2000,
      }),
      prisma.category.findMany({ select: { slug: true }, take: 200 }),
    ]);

    for (const product of products) {
      entries.push({
        url: `${base}/catalogue/${product.slug}`,
        lastModified: product.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    for (const resource of freeResources) {
      entries.push({
        url: `${base}/gratuit/${resource.slug}`,
        lastModified: resource.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    for (const seller of sellers) {
      entries.push({
        url: `${base}/auteurs/${seller.slug}`,
        lastModified: seller.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }

    for (const category of categories) {
      entries.push({
        url: `${base}/catalogue?categorie=${category.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  } catch (error) {
    console.error("Plan du site : lecture de la base impossible :", error);
  }

  return entries;
                 }
