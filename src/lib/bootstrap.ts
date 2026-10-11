// src/lib/bootstrap.ts
// Initialisation de la plateforme : paramètres, catégories, administrateur
// et emplacements publicitaires par défaut.

import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export class SetupAlreadyDoneError extends Error {
  constructor() {
    super("L'initialisation a déjà été effectuée.");
    this.name = "SetupAlreadyDoneError";
  }
}

export const DEFAULT_CATEGORIES: { name: string; slug: string; description: string }[] = [
  {
    name: "Développement web",
    slug: "developpement-web",
    description: "HTML, CSS, JavaScript, frameworks front-end et back-end.",
  },
  {
    name: "Développement mobile",
    slug: "developpement-mobile",
    description: "Applications Android, iOS et multiplateformes.",
  },
  {
    name: "Programmation",
    slug: "programmation",
    description: "Langages, algorithmique et structures de données.",
  },
  {
    name: "Bases de données",
    slug: "bases-de-donnees",
    description: "SQL, NoSQL, modélisation et administration.",
  },
  {
    name: "Réseaux et systèmes",
    slug: "reseaux-et-systemes",
    description: "Réseaux, Linux, administration système et DevOps.",
  },
  {
    name: "Cybersécurité",
    slug: "cybersecurite",
    description: "Sécurité informatique, cryptographie et bonnes pratiques.",
  },
  {
    name: "Intelligence artificielle",
    slug: "intelligence-artificielle",
    description: "Machine learning, data science et IA générative.",
  },
  {
    name: "Cloud et déploiement",
    slug: "cloud-et-deploiement",
    description: "Hébergement, conteneurs, CI/CD et infrastructure.",
  },
  {
    name: "Gestion de projet",
    slug: "gestion-de-projet",
    description: "Méthodes agiles, product management et entrepreneuriat tech.",
  },
  {
    name: "Bureautique et outils",
    slug: "bureautique-et-outils",
    description: "Outils numériques, tableurs et productivité.",
  },
];

// Emplacements publicitaires créés à l'initialisation (modifiables ensuite en base).
export const DEFAULT_ADS: Prisma.AdSpaceCreateManyInput[] = [
  {
    name: "Adsterra - Bannière accueil (haut)",
    placement: "HOME_TOP",
    kind: "ADSTERRA_BANNER",
    priority: 10,
  },
  {
    name: "Adsterra - PopUnder accueil",
    placement: "HOME_TOP",
    kind: "ADSTERRA_POPUNDER",
    priority: 0,
  },
  {
    name: "Adsterra - Widget natif accueil (milieu)",
    placement: "HOME_MIDDLE",
    kind: "ADSTERRA_NATIVE",
    priority: 10,
  },
  {
    name: "Adsterra - Script accueil (bas)",
    placement: "HOME_BOTTOM",
    kind: "ADSTERRA_SCRIPT",
    priority: 5,
  },
  {
    name: "Adsterra - Lien partenaire accueil (bas)",
    placement: "HOME_BOTTOM",
    kind: "ADSTERRA_DIRECT_LINK",
    priority: 10,
    altText: "Visiter notre partenaire",
  },
  {
    name: "Adsterra - Bannière espace vendeur",
    placement: "SELLER_DASHBOARD",
    kind: "ADSTERRA_BANNER",
    priority: 10,
  },
  {
    name: "Adsterra - Widget natif espace vendeur",
    placement: "SELLER_DASHBOARD",
    kind: "ADSTERRA_NATIVE",
    priority: 5,
  },
  {
    name: "Adsterra - Bannière confirmation de téléchargement",
    placement: "DOWNLOAD_CONFIRMATION",
    kind: "ADSTERRA_BANNER",
    priority: 10,
  },
  {
    name: "Adsterra - Widget natif confirmation de téléchargement",
    placement: "DOWNLOAD_CONFIRMATION",
    kind: "ADSTERRA_NATIVE",
    priority: 5,
  },
  {
    name: "Adsterra - Lien partenaire confirmation de téléchargement",
    placement: "DOWNLOAD_CONFIRMATION",
    kind: "ADSTERRA_DIRECT_LINK",
    priority: 1,
    altText: "Découvrir notre partenaire",
  },
];

/** Indique si un administrateur existe déjà (l'initialisation est alors verrouillée). */
export async function hasAdmin(): Promise<boolean> {
  const count = await prisma.user.count({ where: { role: "ADMIN" } });
  return count > 0;
}

export interface InitialisationInput {
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  contactEmail?: string;
  whatsappNumber?: string;
}

/** Initialise la plateforme. Refuse de s'exécuter si un administrateur existe déjà. */
export async function runInitialisation(input: InitialisationInput): Promise<void> {
  const passwordHash = await bcrypt.hash(input.adminPassword, 12);

  const contactData: Prisma.PlatformSettingUpdateInput = {
    ...(input.contactEmail ? { contactEmail: input.contactEmail } : {}),
    ...(input.whatsappNumber ? { whatsappNumber: input.whatsappNumber } : {}),
  };

  await prisma.$transaction(
    async (tx) => {
      const adminCount = await tx.user.count({ where: { role: "ADMIN" } });
      if (adminCount > 0) {
        throw new SetupAlreadyDoneError();
      }

      await tx.platformSetting.upsert({
        where: { id: "global" },
        update: contactData,
        create: {
          id: "global",
          ...(input.contactEmail ? { contactEmail: input.contactEmail } : {}),
          ...(input.whatsappNumber ? { whatsappNumber: input.whatsappNumber } : {}),
        },
      });

      for (const category of DEFAULT_CATEGORIES) {
        await tx.category.upsert({
          where: { slug: category.slug },
          update: { name: category.name, description: category.description },
          create: {
            name: category.name,
            slug: category.slug,
            description: category.description,
          },
        });
      }

      const existingUser = await tx.user.findUnique({
        where: { email: input.adminEmail },
        select: { id: true },
      });

      if (existingUser) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            role: "ADMIN",
            isActive: true,
            passwordHash,
            name: input.adminName,
            emailVerified: new Date(),
          },
        });
      } else {
        await tx.user.create({
          data: {
            email: input.adminEmail,
            name: input.adminName,
            passwordHash,
            role: "ADMIN",
            isActive: true,
            emailVerified: new Date(),
          },
        });
      }

      const adCount = await tx.adSpace.count();
      if (adCount === 0) {
        await tx.adSpace.createMany({ data: DEFAULT_ADS });
      }
    },
    { timeout: 30000, maxWait: 15000 }
  );
    }
