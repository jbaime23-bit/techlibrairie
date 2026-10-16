// src/lib/payment-methods.ts
// Moyens de paiement réellement actifs, déduits de la configuration.
// Sert à adapter les textes du site (accueil, pied de page, conditions, confidentialité).

export interface PaymentMethodsInfo {
  // Mobile Money via CinetPay (actif dès que CinetPay est configuré)
  mobileMoney: boolean;
  // Carte bancaire via le guichet CinetPay (CINETPAY_CARD_ENABLED=true)
  cinetPayCard: boolean;
  // Carte bancaire via Stripe (clé et secret de webhook configurés)
  stripeCard: boolean;
  // Au moins un moyen de paiement par carte
  anyCard: boolean;
  // Prestataires de paiement effectivement utilisés
  processors: string[];
}

export function getPaymentMethods(): PaymentMethodsInfo {
  const cinetPayConfigured = Boolean(
    process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID
  );
  const stripeCard = Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET
  );
  const cinetPayCard = cinetPayConfigured && process.env.CINETPAY_CARD_ENABLED === "true";

  const processors: string[] = [];
  if (cinetPayConfigured) processors.push("CinetPay");
  if (stripeCard) processors.push("Stripe");

  return {
    mobileMoney: cinetPayConfigured,
    cinetPayCard,
    stripeCard,
    anyCard: cinetPayCard || stripeCard,
    processors,
  };
}

/** Phrase courte, ex. "Paiement par Mobile Money ou carte bancaire". */
export function paymentSummary(methods: PaymentMethodsInfo): string {
  if (methods.mobileMoney && methods.anyCard) {
    return "Paiement par Mobile Money ou carte bancaire";
  }
  if (methods.mobileMoney) return "Paiement par Mobile Money";
  if (methods.anyCard) return "Paiement par carte bancaire";
  return "Paiement en ligne sécurisé";
}

/** Titre et texte de l'encart « moyens de paiement » de la page d'accueil. */
export function paymentFeature(methods: PaymentMethodsInfo): { title: string; text: string } {
  if (methods.mobileMoney && methods.anyCard) {
    return {
      title: "Mobile Money et cartes bancaires",
      text: "Payez en Mobile Money (Orange Money, Moov Money) pour l'Afrique de l'Ouest et le Burkina Faso, ou par carte bancaire Visa et Mastercard.",
    };
  }
  if (methods.mobileMoney) {
    return {
      title: "Orange Money et Moov Money",
      text: "Payez simplement en Mobile Money, depuis votre téléphone, pour l'Afrique de l'Ouest et le Burkina Faso.",
    };
  }
  if (methods.anyCard) {
    return {
      title: "Cartes bancaires",
      text: "Payez par carte bancaire Visa ou Mastercard, en toute sécurité.",
    };
  }
  return {
    title: "Paiement sécurisé",
    text: "Les moyens de paiement disponibles sont affichés au moment de la commande.",
  };
}

/** Liste des moyens de paiement, avec leur prestataire (pour les conditions générales). */
export function paymentMeansList(methods: PaymentMethodsInfo): string[] {
  const list: string[] = [];

  if (methods.mobileMoney) {
    list.push("par Mobile Money (Orange Money, Moov Money) via le prestataire CinetPay");
  }
  if (methods.cinetPayCard) {
    list.push("par carte bancaire (Visa, Mastercard) via le prestataire CinetPay");
  }
  if (methods.stripeCard) {
    list.push("par carte bancaire (Visa, Mastercard) via le prestataire Stripe");
  }

  return list;
}

/** Moyens de remboursement possibles, ex. "Mobile Money ou carte bancaire". */
export function refundMeansLabel(methods: PaymentMethodsInfo): string {
  const parts: string[] = [];
  if (methods.mobileMoney) parts.push("Mobile Money");
  if (methods.anyCard) parts.push("carte bancaire");
  return parts.length > 0 ? parts.join(" ou ") : "le moyen de paiement utilisé";
}
