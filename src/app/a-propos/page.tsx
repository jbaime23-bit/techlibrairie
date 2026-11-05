// src/app/a-propos/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getContactInfo } from "@/lib/contact";
import { getLegalConfig, operatorName } from "@/lib/legal-config";
import { getPaymentMethods, paymentSummary } from "@/lib/payment-methods";
import LegalPage, { LegalList, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "À propos de TechLibrairie",
  description:
    "TechLibrairie est une plateforme multi-vendeurs de livres et guides techniques au format PDF, avec une section de téléchargements gratuits.",
};

export const dynamic = "force-dynamic";

export default async function AProposPage() {
  const contact = await getContactInfo();
  const legal = getLegalConfig();
  const summary = paymentSummary(getPaymentMethods());

  return (
    <LegalPage title="À propos de TechLibrairie">
      <LegalSection title="Qui sommes-nous ?">
        <p>
          TechLibrairie est une plateforme en ligne consacrée aux livres et guides techniques au format PDF.
          Elle est exploitée par {operatorName(legal)}. Notre objectif : permettre à des auteurs et à des
          éditeurs de proposer leurs ouvrages à un public francophone, et aux lecteurs de les trouver et de
          les télécharger simplement.
        </p>
      </LegalSection>

      <LegalSection title="Ce que vous trouvez sur le site">
        <LegalList>
          <li>
            <strong>Un catalogue</strong> de livres et de guides en PDF, classés par catégories, avec une
            description, une couverture et les avis des acheteurs.{" "}
            <Link href="/catalogue" className="font-semibold text-brand-700 hover:underline">
              Voir le catalogue
            </Link>
            .
          </li>
          <li>
            <strong>Des téléchargements gratuits</strong>, sans compte, financés par la publicité : une
            courte attente précède chaque téléchargement.{" "}
            <Link href="/gratuit" className="font-semibold text-brand-700 hover:underline">
              Voir les PDF gratuits
            </Link>
            .
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Comment ça marche">
        <LegalList>
          <li>Vous choisissez un ouvrage, vous l&apos;ajoutez au panier puis vous payez. {summary}.</li>
          <li>
            Votre PDF est disponible immédiatement dans votre espace « Mes commandes », par un lien de
            téléchargement personnel et sécurisé. Les fichiers ne sont jamais accessibles publiquement.
          </li>
          <li>Les prix sont affichés en francs CFA, sans taxe supplémentaire.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Pour les auteurs et les éditeurs">
        <p>
          Vous avez écrit un livre ou un guide technique ? Créez un compte vendeur, déposez votre PDF et sa
          couverture : l&apos;ouvrage est publié automatiquement. Vous fixez votre prix, suivez vos ventes et
          demandez vos versements par Mobile Money. La boutique prélève une commission sur chaque vente ;
          les conditions détaillées figurent dans les{" "}
          <Link href="/conditions" className="font-semibold text-brand-700 hover:underline">
            conditions générales
          </Link>
          .{" "}
          <Link href="/inscription" className="font-semibold text-brand-700 hover:underline">
            Devenir vendeur
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Nos engagements">
        <LegalList>
          <li>
            Les contenus contraires à la loi ou aux droits de tiers sont retirés après signalement (voir la
            procédure dans les conditions générales).
          </li>
          <li>
            Vos données sont protégées et vous gardez la main : copie de vos données et suppression du compte
            en libre-service (voir la{" "}
            <Link href="/confidentialite" className="font-semibold text-brand-700 hover:underline">
              politique de confidentialité
            </Link>
            ).
          </li>
          <li>Les publicités de partenaires ne s&apos;affichent qu&apos;après votre accord.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Nous contacter">
        <p>
          Une question, une suggestion, un signalement ? Écrivez-nous par le formulaire en bas de chaque page
          {contact.email ? (
            <>
              {" "}
              ou à{" "}
              <a href={`mailto:${contact.email}`} className="font-semibold text-brand-700 hover:underline">
                {contact.email}
              </a>
            </>
          ) : null}
          . Les mentions légales se trouvent{" "}
          <Link href="/mentions-legales" className="font-semibold text-brand-700 hover:underline">
            ici
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
      }
