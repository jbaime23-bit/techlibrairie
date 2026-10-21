// ---------------------------------------------------------------------------
// Intégrations Tierces (Services de stockage, Emails et Paiements)
// ---------------------------------------------------------------------------

async function buildServicesSection(): Promise<HealthSection> {
  const checks: HealthCheck[] = [];

  // 1. Stockage Vercel Blob
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    checks.push(
      check(
        "Stockage de fichiers (Vercel Blob)",
        "error",
        "Le jeton BLOB_READ_WRITE_TOKEN est absent.",
        "Associez un Blob Store à votre projet sur Vercel (Storage tab) ou ajoutez la variable manuellement."
      )
    );
  } else {
    try {
      checks.push(check("Stockage de fichiers (Vercel Blob)", "ok", "Le jeton est configuré."));
    } catch (error) {
      checks.push(
        check("Stockage de fichiers (Vercel Blob)", "warning", `Vérification incomplète : ${shortError(error)}`)
      );
    }
  }

  // 2. Configuration Email
  if (isEmailConfigured()) {
    checks.push(check("Envoi d'emails", "ok", "Le service d'email est prêt."));
  } else {
    checks.push(
      check(
        "Envoi d'emails",
        "warning",
        "Les variables SMTP ou API Email sont incomplètes.",
        "Renseignez les variables d'environnement de messagerie pour activer l'envoi des rapports et reçus."
      )
    );
  }

  // 3. Passerelle de Paiement Stripe
  try {
    const stripe = getStripe();
    if (stripe) {
      checks.push(check("Passerelle de paiement Stripe", "ok", "Stripe est initialisé."));
    } else {
      checks.push(
        check(
          "Passerelle de paiement Stripe",
          "warning",
          "Stripe n'est pas configuré.",
          "Ajoutez STRIPE_SECRET_KEY si vous acceptez les paiements par carte bancaire internationale."
        )
      );
    }
  } catch (error) {
    checks.push(
      check("Passerelle de paiement Stripe", "error", `Erreur d'initialisation : ${shortError(error)}`)
    );
  }

  // 4. Configuration Légale
  const missingLegals = missingLegalFields();
  if (missingLegals.length === 0) {
    checks.push(check("Informations légales", "ok", "Les mentions légales et conditions d'utilisation sont complètes."));
  } else {
    checks.push(
      check(
        "Informations légales",
        "warning",
        `Champs obligatoires manquants : ${missingLegals.join(", ")}.`,
        "Complétez la configuration légale dans l'interface d'administration ou votre fichier de configuration."
      )
    );
  }

  return { title: "Services et intégrations externes", checks };
}

// ---------------------------------------------------------------------------
// Tâches de Fond et Maintenance (Heartbeat Cron)
// ---------------------------------------------------------------------------

async function buildCronSection(): Promise<HealthSection> {
  const checks: HealthCheck[] = [];
  const now = new Date();

  for (const task of SCHEDULED_TASKS) {
    try {
      const lastRun = await getLastTaskRun(task.id);
      if (!lastRun) {
        checks.push(
          check(
            `Tâche : ${task.label}`,
            "warning",
            "La tâche n'a encore jamais été exécutée.",
            `Déclenchez manuellement ou patientez jusqu'à sa prochaine occurrence planifiée (${task.cronText}).`
          )
        );
        continue;
      }

      const diffMs = now.getTime() - lastRun.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours > task.maxAgeHours) {
        checks.push(
          check(
            `Tâche : ${task.label}`,
            "error",
            `Dernière exécution trop ancienne : ${ageText(diffHours)}.`,
            "Vérifiez que les tâches planifiées (Vercel Crons) sont bien actives et configurées pour votre projet."
          )
        );
      } else {
        checks.push(
          check(`Tâche : ${task.label}`, "ok", `Exécutée avec succès : ${ageText(diffHours)}.`)
        );
      }
    } catch (error) {
      checks.push(
        check(`Tâche : ${task.label}`, "error", `Impossible de vérifier l'état : ${shortError(error)}`)
      );
    }
  }

  return { title: "Tâches planifiées et synchronisation", checks };
}

// ---------------------------------------------------------------------------
// Point d'entrée principal
// ---------------------------------------------------------------------------

export async function performHealthCheck(): Promise<HealthSection[]> {
  const sections: HealthSection[] = [];

  const nextVersion = await readNextVersion();
  const envChecks: HealthCheck[] = [
    check("Environnement d'exécution", "info", `Node.js ${process.version}`),
    check("Framework applicatif", "info", nextVersion ? `Next.js ${nextVersion}` : "Version Next.js indéterminée")
  ];
  sections.push({ title: "Informations système", checks: envChecks });

  const { section: baseSection, reachable } = await buildBaseSection();
  sections.push(baseSection);

  if (!reachable) {
    return sections;
  }

  const [servicesSection, cronSection] = await Promise.all([
    buildServicesSection(),
    buildCronSection()
  ]);

  sections.push(servicesSection);
  sections.push(cronSection);

  return sections;
}
