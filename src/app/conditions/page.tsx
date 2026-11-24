// src/app/conditions/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getContactInfo } from "@/lib/contact";
import { getLegalConfig, operatorName } from "@/lib/legal-config";
import { getPaymentMethods, paymentSummary } from "@/lib/payment-methods";
import { bpsToPercent, getDefaultCommissionRateBps } from "@/lib/commission";
import { PAYOUT_HOLD_DAYS } from "@/lib/payouts";
import { formatXofAmount, getEditionOffers } from "@/lib/edition-offers";
import { CONTRACT_VERSION } from "@/lib/edition-contract";
import { PUBLISHER_CONTRACT_VERSION } from "@/lib/publisher-contract";
import { MAX_COPIES_PER_ORDER } from "@/lib/print-shipping";
import LegalPage, { LegalList, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation et de vente",
  description:
    "Conditions générales de TechLibrairie : boutique de livres PDF, livres imprimés à la demande, édition à compte d'auteur et à compte d'éditeur, mise en ligne, vendeurs, contrats, rétractation.",
};

export const dynamic = "force-dynamic";

export default async function ConditionsPage() {
  const contact = await getContactInfo();
  const legal = getLegalConfig();
  const methods = getPaymentMethods();
  const summary = paymentSummary(methods);
  const offers = getEditionOffers();

  const [defaultRateBps, settings] = await Promise.all([
    getDefaultCommissionRateBps(),
    prisma.platformSetting
      .findUnique({ where: { id: "global" }, select: { minPayoutAmountXof: true } })
      .catch(() => null),
  ]);

  const commission = bpsToPercent(defaultRateBps);
  const minimumPayout = settings?.minPayoutAmountXof ?? 5000;
  const link = "font-semibold text-brand-700 hover:underline";

  return (
    <LegalPage title="Conditions générales d'utilisation et de vente">
      <LegalSection title="Article 1. Objet, exploitant et services">
        <p>
          Les présentes conditions régissent l&apos;utilisation du site TechLibrairie, exploité par {operatorName(legal)}
          {legal.address ? `, dont le siège est situé ${legal.address}` : ""}. En créant un compte, en passant
          commande ou en déposant un ouvrage, vous les acceptez.
        </p>
        <p>Le site propose quatre services :</p>
        <LegalList>
          <li>
            <strong>La boutique</strong> : vente et achat de livres et documents au format PDF, déposés par des
            vendeurs ou publiés par TechLibrairie Édition.
          </li>
          <li>
            <strong>L&apos;édition à compte d&apos;auteur</strong> : l&apos;auteur finance l&apos;édition de son livre
            (contrôle, mise en page, publication) par un forfait, et garde ses droits et ses gains.
          </li>
          <li>
            <strong>L&apos;édition à compte d&apos;éditeur</strong> : TechLibrairie Édition examine un manuscrit et, si
            elle le retient, finance son édition contre une redevance versée à l&apos;auteur.
          </li>
          <li>
            <strong>Les livres imprimés à la demande</strong> : un exemplaire imprimé d&apos;un livre édité, fabriqué
            à la commande.
          </li>
        </LegalList>
        <p>
          Pour l&apos;édition, le contrat signé avec l&apos;auteur complète les présentes conditions et prévaut en cas
          de contradiction.
        </p>
      </LegalSection>

      <LegalSection title="Article 2. Comptes et espaces">
        <LegalList>
          <li>
            Vous devez être majeur, ou autorisé par votre représentant légal, et fournir des informations exactes.
            Une adresse email correspond à un seul compte, qui donne accès à l&apos;espace auteur, à l&apos;espace
            acheteur et à l&apos;espace vendeur selon votre usage.
          </li>
          <li>
            Vous êtes responsable de la confidentialité de votre mot de passe et de l&apos;activité de votre compte.
            Prévenez-nous sans délai en cas d&apos;usage frauduleux.
          </li>
          <li>
            Nous pouvons suspendre un compte en cas de fraude, de contenu illicite ou de violation des présentes
            conditions.
          </li>
          <li>
            Vous pouvez supprimer votre compte depuis{" "}
            <Link href="/profil/suppression" className={link}>
              « Mon profil »
            </Link>
            , sous réserve des commandes en cours et des sommes qui vous sont dues.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 3. Mise en ligne des ouvrages par TechLibrairie">
        <p>
          <strong>Aucun ouvrage n&apos;est mis en vente sans validation de TechLibrairie.</strong> Seule TechLibrairie
          met un ouvrage en ligne.
        </p>
        <LegalList>
          <li>
            <strong>PDF déposé par un vendeur</strong> : il reste invisible tant qu&apos;il n&apos;a pas été vérifié. Nous
            le validons, ou nous le refusons avec un motif transmis au vendeur. Aucun délai de validation n&apos;est
            garanti, et la validation ne vaut pas garantie du contenu.
          </li>
          <li>
            <strong>Livre à éditer (compte d&apos;auteur ou compte d&apos;éditeur)</strong> : il est confié à TechLibrairie
            Édition pour un travail éditorial et n&apos;apparaît jamais dans le catalogue au dépôt. Après l&apos;édition
            et l&apos;approbation du bon à tirer par l&apos;auteur, TechLibrairie procède à une vérification finale puis
            met le livre en ligne. L&apos;approbation du bon à tirer ne vaut pas mise en vente.
          </li>
          <li>
            Un vendeur qui remplace le fichier d&apos;un ouvrage déjà en ligne le renvoie en validation. Il peut retirer
            son ouvrage de la vente à tout moment, et ne peut le remettre en vente lui-même que s&apos;il a déjà été
            validé.
          </li>
          <li>
            Nous pouvons suspendre ou retirer un ouvrage à tout moment, notamment après un signalement (article 15).
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 4. Les types d'ouvrages et leurs badges">
        <LegalList>
          <li>
            <strong>« Document PDF »</strong> : document mis en vente par son auteur ou son vendeur après validation. Il
            n&apos;a pas fait l&apos;objet d&apos;un travail éditorial de TechLibrairie Édition.
          </li>
          <li>
            <strong>« Compte d&apos;auteur »</strong> : livre dont l&apos;édition a été financée par l&apos;auteur. TechLibrairie
            Édition en a assuré la mise en page ; le contenu relève de la responsabilité de l&apos;auteur.
          </li>
          <li>
            <strong>« TechLibrairie Édition »</strong> : livre sélectionné, édité et publié par TechLibrairie Édition à
            compte d&apos;éditeur.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 5. Boutique : prix, commande et paiement">
        <LegalList>
          <li>
            Les prix sont indiqués en francs CFA, sans taxe supplémentaire, et fixés par le vendeur ou l&apos;auteur. Le
            prix affiché lors de la validation de la commande est le prix applicable.
          </li>
          <li>Une commande est conclue lorsque le paiement est confirmé. {summary}.</li>
          <li>
            Nous ne conservons aucun numéro de carte ni code secret. Les paiements sont traités par nos prestataires de
            paiement, qui nous transmettent seulement la confirmation.
          </li>
          <li>
            Un code promotionnel s&apos;applique dans les conditions qui lui sont propres et ne se cumule pas, sauf
            indication contraire.
          </li>
          <li>
            Un auteur ou un vendeur ne peut pas acheter son propre ouvrage ; il peut en revanche commander ses
            exemplaires imprimés au prix de fabrication (article 7).
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 6. Téléchargement des PDF">
        <p>
          Après le paiement, le PDF est disponible immédiatement dans « Mes commandes », par un lien personnel et
          sécurisé, limité dans le temps et en nombre de téléchargements. Si le lien expire, vous pouvez en demander un
          nouveau depuis votre espace. Les fichiers ne sont jamais accessibles publiquement.
        </p>
      </LegalSection>

      <LegalSection title="Article 7. Livres imprimés à la demande">
        <LegalList>
          <li>
            Chaque exemplaire imprimé est <strong>fabriqué à la commande</strong>, sans stock. Le prix de
            l&apos;exemplaire est fixé par l&apos;auteur ; les frais de livraison, fixés par zone, s&apos;y ajoutent et sont
            affichés avant la validation. Une commande porte sur {MAX_COPIES_PER_ORDER} exemplaires au maximum.
          </li>
          <li>
            Pour commander, vous indiquez le nom du destinataire, une adresse complète et un numéro de téléphone, exigé
            par le transporteur. Vous déclarez ensuite votre paiement (référence de la transaction) : la fabrication
            commence quand l&apos;administration l&apos;a vérifié.
          </li>
          <li>
            Une commande livrée au <strong>Burkina Faso</strong> est traitée localement par TechLibrairie. Une commande
            livrée à l&apos;étranger est fabriquée et expédiée par notre prestataire d&apos;impression, à qui votre nom, votre
            adresse et votre téléphone sont transmis pour la livraison.
          </li>
          <li>
            Les délais de fabrication et de livraison sont donnés à titre indicatif et dépendent du prestataire, du
            transporteur et des douanes. Vous êtes prévenu par email à l&apos;expédition, avec le suivi du colis quand il
            existe. Les droits de douane et taxes locales éventuels sont à votre charge.
          </li>
          <li>
            Si l&apos;exemplaire reçu est endommagé ou comporte un défaut de fabrication, signalez-le sous quinze jours :
            nous le remplaçons ou nous vous remboursons.
          </li>
          <li>
            Votre adresse reste nécessaire jusqu&apos;à la livraison : la suppression d&apos;un compte est refusée tant
            qu&apos;une commande est en cours.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 8. Téléchargements gratuits">
        <p>
          Les PDF gratuits sont téléchargeables sans compte, après une courte attente financée par la publicité. Ils
          restent soumis aux droits de leurs auteurs : l&apos;article 14 s&apos;applique.
        </p>
      </LegalSection>

      <LegalSection title="Article 9. Rétractation, garanties et remboursements">
        <LegalList>
          <li>
            <strong>PDF</strong> : le contenu numérique est fourni immédiatement après le paiement. En demandant le
            téléchargement, vous demandez l&apos;exécution immédiate du contrat et vous reconnaissez, dans la mesure permise
            par la loi applicable, que vous perdez votre droit de rétractation dès le début du téléchargement. Un PDF
            défectueux ou ne correspondant pas à sa description est remplacé ou remboursé.
          </li>
          <li>
            <strong>Livre imprimé</strong> : vous disposez de <strong>quatorze jours à compter de la réception</strong> pour
            vous rétracter, sans motif, en nous écrivant puis en renvoyant l&apos;exemplaire en bon état. Les frais de
            retour sont à votre charge. Nous vous remboursons dans les quatorze jours suivant la réception du retour.
          </li>
          <li>
            <strong>Garanties légales</strong> : vous bénéficiez des garanties légales de conformité applicables dans
            votre pays, qui ne sont pas limitées par les présentes conditions.
          </li>
          <li>
            Les remboursements se font par le moyen de paiement d&apos;origine ou, à défaut, par Mobile Money, et sont
            traités par l&apos;administration. Un remboursement retire de la commande les gains du vendeur concerné.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 10. Règles applicables aux vendeurs de PDF">
        <LegalList>
          <li>
            Vous garantissez détenir les droits sur les documents que vous déposez et assumez l&apos;entière responsabilité
            de leur contenu. Vous cochez une déclaration à chaque dépôt.
          </li>
          <li>
            Votre ouvrage est mis en vente après validation (article 3). Vous fixez votre prix, en francs CFA, par
            multiples de 5.
          </li>
          <li>
            La boutique prélève une commission de <strong>{commission} %</strong> sur chaque vente, ce taux pouvant être
            adapté pour un vendeur donné. Les ventes d&apos;un livre édité à compte d&apos;auteur ne supportent aucune
            commission.
          </li>
          <li>
            Vos gains deviennent retirables <strong>{PAYOUT_HOLD_DAYS} jours</strong> après le paiement de l&apos;acheteur.
            Pour un exemplaire imprimé, ils le deviennent après l&apos;expédition de la commande, et au moins{" "}
            {PAYOUT_HOLD_DAYS} jours après son paiement. Le versement, par Mobile Money, se demande depuis votre espace à
            partir de <strong>{formatXofAmount(minimumPayout)}</strong>.
          </li>
          <li>
            Nous pouvons suspendre vos ventes et retenir les sommes concernées en cas de fraude, de contrefaçon avérée
            ou de remboursement.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 11. Édition à compte d'auteur">
        <LegalList>
          <li>
            L&apos;auteur dépose son livre, déclare ses droits et accepte en ligne le contrat d&apos;édition à compte
            d&apos;auteur (version {CONTRACT_VERSION}), qu&apos;il signe en tapant son nom.{" "}
            <Link href="/contrat-edition" className={link}>
              Lire le contrat
            </Link>
            .
          </li>
          <li>
            Il règle ensuite un <strong>forfait unique de {formatXofAmount(offers.authorFeeXof)} par livre</strong>, toutes
            taxes comprises, par Mobile Money. L&apos;administration vérifie le paiement avant de commencer.
          </li>
          <li>
            Le forfait couvre le contrôle de conformité, la mise en page selon la charte de TechLibrairie Édition et la
            publication. L&apos;auteur reçoit une épreuve (bon à tirer) à approuver, avec {offers.correctionRounds} séries
            de corrections incluses. Le livre est mis en ligne par TechLibrairie après l&apos;approbation du bon à tirer.
          </li>
          <li>
            L&apos;auteur garde ses droits d&apos;auteur et 100 % du produit net de ses ventes, sans commission. Les frais
            d&apos;impression d&apos;un exemplaire imprimé sont à sa charge et déduits de chaque vente imprimée, sans avance de
            sa part ; le prix de l&apos;exemplaire imprimé ne peut pas être inférieur à un prix plancher couvrant la
            fabrication.
          </li>
          <li>
            Si le livre est refusé pour non-conformité (contenu illicite, droits non justifiés), le forfait versé est
            remboursé intégralement.
          </li>
          <li>
            L&apos;auteur peut télécharger son contrat en PDF <strong>dès que le règlement du forfait est validé</strong>,
            depuis son espace auteur.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 12. Édition à compte d'éditeur">
        <LegalList>
          <li>
            La soumission d&apos;un manuscrit est <strong>gratuite</strong>. Le manuscrit est examiné par l&apos;équipe
            éditoriale, qui le retient ou le refuse avec un message. Aucune acceptation n&apos;est garantie et la soumission
            n&apos;engage ni la publication ni la conclusion d&apos;un contrat.
          </li>
          <li>
            Le manuscrit est conservé en accès privé pendant l&apos;examen. Il est supprimé avec le compte de
            l&apos;auteur.
          </li>
          <li>
            Si le manuscrit est retenu, un <strong>contrat d&apos;édition à compte d&apos;éditeur</strong> (version{" "}
            {PUBLISHER_CONTRACT_VERSION}) est généré au nom de l&apos;auteur, avec sa redevance (indicativement{" "}
            {offers.publisherRoyaltyPercent} % du prix public hors taxes de chaque exemplaire vendu, fixée dans le
            contrat). L&apos;auteur le lit et le signe en ligne, sans rendez-vous, puis le télécharge en PDF.{" "}
            <Link href="/contrat-editeur" className={link}>
              Lire le modèle de contrat
            </Link>
            .
          </li>
          <li>
            TechLibrairie Édition finance alors la mise en page, la fabrication et la diffusion. L&apos;auteur ne supporte
            aucun frais d&apos;édition.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 13. Contrats et signature électronique">
        <LegalList>
          <li>
            Les contrats d&apos;édition se concluent en ligne : l&apos;auteur coche la case d&apos;acceptation et saisit son
            nom, ce qui vaut signature. Aucun rendez-vous n&apos;est nécessaire.
          </li>
          <li>
            Le texte accepté, sa version, son empreinte numérique, la date, le nom saisi, l&apos;adresse email du compte et
            l&apos;empreinte de la connexion sont conservés et valent preuve entre les parties, y compris après la
            suppression du compte, pour nos obligations légales.
          </li>
          <li>
            Un contrat signé n&apos;est jamais modifié : toute évolution du texte donne lieu à une nouvelle version, qui ne
            s&apos;applique qu&apos;aux contrats signés après elle.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 14. Propriété intellectuelle et usage des fichiers">
        <LegalList>
          <li>
            Les ouvrages restent la propriété de leurs auteurs. L&apos;achat d&apos;un PDF donne un droit d&apos;usage personnel
            et privé : il est interdit de le copier, de le revendre, de le partager ou de le publier.
          </li>
          <li>
            Chaque auteur ou vendeur accorde à TechLibrairie les droits nécessaires pour présenter, diffuser et vendre
            son ouvrage sur le site. Pour l&apos;édition, le contrat en précise l&apos;étendue.
          </li>
          <li>
            La marque, le logo, la charte et la mise en page de TechLibrairie Édition appartiennent à l&apos;exploitant du
            site.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Article 15. Contenus interdits et signalement">
        <p>
          Sont interdits les contenus illicites, contrefaisants, diffamatoires, haineux, portant atteinte à la vie privée
          ou aux mineurs, ainsi que ceux dont le déposant n&apos;a pas les droits. Pour signaler un contenu, écrivez-nous
          par le formulaire en bas de page en indiquant l&apos;ouvrage concerné, vos droits et vos coordonnées. Après un
          signalement vraisemblable, nous pouvons retirer l&apos;ouvrage sans délai, informer son vendeur et lui permettre
          de répondre.
        </p>
      </LegalSection>

      <LegalSection title="Article 16. Support et publicité">
        <p>
          Le support peut être payant selon la catégorie de la demande, le tarif étant affiché avant l&apos;envoi. Le site
          affiche des publicités de partenaires, chargées seulement après votre accord ; la{" "}
          <Link href="/confidentialite" className={link}>
            politique de confidentialité
          </Link>{" "}
          en précise les conditions.
        </p>
      </LegalSection>

      <LegalSection title="Article 17. Responsabilité">
        <p>
          TechLibrairie met en œuvre les moyens raisonnables pour assurer la disponibilité du site, sans garantie
          d&apos;accès ininterrompu. Le contenu d&apos;un ouvrage relève de la responsabilité de son auteur ou de son vendeur.
          Notre responsabilité ne saurait être engagée pour les dommages indirects, ni pour un retard dû à un cas de force
          majeure (panne du réseau, du prestataire de paiement ou d&apos;impression, transporteur, douane), sous réserve des
          droits que la loi vous reconnaît.
        </p>
      </LegalSection>

      <LegalSection title="Article 18. Données personnelles">
        <p>
          Le traitement de vos données, y compris celles des commandes imprimées et des manuscrits, est décrit dans la{" "}
          <Link href="/confidentialite" className={link}>
            politique de confidentialité
          </Link>
          , qui explique aussi comment télécharger vos données et supprimer votre compte.
        </p>
      </LegalSection>

      <LegalSection title="Article 19. Droit applicable, litiges et médiation">
        <p>
          Les présentes conditions sont soumises au droit en vigueur au {legal.country}. En cas de litige, contactez-nous
          d&apos;abord : nous recherchons une solution amiable. Vous pouvez aussi recourir gratuitement au médiateur de la
          consommation compétent dans votre pays, ou à tout autre mode alternatif de règlement des litiges. À défaut
          d&apos;accord, le litige relève de la juridiction compétente selon la loi applicable, sans priver le consommateur
          des protections qui lui sont reconnues.
        </p>
      </LegalSection>

      <LegalSection title="Article 20. Modification des conditions">
        <p>
          Nous pouvons modifier ces conditions. La date de dernière mise à jour figure en haut de cette page. Les
          modifications s&apos;appliquent aux commandes et aux dépôts postérieurs ; les contrats d&apos;édition déjà signés
          restent régis par leur propre version.
        </p>
      </LegalSection>

      <LegalSection title="Article 21. Contact">
        <p>
          Pour toute question, écrivez-nous par le formulaire en bas de page
          {contact.email ? (
            <>
              {" "}
              ou à{" "}
              <a href={`mailto:${contact.email}`} className={link}>
                {contact.email}
              </a>
            </>
          ) : null}
          . Les mentions légales se trouvent{" "}
          <Link href="/mentions-legales" className={link}>
            ici
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
