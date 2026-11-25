// src/lib/backup-sources.ts
// Jeu de données de la sauvegarde de secours : versions Word des manuscrits (références, sans les fichiers).
// Ce fichier n'importe aucune valeur de backup.ts (types seulement), pour éviter une dépendance circulaire.

import { prisma } from "@/lib/prisma";
import { MAX_EXPORT_ROWS } from "@/lib/csv";
import type { BackupDataset } from "@/lib/backup";

export const SOURCE_BACKUP_DATASETS: BackupDataset[] = [
  {
    key: "versions-word",
    label: "Versions Word des manuscrits",
    description: "Références des fichiers Word joints aux livres et manuscrits (sans les fichiers eux-mêmes).",
    headers: [
      "id",
      "vendeur_id",
      "ouvrage_id",
      "manuscrit_id",
      "fichier_cle",
      "fichier_nom",
      "octets",
      "joint_par",
      "cree_le",
    ],
    count: () => prisma.manuscriptSource.count(),
    rows: async () => {
      const items = await prisma.manuscriptSource.findMany({
        orderBy: { createdAt: "asc" },
        take: MAX_EXPORT_ROWS + 1,
      });

      if (items.length > MAX_EXPORT_ROWS) {
        throw new Error("Trop de lignes dans « Versions Word des manuscrits » pour un seul fichier.");
      }

      return items.map((item) => [
        item.id,
        item.sellerId,
        item.productId,
        item.submissionId,
        item.storageKey,
        item.fileName,
        item.sizeBytes,
        item.addedBy,
        item.createdAt.toISOString(),
      ]);
    },
  },
];
