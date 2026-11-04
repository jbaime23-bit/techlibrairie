// src/app/conditions/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getContactInfo } from "@/lib/contact";
import { PAYOUT_HOLD_DAYS } from "@/lib/payouts";
import { FREE_WAIT_SECONDS } from "@/lib/free-resources";
import { getLegalConfig, operatorName } from "@/lib/legal-config";
import {
  getPaymentMethods,
  paymentMeansList,
  refundMeansLabel,
} from "@/lib/payment-methods";
import { formatPrice } from "@/lib/utils";
import LegalPage, { LegalList, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation et de vente",
  description:
    "Conditions générales d'utilisation et de vente de TechLibrairie : achat, téléchargement, téléchargements gratuits, paiement, remboursement, vendeurs, contenus interdits et support.",
};

export const dynamic = "force-dynamic";

async function loadSettings() {
  try {
    return await prisma.platformSetting.findUnique({ where: { id: "global" } });
  } catch {
    return null;
  }
}

export default async function ConditionsPage() {
  const [settings, contact] = await Promise.all([loadSettings(), getContactInfo()]);
  const legal = getLegalConfig();
  const operator = operatorName(legal);
  const methods = getPaymentMethods();
  const meansList = paymentMeansList(methods);

  const linkHours = settings?.downloadLinkTtlHours ?? 72;
  const maxDownloads = settings?.downloadMaxAttempts ?? 5;
  const commissionPercent = (settings?.defaultCommissionRateBps ?? 1000) / 100;
  const minPayout = settings?.minPayoutAmountXof ?? 5000;
  const supportFee = settings?.supportFeeXof ?? 1000;
  const fxMarginPercent = (settings?.fxMarginBps ?? 200) / 100;

  return (
    <LegalPage title="Conditions générales d'utilisation et de vente">
      <LegalSection title="1. Objet">
        <p>
          TechLibrairie est une plateforme en ligne qui met en relation des auteurs et éditeurs
          (les « vendeurs ») avec des acheteurs de livres et guides techniques au format PDF, et qui propose
          aussi des PDF en téléchargement gratuit. Le site est exploité par {operator}. Les présentes
          conditions régissent l&apos;utilisation du site et les achats qui y sont réalisés. En créant un compte,
          en passant commande ou en téléchargeant un document, vous les acceptez.
        </p>
      </LegalSection>

      <LegalSection title="2. Compte utilisateur">
        <LegalList>
          <li>
            Vous devez fournir des informations exactes et être en capacité de contracter selon la loi
            qui vous est applicable.
          </li>
          <li>
            Vous êtes responsable de la confidentialité de votre mot de passe et de toute activité
            réalisée depuis votre compte. Prévenez-nous sans délai en cas d&apos;usage suspect.
          </li>
          <li>
            Nous pouvons suspendre ou désactiver un compte en cas de violation des présentes conditions,
            de fraude ou d&apos;activité illicite.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. Produits proposés">
        <p>
          Les produits sont des fichiers numériques au format PDF, publiés par les vendeurs. Chaque vendeur est
          seul responsable du contenu qu&apos;il publie, de sa description et des droits qu&apos;il détient sur
          celui-ci. La publication est automatique dès la soumission par le vendeur ; la plateforme peut
          retirer ou suspendre sans préavis tout contenu contraire à la loi, aux droits de tiers ou aux
          présentes conditions.
        </p>
      </LegalSection>

      <LegalSection title="4. Prix">
        <LegalList>
          <li>Les prix sont fixés en francs CFA (FCFA) et affichés toutes charges comprises.</li>
          <li>Aucune taxe supplémentaire n&apos;est ajoutée au prix affiché lors de la commande.</li>
          {methods.stripeCard && (
            <li>
              Pour un paiement par carte bancaire via Stripe, le montant en FCFA est converti en euros ou
              en dollars au moment du paiement, avec un taux et une marge de conversion de {fxMarginPercent} %
              inclus. Le montant exact débité est affiché avant la confirmation du paiement.
            </li>
          )}
          {methods.cinetPayCard && (
            <li>
              Pour un paiement par carte bancaire via CinetPay, le montant est débité en FCFA. Si votre
              carte est émise dans une autre devise, votre banque peut appliquer sa propre conversion et
              ses propres frais, qui ne dépendent pas de TechLibrairie.
            </li>
          )}
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Commande et paiement">
        <LegalList>
          <li>
            {meansList.length > 0
              ? `Le paiement s'effectue ${meansList.join(", ou ")}.`
              : "Les moyens de paiement disponibles sont affichés au moment de la commande."}
          </li>
          <li>
            Nous ne recevons ni ne conservons jamais vos numéros de carte ni vos codes secrets : ils sont
            traités directement par les prestataires de paiement.
          </li>
          <li>
            La commande est confirmée à réception de la confirmation du paiement par le prestataire. En
            cas de paiement non abouti, vous n&apos;êtes pas débité et aucun fichier n&apos;est délivré.
          </li>
          <li>
            Un code promotionnel, lorsque la boutique en propose, est valable aux conditions indiquées lors de
            sa diffusion (dates, montant minimum, nombre d&apos;utilisations). La remise est déduite du prix
            avant le paiement.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="6. Livraison et téléchargement des produits payants">
        <LegalList>
          <li>
            Dès la confirmation du paiement, un lien de téléchargement personnel et sécurisé est mis à
            votre disposition dans votre espace « Mes commandes » (et par email lorsque l&apos;envoi est
            possible).
          </li>
          <li>
            Chaque lien est valable {linkHours} heures et permet {maxDownloads} téléchargements au plus. Lorsqu&apos;un
            lien est expiré ou épuisé, vous pouvez en générer un nouveau depuis votre espace, dans la limite
            d&apos;un usage raisonnable.
          </li>
          <li>Vous devez être connecté à votre compte pour télécharger un fichier acheté.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="7. Téléchargements gratuits">
        <LegalList>
          <li>
            Le site propose des PDF en téléchargement gratuit, sans compte. Chaque téléchargement est précédé
            d&apos;une attente de {FREE_WAIT_SECONDS} secondes pendant laquelle des publicités peuvent être
            affichées : elles financent la mise à disposition gratuite des documents. Aucun clic sur une
            publicité n&apos;est jamais exigé.
          </li>
          <li>
            Les publicités de partenaires tiers ne s&apos;affichent que si vous avez accepté les cookies
            publicitaires ; l&apos;attente reste la même dans tous les cas.
          </li>
          <li>
            Les documents gratuits sont fournis tels quels, sans garantie d&apos;exactitude, d&apos;exhaustivité ni
            d&apos;adaptation à un besoin particulier. Le nombre de téléchargements d&apos;un même fichier peut être
            limité pour prévenir les abus.
          </li>
          <li>
            L&apos;usage de ces documents est personnel : les règles de l&apos;article suivant s&apos;y appliquent.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="8. Usage des fichiers et propriété intellectuelle">
        <p>
          L&apos;achat ou le téléchargement confère un droit d&apos;usage personnel et non exclusif sur le fichier. Il
          est interdit de le revendre, de le partager publiquement, de le redistribuer ou d&apos;en retirer les
          mentions de propriété. Les droits d&apos;auteur restent la propriété des vendeurs ou de leurs ayants
          droit. Si vous estimez qu&apos;un contenu porte atteinte à vos droits, suivez la procédure de signalement
          de l&apos;article 11.
        </p>
      </LegalSection>

      <LegalSection title="9. Droit de rétractation et remboursement">
        <p>
          Les produits numériques étant fournis immédiatement après le paiement, aucun droit de
          rétractation n&apos;est accordé une fois le téléchargement effectué, sous réserve des dispositions
          impératives de la loi applicable.
        </p>
        <p>Nous remboursons toutefois la commande dans les cas suivants, sur demande :</p>
        <LegalList>
          <li>fichier illisible, corrompu ou impossible à télécharger malgré nos tentatives d&apos;assistance ;</li>
          <li>fichier manifestement non conforme à sa description ;</li>
          <li>achat en double ou erreur de paiement avérée.</li>
        </LegalList>
        <p>
          Le remboursement porte sur le montant réellement payé et est effectué par le même moyen que le
          paiement ({refundMeansLabel(methods)}). Les liens de téléchargement de la commande remboursée sont
          alors désactivés. Les délais d&apos;apparition du remboursement dépendent de votre banque ou de votre
          opérateur.
        </p>
      </LegalSection>

      <LegalSection title="10. Dispositions applicables aux vendeurs">
        <LegalList>
          <li>
            Le vendeur déclare détenir tous les droits nécessaires sur les fichiers qu&apos;il publie et
            garantit TechLibrairie contre toute réclamation de tiers à ce titre.
          </li>
          <li>
            TechLibrairie prélève une commission sur chaque vente. Le taux par défaut est de
            {" "}{commissionPercent} % ; un taux spécifique peut être convenu avec un vendeur. Le taux appliqué
            à une vente est celui en vigueur au moment de l&apos;achat.
          </li>
          <li>
            Les gains d&apos;une vente deviennent retirables {PAYOUT_HOLD_DAYS} jours après le paiement. Le
            versement est demandé depuis l&apos;espace vendeur, par Orange Money ou Moov Money, pour un
            montant minimum de {formatPrice(minPayout, "XOF")}.
          </li>
          <li>
            En cas de remboursement d&apos;une commande, les gains correspondants sont retirés du solde du
            vendeur. S&apos;ils ont déjà été versés, TechLibrairie peut en demander la restitution.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="11. Contenus interdits et signalement">
        <p>Il est interdit de publier ou de proposer sur le site :</p>
        <LegalList>
          <li>des copies non autorisées d&apos;œuvres protégées (livres, cours, logiciels, documents payants d&apos;autrui) ;</li>
          <li>des contenus illicites, haineux, discriminatoires, violents, pornographiques ou portant atteinte à la dignité des personnes ;</li>
          <li>des contenus trompeurs, des logiciels malveillants ou des fichiers destinés à nuire à des utilisateurs ;</li>
          <li>des informations personnelles de tiers diffusées sans leur accord.</li>
        </LegalList>
        <p>
          Pour signaler un contenu, écrivez-nous par le formulaire de contact
          {contact.email ? (
            <>
              {" "}
              ou à{" "}
              <a href={`mailto:${contact.email}`} className="font-semibold text-brand-700 hover:underline">
                {contact.email}
              </a>
            </>
          ) : null}{" "}
          en indiquant : l&apos;adresse de la page concernée, la description du contenu, les raisons de votre
          demande et, s&apos;il s&apos;agit d&apos;une atteinte à vos droits, la preuve que vous en êtes titulaire. Nous
          examinons les signalements dans les meilleurs délais, pouvons suspendre le contenu pendant
          l&apos;examen, et suspendons ou désactivons les comptes qui enfreignent ces règles de façon répétée.
        </p>
      </LegalSection>

      <LegalSection title="12. Support payant">
        <p>
          Le support par conversation est un service payant, au tarif de {formatPrice(supportFee, "XOF")} par
          conversation (tarif affiché avant tout paiement), payable par Mobile Money. Le message n&apos;est lu par
          l&apos;équipe qu&apos;après paiement. Le tarif reste dû même si la réponse ne vous satisfait pas ; en
          l&apos;absence de toute réponse de notre part, vous pouvez demander le remboursement de la
          conversation. Pour une simple question sans suite, le formulaire de contact du pied de page reste
          gratuit.
        </p>
      </LegalSection>

      <LegalSection title="13. Publicité">
        <p>
          Le site affiche des publicités, y compris celles de régies publicitaires tierces (notamment Google
          AdSense et Adsterra), affichées après votre accord (voir la{" "}
          <Link href="/confidentialite" className="font-semibold text-brand-700 hover:underline">
            politique de confidentialité
          </Link>
          ). Ces annonces sont choisies par ces régies : TechLibrairie n&apos;est pas responsable de leur contenu ni
          du contenu des sites vers lesquels elles renvoient. Vous pouvez signaler une annonce inappropriée par
          le formulaire de contact.
        </p>
      </LegalSection>

      <LegalSection title="14. Responsabilité">
        <p>
          Nous mettons tout en œuvre pour assurer la disponibilité du site, sans pouvoir garantir
          l&apos;absence d&apos;interruption. TechLibrairie ne saurait être tenue responsable du contenu des
          ouvrages publiés par les vendeurs, ni des dommages indirects résultant de l&apos;usage du site,
          dans les limites permises par la loi applicable.
        </p>
      </LegalSection>

      <LegalSection title="15. Données personnelles">
        <p>
          Le traitement de vos données personnelles est décrit dans notre{" "}
          <Link href="/confidentialite" className="font-semibold text-brand-700 hover:underline">
            politique de confidentialité
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="16. Droit applicable et litiges">
        <p>
          Les présentes conditions sont régies par le droit en vigueur au {legal.country}. En cas de
          différend, nous vous invitons à nous contacter en priorité afin de rechercher une solution
          amiable. À défaut, les juridictions compétentes seront celles du {legal.country}, sous réserve
          des règles impératives de compétence applicables aux consommateurs.
        </p>
      </LegalSection>

      <LegalSection title="17. Modification des conditions">
        <p>
          Nous pouvons modifier les présentes conditions. La version applicable à une commande est celle en
          vigueur à la date de cette commande. La date de dernière mise à jour figure en haut de cette page.
        </p>
      </LegalSection>

      <LegalSection title="18. Contact">
        <p>
          Pour toute question :
          {contact.email ? (
            <>
              {" "}
              par email à{" "}
              <a href={`mailto:${contact.email}`} className="font-semibold text-brand-700 hover:underline">
                {contact.email}
              </a>
              ,
            </>
          ) : null}{" "}
          ou par le formulaire de contact disponible en bas de chaque page.
        </p>
      </LegalSection>
    </LegalPage>
  );
            }
