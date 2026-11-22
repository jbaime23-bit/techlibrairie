// src/lib/assembly/dossier-loader.ts
// Chargement côté serveur des dossiers d'assemblage (administrateurs seulement : l'appelant vérifie le rôle).

import type { EditionStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EDITION_STAGE_LABELS } from "@/lib/edition-labels";
import type {
  AssemblyDossier,
  AssemblyDossierSummary,
  DossierKind,
} from "@/lib/assembly/dossier-types";

const OPEN_STAGES: EditionStage[] = ["IN_LAYOUT", "CHANGES_REQUESTED", "PROOF_PENDING"];

const AUTHOR_LABEL = "Compte d'auteur";
const PUBLISHER_LABEL = "Compte d'éditeur";

function validId(id: string): boolean {
  return /^[a-z0-9]{1,40}$/i.test(id);
}

/** Livres à mettre en page (compte d'auteur) et manuscrits retenus (compte d'éditeur). */
export async function listAssemblyDossiers(): Promise<AssemblyDossierSummary[]> {
  const projects = await prisma.editionProject.findMany({
    where: { stage: { in: OPEN_STAGES } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { productId: true, stage: true },
  });

  const productIds = projects.map((project) => project.productId);

  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          title: true,
          authorName: true,
          seller: { select: { displayName: true } },
        },
      })
    : [];
  const productById = new Map(products.map((product) => [product.id, product]));

  const submissions = await prisma.manuscriptSubmission.findMany({
    where: { status: "ACCEPTED" },
    orderBy: { decidedAt: "desc" },
    take: 50,
    select: { id: true, title: true, authorName: true },
  });

  const contracts = submissions.length
    ? await prisma.publisherContract.findMany({
        where: { submissionId: { in: submissions.map((submission) => submission.id) } },
        select: { submissionId: true, acceptedAt: true },
      })
    : [];
  const signedBySubmission = new Map(
    contracts.map((contract) => [contract.submissionId, contract.acceptedAt !== null])
  );

  const list: AssemblyDossierSummary[] = [];

  for (const project of projects) {
    const product = productById.get(project.productId);
    if (!product) continue;

    list.push({
      kind: "projet",
      id: project.productId,
      title: product.title,
      author: product.authorName ?? product.seller.displayName,
      label: AUTHOR_LABEL,
      detail: EDITION_STAGE_LABELS[project.stage],
    });
  }

  for (const submission of submissions) {
    list.push({
      kind: "manuscrit",
      id: submission.id,
      title: submission.title,
      author: submission.authorName,
      label: PUBLISHER_LABEL,
      detail: signedBySubmission.get(submission.id) ? "Contrat signé" : "Contrat en attente de signature",
    });
  }

  return list;
}

/** Dossier complet d'un livre à compte d'auteur (id du produit) ou d'un manuscrit retenu (id du manuscrit). */
export async function loadAssemblyDossier(
  kind: DossierKind,
  id: string
): Promise<AssemblyDossier | null> {
  if (!validId(id)) return null;

  const year = String(new Date().getFullYear());

  if (kind === "projet") {
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        authorName: true,
        isbn: true,
        coverImageUrl: true,
        seller: { select: { displayName: true, bio: true, avatarUrl: true } },
      },
    });

    const project = await prisma.editionProject.findUnique({
      where: { productId: id },
      select: { stage: true, manuscriptFileName: true, proofVersion: true },
    });

    if (!product || !project) return null;

    const fee = await prisma.publicationFee.findUnique({
      where: { productId: id },
      select: { status: true },
    });

    return {
      kind,
      id,
      productId: product.id,
      label: AUTHOR_LABEL,
      title: product.title,
      subtitle: "",
      author: product.authorName ?? product.seller.displayName,
      summary: product.description,
      bio: product.seller.bio ?? "",
      isbn: product.isbn ?? "",
      year,
      coverUrl: product.coverImageUrl,
      photoUrl: product.seller.avatarUrl,
      manuscriptDownloadUrl: `/api/admin/edition/${id}/manuscrit`,
      manuscriptFileName: project.manuscriptFileName,
      canSendProof: OPEN_STAGES.includes(project.stage) && fee?.status === "VALIDATED",
      nextProofVersion: project.proofVersion + 1,
      contractSigned: null,
    };
  }

  const submission = await prisma.manuscriptSubmission.findUnique({
    where: { id },
    select: {
      id: true,
      sellerId: true,
      title: true,
      description: true,
      authorName: true,
      coverImageUrl: true,
      manuscriptFileName: true,
    },
  });

  if (!submission) return null;

  const [seller, contract] = await Promise.all([
    prisma.sellerProfile.findUnique({
      where: { id: submission.sellerId },
      select: { bio: true, avatarUrl: true },
    }),
    prisma.publisherContract.findUnique({
      where: { submissionId: id },
      select: { acceptedAt: true },
    }),
  ]);

  return {
    kind,
    id,
    productId: null,
    label: PUBLISHER_LABEL,
    title: submission.title,
    subtitle: "",
    author: submission.authorName,
    summary: submission.description,
    bio: seller?.bio ?? "",
    isbn: "",
    year,
    coverUrl: submission.coverImageUrl,
    photoUrl: seller?.avatarUrl ?? null,
    manuscriptDownloadUrl: `/api/admin/manuscrit/${id}`,
    manuscriptFileName: submission.manuscriptFileName,
    canSendProof: false,
    nextProofVersion: 1,
    contractSigned: contract ? contract.acceptedAt !== null : false,
  };
    }
