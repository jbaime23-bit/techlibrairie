// prisma/seed.ts
// TechLibrairie - Initialisation de la base de données
// Crée : les paramètres globaux, le compte administrateur et les catégories.

import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CATEGORIES: { name: string; slug: string; description: string }[] = [
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

async function seedPlatformSettings(): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      defaultCommissionRateBps: 1000, // 10 %
      downloadLinkTtlHours: 72,
      downloadMaxAttempts: 5,
      minPayoutAmountXof: 5000,
    },
  });
  console.log("✔ Paramètres globaux prêts (commission par défaut : 10 %).");
}

async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans le fichier .env avant de lancer le seed."
    );
  }

  if (password.length < 12) {
    throw new Error(
      "ADMIN_PASSWORD doit contenir au moins 12 caractères."
    );
  }

  if (password.startsWith("remplacez-par")) {
    throw new Error(
      "ADMIN_PASSWORD contient encore la valeur d'exemple. Choisissez un vrai mot de passe fort."
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { role: Role.ADMIN, isActive: true },
    });
    console.log(`✔ Compte administrateur existant conservé : ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      name: "Administrateur",
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      emailVerified: new Date(),
    },
  });
  console.log(`✔ Compte administrateur créé : ${email}`);
}

async function seedCategories(): Promise<void> {
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
      },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
      },
    });
  }
  console.log(`✔ ${CATEGORIES.length} catégories prêtes.`);
}

async function main(): Promise<void> {
  console.log("Initialisation de TechLibrairie...");
  await seedPlatformSettings();
  await seedAdmin();
  await seedCategories();
  console.log("Initialisation terminée.");
}

main()
  .catch((error) => {
    console.error("Échec de l'initialisation :", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
