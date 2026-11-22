// src/app/contrat-editeur/page.tsx
// Contrat d'édition à compte d'éditeur : modèle public, consultable avant tout dépôt.
import type { Metadata } from "next";
import { getEditionOffers } from "@/lib/edition-offers";
import { buildPublisherContract } from "@/lib/publisher-contract";
import LegalPage, { LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Contrat d'édition à compte d'éditeur",
  description:
    "Modèle du contrat d'édition à compte d'éditeur de TechLibrairie Édition : droits cédés, rémunération proportionnelle, reddition des comptes, durée et résiliation.",
};

export const dynamic = "force-dynamic";

export default function ContratEditeurModelePage() {
  const contract = buildPublisherContract({
    workTitle: "[titre de l'œuvre]",
    authorName: "[nom de l'auteur]",
    royaltyPercent: getEditionOffers().publisherRoyaltyPercent,
  });

  return (
    <LegalPage title={contract.title}>
      <LegalSection title={`Version ${contract.version} (modèle)`}>
        <p>{contract.subtitle}.</p>
        {contract.parties.map((party) => (
          <p key={party}>{party}</p>
        ))}
        <p>
          Ce texte est un modèle. Il n&apos;est proposé qu&apos;à l&apos;auteur dont le manuscrit a été retenu
          par l&apos;équipe éditoriale : les informations entre crochets et la redevance sont alors précisées, et
          le contrat est signé en ligne, sans rendez-vous, puis téléchargeable en PDF.
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
