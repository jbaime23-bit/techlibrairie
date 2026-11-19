// src/lib/backup-print.ts
// Jeux de données de la sauvegarde de secours pour l'édition et l'impression à la demande :
// formats imprimés, commandes imprimées, manuscrits soumis, éditions à compte d'auteur et forfaits.
// Ne contient JAMAIS : empreintes de connexion (IP), mots de passe, jetons.
// Ce fichier n'importe aucune valeur de backup.ts (types seulement), pour éviter une dépendance circulaire.

import { prisma } from "@/lib/prisma";
import { MAX_EXPORT_ROWS, type Cell } from "@/lib/csv";
import type { BackupDataset } from "@/lib/backup";

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function yesNo(value: boolean): string {
  return value ? "oui" : "non";
}

const LIMIT = MAX_EXPORT_ROWS + 1;

function makeDataset<T>(config: {
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
        throw new Error(`Trop de lignes dans « ${config.label} » pour un seul fichier.`);
      }

      return items.map(config.toRow);
    },
  };
}

export const PRINT_BACKUP_DATASETS: BackupDataset[] = [
  makeDataset({
    key: "formats-imprimes",
    label: "Formats imprimés (impression à la demande)",
    description: "Code d'impression, coût de fabrication, ISBN du livre imprimé, prix fixé par l'auteur.",
    headers: [
      "id",
      "ouvrage_id",
      "statut",
      "code_impression",
      "pages",
      "cout_fabrication_fcfa",
      "isbn_imprime",
      "prix_exemplaire_fcfa",
      "pdf_interieur_cle",
      "pdf_interieur_nom",
      "couverture_cle",
      "couverture_nom",
      "cree_le",
      "modifie_le",
    ],
    count: () => prisma.printEdition.count(),
    load: () =>
      prisma.printEdition.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
      }),
    toRow: (format) => [
      format.id,
      format.productId,
      format.status,
      format.podPackageId,
      format.pageCount,
      format.printCostXof,
      format.isbnPrint,
      format.retailPriceXof,
      format.interiorStorageKey,
      format.interiorFileName,
      format.coverStorageKey,
      format.coverFileName,
      iso(format.createdAt),
      iso(format.updatedAt),
    ],
  }),

  makeDataset({
    key: "commandes-imprimees",
    label: "Commandes d'exemplaires imprimés",
    description:
      "Acheteur, adresse de livraison, montants, paiement déclaré, suivi (contient des données personnelles).",
    headers: [
      "id",
      "numero",
      "acheteur_id",
      "acheteur_email",
      "ouvrage_id",
      "vendeur_id",
      "titre",
      "exemplaires_auteur",
      "quantite",
      "prix_unitaire_fcfa",
      "cout_fabrication_fcfa",
      "livraison_fcfa",
      "total_fcfa",
      "gain_auteur_fcfa",
      "nom_destinataire",
      "adresse",
      "complement",
      "ville",
      "etat",
      "code_postal",
      "pays",
      "telephone",
      "voie",
      "statut",
      "moyen_paiement",
      "telephone_expediteur",
      "reference_paiement",
      "paiement_declare_le",
      "motif_rejet",
      "paye_le",
      "valide_par",
      "lulu_commande",
      "lulu_statut",
      "suivi",
      "note",
      "erreur_envoi",
      "envoye_le",
      "expedie_le",
      "livre_le",
      "motif_annulation",
      "cree_le",
    ],
    count: () => prisma.printOrder.count(),
    load: () =>
      prisma.printOrder.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
      }),
    toRow: (order) => [
      order.id,
      order.number,
      order.buyerId,
      order.buyerEmail,
      order.productId,
      order.sellerId,
      order.productTitle,
      yesNo(order.isAuthorCopy),
      order.quantity,
      order.unitPriceXof,
      order.printCostXof,
      order.shippingXof,
      order.totalXof,
      order.authorNetXof,
      order.shipName,
      order.shipStreet1,
      order.shipStreet2,
      order.shipCity,
      order.shipState,
      order.shipPostcode,
      order.shipCountry,
      order.shipPhone,
      order.route,
      order.status,
      order.paymentMethod,
      order.payerPhone,
      order.paymentReference,
      iso(order.paymentSubmittedAt),
      order.paymentRejectionReason,
      iso(order.paidAt),
      order.paidValidatedBy,
      order.luluPrintJobId,
      order.luluStatus,
      order.trackingUrls,
      order.fulfilmentNote,
      order.lastDispatchError,
      iso(order.dispatchedAt),
      iso(order.shippedAt),
      iso(order.deliveredAt),
      order.canceledReason,
      iso(order.createdAt),
    ],
  }),

  makeDataset({
    key: "manuscrits-soumis",
    label: "Manuscrits soumis (compte d'éditeur)",
    description: "Manuscrits soumis à l'examen éditorial, déclarations et décision (sans les fichiers).",
    headers: [
      "id",
      "vendeur_id",
      "compte_id",
      "titre",
      "resume",
      "langue",
      "pages",
      "categorie_id",
      "auteur",
      "qualite",
      "fichier_cle",
      "fichier_nom",
      "fichier_octets",
      "couverture",
      "statut",
      "droits_declares_le",
      "texte_des_droits",
      "examen_accepte_le",
      "message_decision",
      "decide_le",
      "decide_par",
      "cree_le",
    ],
    count: () => prisma.manuscriptSubmission.count(),
    load: () =>
      prisma.manuscriptSubmission.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
      }),
    toRow: (submission) => [
      submission.id,
      submission.sellerId,
      submission.userId,
      submission.title,
      submission.description,
      submission.language,
      submission.pageCount,
      submission.categoryId,
      submission.authorName,
      submission.capacity,
      submission.manuscriptStorageKey,
      submission.manuscriptFileName,
      submission.manuscriptSizeBytes,
      submission.coverImageUrl,
      submission.status,
      iso(submission.rightsAcceptedAt),
      submission.rightsText,
      iso(submission.reviewConsentAt),
      submission.decisionMessage,
      iso(submission.decidedAt),
      submission.decidedBy,
      iso(submission.createdAt),
    ],
  }),

  makeDataset({
    key: "editions-auteur",
    label: "Éditions à compte d'auteur",
    description:
      "Contrat accepté (texte archivé, signature), manuscrit, épreuves et approbation du bon à tirer (sans empreintes de connexion).",
    headers: [
      "id",
      "ouvrage_id",
      "vendeur_id",
      "etape",
      "contrat_version",
      "contrat_empreinte",
      "contrat_texte",
      "contrat_accepte_le",
      "signature",
      "email_signataire",
      "debut_prestation_demande",
      "manuscrit_cle",
      "manuscrit_nom",
      "epreuve_cle",
      "epreuve_nom",
      "epreuve_octets",
      "epreuve_version",
      "epreuve_deposee_le",
      "corrections_demandees",
      "demande_de_corrections",
      "bat_approuve_le",
      "bat_approuve_par",
      "bat_version_approuvee",
      "motif_refus",
      "cree_le",
      "modifie_le",
    ],
    count: () => prisma.editionProject.count(),
    load: () =>
      prisma.editionProject.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
      }),
    toRow: (project) => [
      project.id,
      project.productId,
      project.sellerId,
      project.stage,
      project.contractVersion,
      project.contractHash,
      project.contractText,
      iso(project.contractAcceptedAt),
      project.signerName,
      project.signerEmail,
      yesNo(project.serviceStartRequested),
      project.manuscriptStorageKey,
      project.manuscriptFileName,
      project.proofStorageKey,
      project.proofFileName,
      project.proofSizeBytes,
      project.proofVersion,
      iso(project.proofUploadedAt),
      project.correctionRounds,
      project.changeRequest,
      iso(project.approvedAt),
      project.approvedByName,
      project.approvedProofVersion,
      project.refusalReason,
      iso(project.createdAt),
      iso(project.updatedAt),
    ],
  }),

  makeDataset({
    key: "forfaits-publication",
    label: "Forfaits de publication (compte d'auteur)",
    description: "Forfait de 25 000 FCFA par livre : montant, paiement déclaré et décision.",
    headers: [
      "id",
      "ouvrage_id",
      "montant_fcfa",
      "statut",
      "moyen",
      "telephone_expediteur",
      "reference",
      "declare_le",
      "valide_le",
      "valide_par",
      "motif_rejet",
      "cree_le",
    ],
    count: () => prisma.publicationFee.count(),
    load: () =>
      prisma.publicationFee.findMany({
        orderBy: { createdAt: "asc" },
        take: LIMIT,
      }),
    toRow: (fee) => [
      fee.id,
      fee.productId,
      fee.amountXof,
      fee.status,
      fee.method,
      fee.payerPhone,
      fee.paymentReference,
      iso(fee.submittedAt),
      iso(fee.validatedAt),
      fee.validatedBy,
      fee.rejectionReason,
      iso(fee.createdAt),
    ],
  }),
];
