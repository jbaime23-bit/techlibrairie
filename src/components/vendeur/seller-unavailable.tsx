// src/components/vendeur/seller-unavailable.tsx
import Link from "next/link";

type Reason = "unauthenticated" | "no-profile" | "suspended";

const MESSAGES: Record<Reason, { title: string; text: string }> = {
  unauthenticated: {
    title: "Connexion requise",
    text: "Veuillez vous connecter pour accéder à l'espace vendeur.",
  },
  "no-profile": {
    title: "Aucun profil vendeur",
    text: "Ce compte n'a pas de profil vendeur. Pour vendre des PDF, créez un compte de type « Vendeur ».",
  },
  suspended: {
    title: "Compte vendeur suspendu",
    text: "Votre compte vendeur est suspendu. Contactez l'administration de TechLibrairie pour en savoir plus.",
  },
};

export function SellerUnavailable({ reason }: { reason: Reason }) {
  const message = MESSAGES[reason];

  return (
    <div className="card mx-auto max-w-lg text-center">
      <h1 className="text-xl font-bold">{message.title}</h1>
      <p className="mt-2 text-sm text-slate-600">{message.text}</p>
      <div className="mt-6">
        <Link href="/" className="btn-secondary">
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
