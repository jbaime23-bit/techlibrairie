// src/lib/backup.ts
// Jeux de données de la sauvegarde de secours (page /admin/sauvegarde).
// Ne contient JAMAIS : mots de passe, clés de double authentification, jetons de connexion ou de
// téléchargement, empreintes de connexion, coordonnées bancaires.

import { prisma } from "@/lib/prisma";
import { MAX_EXPORT_ROWS, type Cell } from "@/lib/csv";

export class BackupTooLargeError extends Error {
  constructor(label: string) {
    super(`Trop de lignes dans « ${label} » pour un seul fichier.`);
    this.name = "BackupTooLargeError";
  }
}

export interface BackupDataset {
  key: string;
  label: string;
  description: string;
  headers: string[];
  count: () => Promise<number>;
  rows: () => Promise<Cell[][]>;
}

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function yesNo(value: boolean): string {
  return value ? "oui" : "non";
}

function jsonCell(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

function dataset<T>(config: {
  key: string;
  label: string;
  description: string;
  headers: string[];
  count: () => Promise<number>;
  load: () => Promise<T[]>;
  toRow: (item: T) => Cell[];
}): BackupDataset {
  return {
    key: config.key,
    label: config.label,
    description: config.description,
    headers: config.headers,
    count: config.count,
    rows: async () => {
      const items = await config.load();
      if (items.length > MAX_EXPORT_ROWS) {
        throw new BackupTooLargeError(config.label);
      }
      return items.map(config.toRow);
    },
  };
}

const LIMIT = MAX_EXPORT_ROWS + 1;

export const BACKUP_DATASETS: BackupDataset[] = [
  dataset({
    key: "utilisateurs",
    label: "Comptes utilisateurs",
    description: "Nom, email, téléphone, rôle, état (sans mots de passe ni clés de sécurité).",
    headers: ["id", "nom", "email", "telephone", "role", "actif", "email_verifie_le", "rappels", "cree_le"],
    count: () => prisma.user.count(),
    load: () =>
      prisma.user.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          emailVerified: true,
          reminderEmails: true,
          createdAt: true,
        },
      }),
    toRow: (user) => [
      user.id,
      user.name,
      user.email,
      user.phone,
      user.role,
      yesNo(user.isActive),
      iso(user.emailVerified),
      yesNo(user.reminderEmails),
      iso(user.createdAt),
    ],
  }),

  dataset({
    key: "vendeurs",
    label: "Profils vendeurs",
    description: "Nom public, commission, numéro de versement (sans coordonnées bancaires).",
    headers: [
      "id",
      "compte_id",
      "nom_public",
      "adresse",
      "presentation",
      "statut",
      "commission_points_de_base",
      "operateur_versement",
      "numero_versement",
      "cree_le",
    ],
    count: () => prisma.sellerProfile.count(),
    load: () =>
      prisma.sellerProfile.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
        select: {
          id: true,
          userId: true,
          displayName: true,
          slug: true,
          bio: true,
          status: true,
          commissionRateBps: true,
          payoutMobileOperator: true,
          payoutMobileNumber: true,
          createdAt: true,
        },
      }),
    toRow: (seller) => [
      seller.id,
      seller.userId,
      seller.displayName,
      seller.slug,
      seller.bio,
      seller.status,
      seller.commissionRateBps,
      seller.payoutMobileOperator,
      seller.payoutMobileNumber,
      iso(seller.createdAt),
    ],
  }),

  dataset({
    key: "categories",
    label: "Catégories",
    description: "Catégories du catalogue.",
    headers: ["id", "nom", "adresse", "description", "cree_le"],
    count: () => prisma.category.count(),
    load: () =>
      prisma.category.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
        select: { id: true, name: true, slug: true, description: true, createdAt: true },
      }),
    toRow: (category) => [
      category.id,
      category.name,
      category.slug,
      category.description,
      iso(category.createdAt),
    ],
  }),

  dataset({
    key: "ouvrages",
    label: "Ouvrages",
    description: "Fiches des ouvrages, avec le nom du fichier PDF stocké chez Vercel Blob.",
    headers: [
      "id",
      "vendeur_id",
      "categorie_id",
      "titre",
      "adresse",
      "description",
      "langue",
      "pages",
      "prix",
      "devise",
      "couverture_url",
      "pdf_cle_de_stockage",
      "pdf_nom",
      "pdf_taille_octets",
      "statut",
      "publie_le",
      "ventes",
      "note_moyenne",
      "nombre_avis",
      "cree_le",
    ],
    count: () => prisma.product.count(),
    load: () =>
      prisma.product.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
        select: {
          id: true,
          sellerId: true,
          categoryId: true,
          title: true,
          slug: true,
          description: true,
          language: true,
          pageCount: true,
          priceAmount: true,
          currency: true,
          coverImageUrl: true,
          pdfStorageKey: true,
          pdfFileName: true,
          pdfSizeBytes: true,
          status: true,
          publishedAt: true,
          salesCount: true,
          ratingAverage: true,
          ratingCount: true,
          createdAt: true,
        },
      }),
    toRow: (product) => [
      product.id,
      product.sellerId,
      product.categoryId,
      product.title,
      product.slug,
      product.description,
      product.language,
      product.pageCount,
      product.priceAmount,
      product.currency,
      product.coverImageUrl,
      product.pdfStorageKey,
      product.pdfFileName,
      product.pdfSizeBytes,
      product.status,
      iso(product.publishedAt),
      product.salesCount,
      product.ratingAverage,
      product.ratingCount,
      iso(product.createdAt),
    ],
  }),

  dataset({
    key: "commandes",
    label: "Commandes",
    description: "Commandes avec leur statut, leur montant payé et leur code promotionnel.",
    headers: [
      "id",
      "numero",
      "acheteur_id",
      "acheteur_email",
      "statut",
      "total_paye",
      "devise",
      "code_promo_id",
      "remise",
      "payee_le",
      "creee_le",
    ],
    count: () => prisma.order.count(),
    load: () =>
      prisma.order.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
        select: {
          id: true,
          number: true,
          buyerId: true,
          buyerEmail: true,
          status: true,
          totalAmount: true,
          currency: true,
          promoCodeId: true,
          discountAmount: true,
          paidAt: true,
          createdAt: true,
        },
      }),
    toRow: (order) => [
      order.id,
      order.number,
      order.buyerId,
      order.buyerEmail,
      order.status,
      order.totalAmount,
      order.currency,
      order.promoCodeId,
      order.discountAmount,
      iso(order.paidAt),
      iso(order.createdAt),
    ],
  }),

  dataset({
    key: "lignes-commandes",
    label: "Lignes de commandes",
    description: "Un ouvrage par ligne : prix payé, remise, commission et part du vendeur.",
    headers: [
      "id",
      "commande_id",
      "ouvrage_id",
      "vendeur_id",
      "titre",
      "prix_paye",
      "devise",
      "prix_catalogue",
      "remise",
      "commission_points_de_base",
      "commission",
      "part_vendeur",
      "cree_le",
    ],
    count: () => prisma.orderItem.count(),
    load: () =>
      prisma.orderItem.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
        select: {
          id: true,
          orderId: true,
          productId: true,
          sellerId: true,
          productTitle: true,
          unitAmount: true,
          currency: true,
          listAmount: true,
          discountAmount: true,
          commissionRateBps: true,
          commissionAmount: true,
          sellerAmount: true,
          createdAt: true,
        },
      }),
    toRow: (item) => [
      item.id,
      item.orderId,
      item.productId,
      item.sellerId,
      item.productTitle,
      item.unitAmount,
      item.currency,
      item.listAmount,
      item.discountAmount,
      item.commissionRateBps,
      item.commissionAmount,
      item.sellerAmount,
      iso(item.createdAt),
    ],
  }),

  dataset({
    key: "paiements",
    label: "Paiements",
    description: "Paiements CinetPay et Stripe, avec leur référence chez le prestataire.",
    headers: [
      "id",
      "commande_id",
      "prestataire",
      "moyen",
      "statut",
      "montant",
      "devise",
      "montant_fcfa_de_reference",
      "taux",
      "reference_prestataire",
      "details",
      "cree_le",
    ],
    count: () => prisma.payment.count(),
    load: () =>
      prisma.payment.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
        select: {
          id: true,
          orderId: true,
          provider: true,
          method: true,
          status: true,
          amount: true,
          currency: true,
          baseAmountXof: true,
          exchangeRate: true,
          providerReference: true,
          providerPayload: true,
          createdAt: true,
        },
      }),
    toRow: (payment) => [
      payment.id,
      payment.orderId,
      payment.provider,
      payment.method,
      payment.status,
      payment.amount,
      payment.currency,
      payment.baseAmountXof,
      payment.exchangeRate ? payment.exchangeRate.toString() : null,
      payment.providerReference,
      jsonCell(payment.providerPayload),
      iso(payment.createdAt),
    ],
  }),

  dataset({
    key: "versements",
    label: "Versements aux vendeurs",
    description: "Demandes de versement, statuts, références des transactions.",
    headers: [
      "id",
      "vendeur_id",
      "montant",
      "devise",
      "statut",
      "operateur",
      "reference",
      "note",
      "demande_le",
      "verse_le",
    ],
    count: () => prisma.payout.count(),
    load: () =>
      prisma.payout.findMany({
        orderBy: { requestedAt: "asc" },
        take: LIMIT,
        select: {
          id: true,
          sellerId: true,
          amount: true,
          currency: true,
          status: true,
          method: true,
          reference: true,
          note: true,
          requestedAt: true,
          paidAt: true,
        },
      }),
    toRow: (payout) => [
      payout.id,
      payout.sellerId,
      payout.amount,
      payout.currency,
      payout.status,
      payout.method,
      payout.reference,
      payout.note,
      iso(payout.requestedAt),
      iso(payout.paidAt),
    ],
  }),

  dataset({
    key: "avis",
    label: "Avis",
    description: "Notes et commentaires des acheteurs.",
    headers: [
      "id",
      "ouvrage_id",
      "compte_id",
      "note",
      "commentaire",
      "statut",
      "cree_le",
      "modifie_le",
    ],
    count: () => prisma.review.count(),
    load: () =>
      prisma.review.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
        select: {
          id: true,
          productId: true,
          userId: true,
          rating: true,
          comment: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    toRow: (review) => [
      review.id,
      review.productId,
      review.userId,
      review.rating,
      review.comment,
      review.status,
      iso(review.createdAt),
      iso(review.updatedAt),
    ],
  }),

  dataset({
    key: "codes-promo",
    label: "Codes promotionnels",
    description: "Codes, règles, limites et dates de validité.",
    headers: [
      "id",
      "code",
      "note",
      "type",
      "valeur",
      "repartition",
      "achat_minimum",
      "debut",
      "fin",
      "utilisations_max",
      "par_acheteur",
      "actif",
      "cree_le",
    ],
    count: () => prisma.promoCode.count(),
    load: () =>
      prisma.promoCode.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
        select: {
          id: true,
          code: true,
          description: true,
          type: true,
          value: true,
          bearer: true,
          minOrderAmountXof: true,
          startsAt: true,
          endsAt: true,
          maxRedemptions: true,
          maxPerUser: true,
          isActive: true,
          createdAt: true,
        },
      }),
    toRow: (promo) => [
      promo.id,
      promo.code,
      promo.description,
      promo.type,
      promo.value,
      promo.bearer,
      promo.minOrderAmountXof,
      iso(promo.startsAt),
      iso(promo.endsAt),
      promo.maxRedemptions,
      promo.maxPerUser,
      yesNo(promo.isActive),
      iso(promo.createdAt),
    ],
  }),

  dataset({
    key: "support",
    label: "Conversations de support",
    description: "Conversations (sujet, statut, tarif, dates).",
    headers: [
      "id",
      "numero",
      "compte_id",
      "sujet",
      "categorie",
      "statut",
      "tarif_fcfa",
      "payee_le",
      "assignee_a_id",
      "dernier_message_le",
      "cloturee_le",
      "creee_le",
    ],
    count: () => prisma.supportThread.count(),
    load: () =>
      prisma.supportThread.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
        select: {
          id: true,
          number: true,
          userId: true,
          subject: true,
          category: true,
          status: true,
          feeAmountXof: true,
          paidAt: true,
          assignedToId: true,
          lastMessageAt: true,
          closedAt: true,
          createdAt: true,
        },
      }),
    toRow: (thread) => [
      thread.id,
      thread.number,
      thread.userId,
      thread.subject,
      thread.category,
      thread.status,
      thread.feeAmountXof,
      iso(thread.paidAt),
      thread.assignedToId,
      iso(thread.lastMessageAt),
      iso(thread.closedAt),
      iso(thread.createdAt),
    ],
  }),

  dataset({
    key: "messages-support",
    label: "Messages de support",
    description: "Contenu des échanges avec les utilisateurs (données personnelles).",
    headers: ["id", "conversation_id", "expediteur_id", "equipe", "texte", "lu_le", "envoye_le"],
    count: () => prisma.message.count(),
    load: () =>
      prisma.message.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
        select: {
          id: true,
          threadId: true,
          senderId: true,
          isStaff: true,
          body: true,
          readAt: true,
          createdAt: true,
        },
      }),
    toRow: (message) => [
      message.id,
      message.threadId,
      message.senderId,
      yesNo(message.isStaff),
      message.body,
      iso(message.readAt),
      iso(message.createdAt),
    ],
  }),

  dataset({
    key: "publicites",
    label: "Publicités",
    description: "Emplacements publicitaires, annonceurs locaux, statistiques.",
    headers: [
      "id",
      "nom",
      "emplacement",
      "type",
      "actif",
      "priorite",
      "annonceur",
      "annonceur_email",
      "annonceur_telephone",
      "image_url",
      "lien",
      "texte_alternatif",
      "prix_fcfa",
      "debut",
      "fin",
      "vues",
      "clics",
      "cree_le",
    ],
    count: () => prisma.adSpace.count(),
    load: () =>
      prisma.adSpace.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
        select: {
          id: true,
          name: true,
          placement: true,
          kind: true,
          isActive: true,
          priority: true,
          advertiserName: true,
          advertiserEmail: true,
          advertiserPhone: true,
          imageUrl: true,
          targetUrl: true,
          altText: true,
          priceAmountXof: true,
          startsAt: true,
          endsAt: true,
          impressions: true,
          clicks: true,
          createdAt: true,
        },
      }),
    toRow: (ad) => [
      ad.id,
      ad.name,
      ad.placement,
      ad.kind,
      yesNo(ad.isActive),
      ad.priority,
      ad.advertiserName,
      ad.advertiserEmail,
      ad.advertiserPhone,
      ad.imageUrl,
      ad.targetUrl,
      ad.altText,
      ad.priceAmountXof,
      iso(ad.startsAt),
      iso(ad.endsAt),
      ad.impressions,
      ad.clicks,
      iso(ad.createdAt),
    ],
  }),

  dataset({
    key: "taux",
    label: "Taux de change",
    description: "Historique des taux de change saisis.",
    headers: ["id", "devise", "fcfa_pour_1_unite", "source", "actif", "cree_le"],
    count: () => prisma.exchangeRate.count(),
    load: () =>
      prisma.exchangeRate.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
        select: {
          id: true,
          currency: true,
          xofPerUnit: true,
          source: true,
          isActive: true,
          createdAt: true,
        },
      }),
    toRow: (rate) => [
      rate.id,
      rate.currency,
      rate.xofPerUnit.toString(),
      rate.source,
      yesNo(rate.isActive),
      iso(rate.createdAt),
    ],
  }),

  dataset({
    key: "parametres",
    label: "Paramètres de la plateforme",
    description: "Commission par défaut, durées, tarif du support, contacts.",
    headers: [
      "id",
      "commission_defaut_points_de_base",
      "duree_lien_heures",
      "telechargements_max",
      "versement_minimum_fcfa",
      "marge_change_points_de_base",
      "tarif_support_fcfa",
      "email_contact",
      "whatsapp",
      "modifie_le",
    ],
    count: () => prisma.platformSetting.count(),
    load: () =>
      prisma.platformSetting.findMany({
        orderBy: { id: "asc" },
        take: LIMIT,
        select: {
          id: true,
          defaultCommissionRateBps: true,
          downloadLinkTtlHours: true,
          downloadMaxAttempts: true,
          minPayoutAmountXof: true,
          fxMarginBps: true,
          supportFeeXof: true,
          contactEmail: true,
          whatsappNumber: true,
          updatedAt: true,
        },
      }),
    toRow: (setting) => [
      setting.id,
      setting.defaultCommissionRateBps,
      setting.downloadLinkTtlHours,
      setting.downloadMaxAttempts,
      setting.minPayoutAmountXof,
      setting.fxMarginBps,
      setting.supportFeeXof,
      setting.contactEmail,
      setting.whatsappNumber,
      iso(setting.updatedAt),
    ],
  }),

  dataset({
    key: "journal",
    label: "Journal des actions",
    description: "Historique des actions d'administration (sans empreintes de connexion).",
    headers: ["id", "administrateur", "action", "cible_type", "cible_id", "details", "date"],
    count: () => prisma.auditLog.count(),
    load: () =>
      prisma.auditLog.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
        select: {
          id: true,
          adminEmail: true,
          action: true,
          targetType: true,
          targetId: true,
          details: true,
          createdAt: true,
        },
      }),
    toRow: (entry) => [
      entry.id,
      entry.adminEmail,
      entry.action,
      entry.targetType,
      entry.targetId,
      jsonCell(entry.details),
      iso(entry.createdAt),
    ],
  }),
];

export function findDataset(key: string | null): BackupDataset | null {
  return BACKUP_DATASETS.find((item) => item.key === key) ?? null;
}
