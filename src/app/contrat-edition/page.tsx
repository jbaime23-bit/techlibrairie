// src/app/contrat-edition/page.tsx
// Contrat d'édition à compte d'auteur : texte public (modèle), consultable avant le dépôt.
import type { Metadata } from "next";
import { buildContract } from "@/lib/edition-contract";
import LegalPage, { LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Contrat d'édition à compte d'auteur",
  description:
    "Texte du contrat d'édition à compte d'auteur de TechLibrairie Édition : prestations, forfait, droits de l'auteur, frais d'impression.",
};

export const dynamic = "force-dynamic";

export default function ContratEditionPage() {
  const contract = buildContract();

  return (
    <LegalPage title={contract.title}>
      <LegalSection title={`Version ${contract.version}`}>
        <p>{contract.subtitle}.</p>
        {contract.parties.map((party) => (
          <p key={party}>{party}</p>
        ))}
        <p>
          Ce texte est celui que l&apos;auteur accepte en ligne au moment du dépôt de son livre. Il est archivé
          avec sa version, la date et la signature de l&apos;auteur.
        </p>
      </LegalSection>

      {[...contract.articles, ...contract.annexes].map((article) => (
        <LegalSection key={article.title} title={article.title}>
          {article.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </LegalSection>
      ))}
    </LegalPage>
  );
}
