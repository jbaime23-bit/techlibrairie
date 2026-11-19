// src/lib/personal-data.ts
// Construction de l'export des données personnelles d'un utilisateur.
// Ne contient JAMAIS : mot de passe, clés de double authentification, liens de
// téléchargement, empreintes de connexion, ni les données d'autres utilisateurs.

import { prisma } from "@/lib/prisma";

const MAX_ROWS = 500;

async function loadEditionData(sellerId: string, productIds: string[]) {
  const [projects, fees, printFormats, printSales] = await Promise.all([
    prisma.editionProject.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      select: {
        productId: true,
        stage: true,
        contractVersion: true,
        contractAcceptedAt: true,
        signerName: true,
        signerEmail: true,
        serviceStartRequested: true,
        manuscriptFileName: true,
        proofVersion: true,
        correctionRounds: true,
        approvedAt: true,
        approvedByName: true,
        refusalReason: true,
        createdAt: true,
      },
    }),
    productIds.length
      ? prisma.publicationFee.findMany({
          where: { productId: { in: productIds } },
          take: MAX_ROWS,
          select: {
            productId: true,
            amountXof: true,
            status: true,
            method: true,
            payerPhone: true,
            paymentReference: true,
            submittedAt: true,
            validatedAt: true,
            rejectionReason: true,
          },
        })
      : Promise.resolve([]),
    productIds.length
      ? prisma.printEdition.findMany({
          where: { productId: { in: productIds } },
          take: MAX_ROWS,
          select: {
            productId: true,
            status: true,
            pageCount: true,
            printCostXof: true,
            isbnPrint: true,
            retailPriceXof: true,
          },
        })
      : Promise.resolve([]),
    prisma.printOrder.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      select: {
        number: true,
        productTitle: true,
        quantity: true,
        isAuthorCopy: true,
        authorNetXof: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  return { projects, fees, printFormats, printSales };
}

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

  const [orders, printOrders, submissions, threads, contacts, reviews, favorites, seller] =
    await Promise.all([
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
      prisma.printOrder.findMany({
        where: { buyerId: userId },
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS,
        select: {
          number: true,
          productTitle: true,
          quantity: true,
          isAuthorCopy: true,
          unitPriceXof: true,
          shippingXof: true,
          totalXof: true,
          status: true,
          shipName: true,
          shipStreet1: true,
          shipStreet2: true,
          shipCity: true,
          shipState: true,
          shipPostcode: true,
          shipCountry: true,
          shipPhone: true,
          paymentMethod: true,
          payerPhone: true,
          paymentReference: true,
          paymentSubmittedAt: true,
          paidAt: true,
          trackingUrls: true,
          shippedAt: true,
          deliveredAt: true,
          createdAt: true,
        },
      }),
      prisma.manuscriptSubmission.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS,
        select: {
          title: true,
          description: true,
          authorName: true,
          capacity: true,
          language: true,
          pageCount: true,
          manuscriptFileName: true,
          status: true,
          rightsAcceptedAt: true,
          reviewConsentAt: true,
          decisionMessage: true,
          decidedAt: true,
          createdAt: true,
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
              id: true,
              title: true,
              slug: true,
              kind: true,
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

  const edition = seller
    ? await loadEditionData(
        seller.id,
        seller.products.map((product) => product.id)
      )
    : null;

  const titleOf = (productId: string): string | null =>
    seller?.products.find((product) => product.id === productId)?.title ?? null;

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
    commandes_imprimees: printOrders.map((order) => ({
      numero: order.number,
      ouvrage: order.productTitle,
      quantite: order.quantity,
      exemplaires_d_auteur: order.isAuthorCopy,
      prix_unitaire_fcfa: order.unitPriceXof,
      livraison_fcfa: order.shippingXof,
      total_fcfa: order.totalXof,
      statut: order.status,
      adresse_de_livraison: {
        nom: order.shipName,
        adresse: order.shipStreet1,
        complement: order.shipStreet2,
        ville: order.shipCity,
        etat_ou_province: order.shipState,
        code_postal: order.shipPostcode,
        pays: order.shipCountry,
        telephone: order.shipPhone,
      },
      paiement_declare: {
        moyen: order.paymentMethod,
        telephone_expediteur: order.payerPhone,
        reference: order.paymentReference,
        declare_le: order.paymentSubmittedAt,
        valide_le: order.paidAt,
      },
      suivi_du_colis: order.trackingUrls,
      expediee_le: order.shippedAt,
      livree_le: order.deliveredAt,
      creee_le: order.createdAt,
    })),
    manuscrits_soumis: submissions.map((submission) => ({
      titre: submission.title,
      resume: submission.description,
      auteur_affiche: submission.authorName,
      qualite: submission.capacity,
      langue: submission.language,
      pages: submission.pageCount,
      fichier: submission.manuscriptFileName,
      statut: submission.status,
      droits_declares_le: submission.rightsAcceptedAt,
      examen_accepte_le: submission.reviewConsentAt,
      message_de_decision: submission.decisionMessage,
      decide_le: submission.decidedAt,
      soumis_le: submission.createdAt,
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
          photo_d_auteur: seller.avatarUrl,
          statut: seller.status,
          taux_de_commission_pour_cent:
            seller.commissionRateBps !== null ? seller.commissionRateBps / 100 : null,
          operateur_de_versement: seller.payoutMobileOperator,
          numero_de_versement: seller.payoutMobileNumber,
          cree_le: seller.createdAt,
          ouvrages: seller.products.map((product) => ({
            titre: product.title,
            adresse: product.slug,
            service: product.kind === "BOOK_EDITION" ? "édition à compte d'auteur" : "vente de PDF",
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
    editions_a_compte_d_auteur: edition
      ? edition.projects.map((project) => {
          const fee = edition.fees.find((item) => item.productId === project.productId);

          return {
            ouvrage: titleOf(project.productId),
            etape: project.stage,
            contrat: {
              version: project.contractVersion,
              accepte_le: project.contractAcceptedAt,
              signature_saisie: project.signerName,
              adresse_email_du_compte: project.signerEmail,
              debut_de_prestation_demande: project.serviceStartRequested,
            },
            manuscrit: project.manuscriptFileName,
            epreuve_version: project.proofVersion,
            corrections_demandees: project.correctionRounds,
            bon_a_tirer_approuve_le: project.approvedAt,
            bon_a_tirer_approuve_par: project.approvedByName,
            motif_de_refus: project.refusalReason,
            forfait: fee
              ? {
                  montant_fcfa: fee.amountXof,
                  statut: fee.status,
                  moyen: fee.method,
                  telephone_expediteur: fee.payerPhone,
                  reference: fee.paymentReference,
                  declare_le: fee.submittedAt,
                  valide_le: fee.validatedAt,
                  motif_de_rejet: fee.rejectionReason,
                }
              : null,
            cree_le: project.createdAt,
          };
        })
      : [],
    formats_imprimes: edition
      ? edition.printFormats.map((format) => ({
          ouvrage: titleOf(format.productId),
          statut: format.status,
          pages: format.pageCount,
          cout_de_fabrication_fcfa: format.printCostXof,
          isbn_du_livre_imprime: format.isbnPrint,
          prix_de_l_exemplaire_fcfa: format.retailPriceXof,
        }))
      : [],
    ventes_d_exemplaires_imprimes: edition
      ? edition.printSales.map((sale) => ({
          numero: sale.number,
          ouvrage: sale.productTitle,
          quantite: sale.quantity,
          exemplaires_d_auteur: sale.isAuthorCopy,
          gain_fcfa: sale.authorNetXof,
          statut: sale.status,
          date: sale.createdAt,
        }))
      : [],
  };
        }
