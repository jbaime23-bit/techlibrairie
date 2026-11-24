// src/lib/auth-spaces.ts
// Les trois portes d'entrée de la plateforme : l'espace auteur (Édition) et les espaces acheteur et
// vendeur (Boutique). Chacune a son habillage et sa page de destination ; l'identité reste unique
// (une adresse email = un compte).

export type SpaceKey = "edition" | "acheteur" | "vendeur";

export interface AuthSpace {
  key: SpaceKey;
  // Habillage visuel (voir AuthShell)
  tone: SpaceKey;
  label: string;
  accountType: "BUYER" | "SELLER";
  loginPath: string;
  registerPath: string;
  // Page où l'on arrive après la connexion ou l'inscription
  defaultCallback: string;
  loginTitle: string;
  loginSubtitle: string;
  registerTitle: string;
  registerSubtitle: string;
  perks: string[];
  displayNameLabel: string;
  sellerNote: string;
  submitLabel: string;
}

export const AUTH_SPACES: Record<SpaceKey, AuthSpace> = {
  edition: {
    key: "edition",
    tone: "edition",
    label: "Espace auteur",
    accountType: "SELLER",
    loginPath: "/edition/connexion",
    registerPath: "/edition/inscription",
    defaultCallback: "/edition/deposer",
    loginTitle: "Espace auteur",
    loginSubtitle: "Connectez-vous pour déposer votre manuscrit et suivre vos éditions.",
    registerTitle: "Créer mon espace auteur",
    registerSubtitle: "Un compte gratuit pour déposer vos projets et suivre chaque étape de votre édition.",
    perks: [
      "Un dépôt en quelques étapes simples",
      "Le suivi de votre édition, du manuscrit à la publication",
      "Votre contrat signé en ligne et téléchargeable en PDF",
    ],
    displayNameLabel: "Nom d'auteur (affiché publiquement)",
    sellerNote:
      "Ce nom figure sur la page de vos livres. Vous pouvez utiliser un pseudonyme.",
    submitLabel: "Créer mon espace auteur",
  },
  acheteur: {
    key: "acheteur",
    tone: "acheteur",
    label: "Espace acheteur",
    accountType: "BUYER",
    loginPath: "/boutique/acheteur/connexion",
    registerPath: "/boutique/acheteur/inscription",
    defaultCallback: "/acheteur",
    loginTitle: "Espace acheteur",
    loginSubtitle: "Retrouvez vos achats et téléchargez vos livres en PDF.",
    registerTitle: "Créer mon compte acheteur",
    registerSubtitle: "Achetez des livres et guides techniques, puis téléchargez-les immédiatement.",
    perks: [
      "Téléchargement immédiat après paiement",
      "Vos achats toujours disponibles dans votre espace",
      "Vos favoris et le suivi de vos livres imprimés",
    ],
    displayNameLabel: "Nom affiché",
    sellerNote: "",
    submitLabel: "Créer mon compte acheteur",
  },
  vendeur: {
    key: "vendeur",
    tone: "vendeur",
    label: "Espace vendeur",
    accountType: "SELLER",
    loginPath: "/boutique/vendeur/connexion",
    registerPath: "/boutique/vendeur/inscription",
    defaultCallback: "/vendeur",
    loginTitle: "Espace vendeur",
    loginSubtitle: "Gérez vos PDF, suivez vos ventes et demandez vos versements.",
    registerTitle: "Créer mon compte vendeur",
    registerSubtitle:
      "Mettez vos documents et ressources en vente : ils sont vérifiés, puis mis en ligne par TechLibrairie.",
    perks: [
      "Mise en ligne de vos PDF après validation par TechLibrairie",
      "Suivi de vos ventes et de vos revenus",
      "Versements par Mobile Money",
    ],
    displayNameLabel: "Nom de vendeur ou d'éditeur (affiché publiquement)",
    sellerNote:
      "Vos PDF sont vérifiés par TechLibrairie avant d'être mis en vente. Une commission est prélevée sur chaque vente.",
    submitLabel: "Créer mon compte vendeur",
  },
};

export function isSpaceKey(value: string): value is SpaceKey {
  return value === "edition" || value === "acheteur" || value === "vendeur";
}
