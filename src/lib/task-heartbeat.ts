// src/lib/task-heartbeat.ts
// Suivi des tâches planifiées : chaque exécution laisse une ligne dans le journal
// (action "systeme.maintenance" ou "systeme.tache_quotidienne"), ce qui permet à la page
// Santé de vérifier que les tâches tournent vraiment.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

export type ScheduledTask = "maintenance" | "quotidienne";

const ACTIONS: Record<ScheduledTask, string> = {
  maintenance: "systeme.maintenance",
  quotidienne: "systeme.tache_quotidienne",
};

export const SCHEDULED_TASKS: readonly { task: ScheduledTask; label: string }[] = [
  { task: "maintenance", label: "Maintenance quotidienne (3 h UTC)" },
  {
    task: "quotidienne",
    label: "Tâche de 16 h UTC (rappels de commande, rapport mensuel, alertes)",
  },
];

/** Enregistre le passage d'une tâche planifiée. Ne lève jamais d'exception. */
export async function recordTaskRun(
  task: ScheduledTask,
  details?: Prisma.InputJsonObject
): Promise<void> {
  await recordAudit({
    adminId: null,
    adminEmail: "systeme",
    action: ACTIONS[task],
    targetType: "tache",
    details,
  });
}

/** Date de la dernière exécution connue d'une tâche, ou null si elle n'a jamais été enregistrée. */
export async function getLastTaskRun(task: ScheduledTask): Promise<Date | null> {
  const last = await prisma.auditLog.findFirst({
    where: { action: ACTIONS[task] },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return last?.createdAt ?? null;
}
