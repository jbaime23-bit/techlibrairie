// src/lib/personal-data.ts
// Construction de l'export des données personnelles d'un utilisateur.
// Ne contient JAMAIS : mot de passe, clés de double authentification, liens de
// téléchargement, empreintes de connexion, ni les données d'autres utilisateurs.

import { prisma } from "@/lib/prisma";

const MAX_ROWS = 500;

export async function buildPersonalDataExport(
  userId: string
): Promise<Record<string, unknown> | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phone: true,
      role: true,
      emailVerified: true,
      reminderEmails: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  const [orders, threads, contacts, reviews, favorites, seller] = await Promise.all([
    prisma.order.findMany({
      where: { buyerId: userId },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      include: {
        items: {
          select: { productTitle: true, unitAmount: true, currency: true },
        },
        payments: {
          select: {
            provider: true,
            method: true,
            status: true,
            amount: true,
            currency: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.supportThread.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 2000,
          select: { isStaff: true, body: true, createdAt: true },
        },
      },
    }),
    prisma.contactMessage.findMany({
      where: {
        OR: [{ userId }, { email: { equals: user.email, mode: "insensitive" } }],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        subject: true,
        message: true,
        phone: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.review.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      select: {
        rating: true,
        comment: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        product: { select: { title: true } },
      },
    }),
    prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      select: {
        createdAt: true,
        product: { select: { title: true } },
      },
    }),
    prisma.sellerProfile.findUnique({
      where: { userId },
      include: {
        products: {
          orderBy: { createdAt: "desc" },
          take: MAX_ROWS,
          select: {
            title: true,
            slug: true,
            priceAmount: true,
            currency: true,
            status: true,
            publishedAt: true,
            salesCount: true,
          },
        },
        payouts: {
          orderBy: { requestedAt: "desc" },
          take: MAX_ROWS,
          select: {
            amount: true,
            currency: true,
            status: true,
            method: true,
            reference: true,
            note: true,
            requestedAt: true,
            paidAt: true,
          },
        },
      },
    }),
  ]);

  return {
    export: {
      genere_le: new Date().toISOString(),
      site: "TechLibrairie",
      avertissement:
        "Ce fichier contient des données personnelles : conservez-le en lieu sûr et ne le partagez pas.",
    },
    compte: {
      nom: user.name,
      email: user.email,
      telephone: user.phone,
      type_de_compte: user.role,
      email_verifie_le: user.emailVerified,
      rappels_par_email_actives: user.reminderEmails,
      inscrit_le: user.createdAt,
    },
    commandes: orders.map((order) => ({
      numero: order.number,
      statut: order.status,
      total: order.totalAmount,
      devise: order.currency,
      creee_le: order.createdAt,
      payee_le: order.paidAt,
      ouvrages: order.items.map((item) => ({
        titre: item.productTitle,
        prix: item.unitAmount,
        devise: item.currency,
      })),
      paiements: order.payments.map((payment) => ({
        prestataire: payment.provider,
        moyen: payment.method,
        statut: payment.status,
        montant: payment.amount,
        devise: payment.currency,
        date: payment.createdAt,
      })),
    })),
    conversations_support: threads.map((thread) => ({
      numero: thread.number,
      sujet: thread.subject,
      categorie: thread.category,
      statut: thread.status,
      tarif_fcfa: thread.feeAmountXof,
      ouverte_le: thread.createdAt,
      payee_le: thread.paidAt,
      messages: thread.messages.map((message) => ({
        de: message.isStaff ? "Équipe TechLibrairie" : "Vous",
        date: message.createdAt,
        texte: message.body,
      })),
    })),
    messages_de_contact: contacts.map((contact) => ({
      sujet: contact.subject,
      message: contact.message,
      telephone: contact.phone,
      statut: contact.status,
      envoye_le: contact.createdAt,
    })),
    avis: reviews.map((review) => ({
      ouvrage: review.product.title,
      note_sur_5: review.rating,
      commentaire: review.comment,
      statut: review.status === "PUBLISHED" ? "publié" : "masqué par la modération",
      publie_le: review.createdAt,
      modifie_le: review.updatedAt,
    })),
    favoris: favorites.map((favorite) => ({
      ouvrage: favorite.product.title,
      ajoute_le: favorite.createdAt,
    })),
    profil_vendeur: seller
      ? {
          nom_public: seller.displayName,
          adresse_publique: seller.slug,
          presentation: seller.bio,
          statut: seller.status,
          taux_de_commission_pour_cent:
            seller.commissionRateBps !== null ? seller.commissionRateBps / 100 : null,
          operateur_de_versement: seller.payoutMobileOperator,
          numero_de_versement: seller.payoutMobileNumber,
          cree_le: seller.createdAt,
          ouvrages: seller.products.map((product) => ({
            titre: product.title,
            adresse: product.slug,
            prix: product.priceAmount,
            devise: product.currency,
            statut: product.status,
            publie_le: product.publishedAt,
            ventes: product.salesCount,
          })),
          versements: seller.payouts.map((payout) => ({
            montant: payout.amount,
            devise: payout.currency,
            statut: payout.status,
            moyen: payout.method,
            reference: payout.reference,
            note: payout.note,
            demande_le: payout.requestedAt,
            verse_le: payout.paidAt,
          })),
        }
      : null,
  };
      }
