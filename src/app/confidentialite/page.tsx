// src/app/confidentialite/page.tsx
import type { Metadata } from "next";
import { getContactInfo } from "@/lib/contact";
import { getLegalConfig, operatorName } from "@/lib/legal-config";
import LegalPage, { LegalList, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Politique de confidentialité de TechLibrairie : données collectées, finalités, durées de conservation et vos droits.",
};

export const dynamic = "force-dynamic";

export default async function ConfidentialitePage() {
  const contact = await getContactInfo();
  const legal = getLegalConfig();

  return (
    <LegalPage title="Politique de confidentialité">
      <LegalSection title="Qui est responsable de vos données ?">
        <p>
          Le responsable du traitement est {operatorName(legal)}, exploitant du site TechLibrairie. Cette
          page explique quelles données nous collectons, pourquoi, et comment vous pouvez exercer vos droits.
        </p>
      </LegalSection>

      <LegalSection title="Données collectées et finalités">
        <LegalList>
          <li>
            <strong>Compte</strong> : nom, adresse email, téléphone (facultatif) et mot de passe (conservé
            uniquement sous forme chiffrée irréversible). Finalité : créer et sécuriser votre compte.
          </li>
          <li>
            <strong>Commandes et téléchargements</strong> : ouvrages achetés, montants, dates, état du
            paiement, liens de téléchargement. Finalité : exécuter votre achat, vous fournir vos fichiers,
            gérer les remboursements et nos obligations comptables.
          </li>
          <li>
            <strong>Paiements</strong> : nous ne conservons aucun numéro de carte ni code secret. Les
            prestataires de paiement (Stripe, CinetPay) nous transmettent seulement la confirmation du
            paiement et un identifiant de transaction.
          </li>
          <li>
            <strong>Vendeurs</strong> : nom public, présentation, coordonnées de versement (opérateur et
            numéro Mobile Money), historique des ventes et des versements. Finalité : publier votre page
            auteur et vous verser vos revenus.
          </li>
          <li>
            <strong>Support et contact</strong> : le contenu de vos messages et vos coordonnées. Finalité :
            vous répondre.
          </li>
          <li>
            <strong>Sécurité</strong> : une empreinte chiffrée de votre adresse IP (jamais l&apos;adresse
            elle-même) et les tentatives de connexion échouées. Finalité : limiter les tentatives de
            piratage et le spam.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Cookies et traceurs">
        <LegalList>
          <li>
            <strong>Cookies nécessaires</strong> : cookie de session (connexion), cookie de panier et cookie
            mémorisant votre choix concernant les cookies publicitaires (conservé 6 mois). Ils sont
            indispensables au fonctionnement du site et ne nécessitent pas de consentement.
          </li>
          <li>
            <strong>Publicité de partenaires tiers</strong> : le site affiche des publicités de régies
            publicitaires tierces (notamment Adsterra), qui peuvent déposer leurs propres cookies et
            traceurs afin de mesurer et de personnaliser la publicité. Ces publicités ne sont chargées
            qu&apos;<strong>après votre accord</strong>, donné via le bandeau affiché à votre première
            visite. Si vous refusez, elles ne sont pas chargées.
          </li>
          <li>
            <strong>Bannières de annonceurs locaux</strong> : elles peuvent s&apos;afficher dans tous les cas ;
            nous n&apos;y associons aucun cookie de suivi. Un clic vous mène vers le site de l&apos;annonceur, qui
            applique sa propre politique.
          </li>
          <li>
            Vous pouvez modifier votre choix à tout moment avec le lien « Gérer mes cookies » en bas de
            chaque page.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Durées de conservation">
        <LegalList>
          <li>Compte et historique de commandes : tant que le compte existe, puis pour la durée imposée par nos obligations légales et comptables.</li>
          <li>Panier : 30 jours au plus (cookie sur votre appareil).</li>
          <li>Choix concernant les cookies publicitaires : 6 mois (cookie sur votre appareil).</li>
          <li>Conversations de support jamais payées : supprimées après 14 jours.</li>
          <li>Tentatives de connexion échouées : supprimées après 24 heures.</li>
          <li>Liens de téléchargement expirés : supprimés après 30 jours.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Destinataires et prestataires">
        <p>
          Vos données ne sont jamais vendues. Elles sont traitées par des prestataires techniques qui
          interviennent pour notre compte : Vercel (hébergement et stockage), Neon (base de données), Stripe
          et CinetPay (paiement), Resend (envoi des emails) et, si vous l&apos;acceptez, les régies publicitaires
          pour l&apos;affichage des annonces. Ces prestataires peuvent traiter vos données dans des pays autres
          que le vôtre.
        </p>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Vous pouvez demander à accéder à vos données, à les faire corriger ou supprimer, et vous opposer à
          certains traitements, dans les conditions prévues par la loi applicable. Vous pouvez corriger vos
          informations depuis la page « Mon profil ». Pour toute autre demande, contactez-nous
          {contact.email ? (
            <>
              {" "}
              à{" "}
              <a href={`mailto:${contact.email}`} className="font-semibold text-brand-700 hover:underline">
                {contact.email}
              </a>
            </>
          ) : null}{" "}
          ou par le formulaire de contact. Vous pouvez également vous adresser à l&apos;autorité de
          protection des données compétente de votre pays.
        </p>
      </LegalSection>

      <LegalSection title="Sécurité">
        <p>
          Les échanges avec le site sont chiffrés, les mots de passe sont conservés sous forme chiffrée
          irréversible, et les fichiers PDF sont stockés en accès privé. Aucun système n&apos;étant infaillible,
          prévenez-nous immédiatement si vous suspectez un usage frauduleux de votre compte.
        </p>
      </LegalSection>

      <LegalSection title="Modification de cette politique">
        <p>
          Nous pouvons mettre à jour cette politique. La date de dernière mise à jour figure en haut de cette
          page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
