// src/lib/print-statuses.ts
// États des commandes d'exemplaires imprimés qui comptent pour les gains et les droits d'auteur.

import type { PrintOrderStatus } from "@prisma/client";

// Paiement validé et commande non annulée : les gains sont acquis (en attente de déblocage, ou retirables)
export const PRINT_EARNED_STATUSES: PrintOrderStatus[] = [
  "PAID",
  "SENDING",
  "SENT_TO_LULU",
  "LOCAL_PENDING",
  "SHIPPED",
  "DELIVERED",
  "ERROR",
];

// Commande expédiée : ses gains peuvent être retirés (après le délai de sécurité)
export const PRINT_RELEASED_STATUSES: PrintOrderStatus[] = ["SHIPPED", "DELIVERED"];
