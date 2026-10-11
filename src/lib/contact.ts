// src/lib/contact.ts
// Coordonnées affichées dans le pied de page (base de données, puis variables d'environnement).

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface ContactInfo {
  email: string | null;
  whatsappNumber: string | null;
}

function cleanDigits(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

function envContactInfo(): ContactInfo {
  return {
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || null,
    whatsappNumber: cleanDigits(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER),
  };
}

const loadContactInfo = unstable_cache(
  async (): Promise<ContactInfo> => {
    const settings = await prisma.platformSetting.findUnique({
      where: { id: "global" },
      select: { contactEmail: true, whatsappNumber: true },
    });
    const fallback = envContactInfo();

    return {
      email: settings?.contactEmail || fallback.email,
      whatsappNumber: cleanDigits(settings?.whatsappNumber) ?? fallback.whatsappNumber,
    };
  },
  ["contact-info"],
  { revalidate: 300, tags: ["contact-info"] }
);

/** Coordonnées de contact ; ne plante jamais (retombe sur les variables d'environnement). */
export async function getContactInfo(): Promise<ContactInfo> {
  try {
    return await loadContactInfo();
  } catch {
    return envContactInfo();
  }
}

/** Lien WhatsApp (wa.me) à partir d'un numéro au format international. */
export function buildWhatsAppLink(number: string, message?: string): string {
  const base = `https://wa.me/${number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
