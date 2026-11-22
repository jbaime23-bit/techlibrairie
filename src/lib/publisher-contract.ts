// src/lib/publisher-contract.ts
// Contrat d'édition à compte d'éditeur (articles L132-1 et suivants du Code de la propriété intellectuelle),
// proposé à l'auteur d'un manuscrit retenu : texte, version et texte de la case d'acceptation.
//
// RÈGLE : ne jamais modifier une version déjà proposée. Toute évolution du texte passe par une nouvelle
// version (PUBLISHER_CONTRACT_VERSION), car le texte proposé est archivé avec sa version.
// MODÈLE À FAIRE RELIRE par un avocat avant usage : les durées et pourcentages sont des valeurs de départ.

import { getLegalConfig, operatorName } from "@/lib/legal-config";
import type { ContractArticle, ContractDocument } from "@/lib/edition-contract";

export const PUBLISHER_CONTRACT_VERSION = "1.0";

const MONTHS_TO_PUBLISH = 12;
const DAYS_PROOF_REVIEW = 15;
const CORRECTION_ROUNDS = 2;
const TERM_YEARS = 5;
const RENEWAL_YEARS = 2;
const NOTICE_MONTHS = 6;
const FORMAL_NOTICE_MONTHS = 3;
const REPORT_DEADLINE_MONTHS = 3;

export interface PublisherContractParams {
  workTitle: string;
  authorName: string;
  royaltyPercent: number;
}

function formatXof(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export function publisherContractAcceptanceText(workTitle: string, royaltyPercent: number): string {
  return `J'ai lu et j'accepte le contrat d'édition à compte d'éditeur (version ${PUBLISHER_CONTRACT_VERSION}) pour l'œuvre « ${workTitle} », avec une redevance de ${royaltyPercent} % du prix public hors taxes de chaque exemplaire vendu. Je sais que je signe ce contrat en ligne et que je peux le télécharger en PDF.`;
}

export function buildPublisherContract(p: PublisherContractParams): ContractDocument {
  const legal = getLegalConfig();
  const publisher = operatorName(legal);
  const seat = legal.address ? `, dont le siège est situé ${legal.address}` : "";
  const registration = legal.registration ? `, immatriculée sous le numéro ${legal.registration}` : "";
  const pct = p.royaltyPercent;
  const exampleDigital = Math.round((5000 * pct) / 100);
  const examplePrint = Math.round((9000 * pct) / 100);

  const articles: ContractArticle[] = [
    {
      title: "Article 1. Objet et qualification",
      paragraphs: [
        `Le présent contrat a pour objet l'édition, la publication et la diffusion, aux frais et aux risques de l'Éditeur, de l'œuvre intitulée « ${p.workTitle} », de ${p.authorName} (ci-après « l'Œuvre »), dont le manuscrit a été déposé sur la Plateforme (ci-après « le Manuscrit »).`,
        "Il s'agit d'un contrat d'édition au sens de l'article L132-1 du Code de la propriété intellectuelle : l'Auteur cède à l'Éditeur le droit de fabriquer ou de faire fabriquer des exemplaires de l'Œuvre et de les diffuser, et l'Éditeur s'engage à en assurer la publication et l'exploitation permanente et suivie. L'Auteur ne supporte aucun frais d'édition.",
        "Conformément à l'article L132-17-1 du Code de la propriété intellectuelle, le contrat comprend une partie distincte pour l'exploitation sous forme imprimée à la demande (article 3) et une partie distincte pour l'exploitation sous forme numérique (article 4).",
      ],
    },
    {
      title: "Article 2. Définitions",
      paragraphs: [
        "Plateforme : le site techlibrairie.com. Manuscrit : le fichier de l'Œuvre déposé par l'Auteur sur la Plateforme.",
        "Maquette : la mise en page de l'Œuvre selon la charte graphique de l'Éditeur. Bon à tirer : l'épreuve de la Maquette, soumise à l'approbation de l'Auteur.",
        "Formats : (a) le livre imprimé à la demande, fabriqué à l'unité à chaque commande par un prestataire d'impression ; (b) le livre numérique au format PDF, vendu au téléchargement.",
        "Prix public hors taxes : le prix payé par l'acheteur pour l'exemplaire, hors frais de livraison et hors taxes.",
      ],
    },
    {
      title: "Article 3. Partie A. Édition imprimée à la demande : étendue de la cession",
      paragraphs: [
        "Droit cédé : le droit de reproduction, c'est-à-dire de fabriquer ou de faire fabriquer, à la demande et à l'unité, des exemplaires imprimés de l'Œuvre, et le droit de les distribuer et de les vendre au public.",
        "Destination : la vente aux lecteurs, par la Plateforme et par les réseaux de distribution de l'Éditeur et de ses prestataires.",
        "Lieu : le monde entier, sous réserve des restrictions du prestataire d'impression. Durée : celle du contrat (article 12). La cession est consentie à titre exclusif pour ce Format.",
      ],
    },
    {
      title: "Article 4. Partie B. Édition numérique : étendue de la cession",
      paragraphs: [
        "Droit cédé : le droit de reproduction de l'Œuvre sous forme de fichier numérique au format PDF, et le droit de représentation consistant à mettre ce fichier à la disposition du public, à le vendre et à le faire télécharger en ligne, ainsi qu'à diffuser des extraits (couverture, quatrième de couverture, premières pages) pour la présentation et la promotion de l'Œuvre.",
        "Destination : la vente aux lecteurs, par la Plateforme et par les services de vente en ligne de l'Éditeur. Lieu : le monde entier. Durée : celle du contrat (article 12). La cession est consentie à titre exclusif pour ce Format.",
        "L'Éditeur assure l'exploitation numérique de l'Œuvre de façon permanente et suivie, y compris la mise à disposition du fichier aux acheteurs et la protection de l'Œuvre contre la copie illicite dans la mesure de ses moyens.",
      ],
    },
    {
      title: "Article 5. Droits non cédés et droit moral",
      paragraphs: [
        "Tous les droits qui ne sont pas expressément cédés par le présent contrat restent la propriété de l'Auteur, notamment les droits d'adaptation (audiovisuelle, théâtrale, radiophonique), de traduction, d'édition de poche et d'édition en livre audio. Toute exploitation de ces droits fait l'objet d'un avenant écrit distinct. La cession globale d'œuvres futures est exclue.",
        "L'Auteur conserve son droit moral : son nom (ou son pseudonyme) figure sur l'Œuvre et sur sa fiche, l'intégrité du texte est respectée, et aucune modification n'est faite sans son accord écrit. Seule la mise en page est adaptée, sous réserve du bon à tirer. Le droit de divulgation, de repentir et de retrait de l'Auteur s'exerce dans les conditions de la loi.",
      ],
    },
    {
      title: "Article 6. Déclarations et garanties de l'Auteur",
      paragraphs: [
        "L'Auteur déclare et garantit : être l'auteur de l'Œuvre ou en détenir les droits nécessaires à la conclusion du présent contrat ; que l'Œuvre est originale et que les éléments de tiers qu'elle contient (textes, images, schémas, polices) sont utilisés avec autorisation et mentionnés ; ne pas avoir cédé à un tiers, en exclusivité, les droits cédés par le présent contrat pour sa durée ; que l'Œuvre ne contient rien d'illicite, de diffamatoire, d'injurieux, de discriminatoire, de contrefaisant ou de contraire à la vie privée ; avoir obtenu l'accord de chaque coauteur, illustrateur ou ayant droit.",
        "L'Auteur garantit à l'Éditeur la jouissance paisible des droits cédés et le garantit contre toute réclamation de tiers résultant d'un manquement à ces déclarations, dans les limites permises par la loi.",
      ],
    },
    {
      title: "Article 7. Obligations de l'Éditeur : publication, exploitation et bon à tirer",
      paragraphs: [
        `L'Éditeur réalise la Maquette et publie l'Œuvre dans un délai de ${MONTHS_TO_PUBLISH} mois à compter du jour où l'Auteur a remis un Manuscrit définitif, complet et conforme, et approuvé le bon à tirer.`,
        `Il soumet un bon à tirer à l'Auteur, qui dispose de ${DAYS_PROOF_REVIEW} jours pour l'approuver ou demander des corrections. ${CORRECTION_ROUNDS} séries de corrections de la Maquette sont comprises. La publication n'a lieu qu'après l'approbation expresse de l'Auteur, donnée en ligne depuis son espace.`,
        "L'Éditeur assure à l'Œuvre une exploitation permanente et suivie et une diffusion commerciale conforme aux usages de la profession (article L132-12 du Code de la propriété intellectuelle). Il prend en charge tous les frais d'édition : mise en page, fichiers numériques et d'impression, couverture, ISBN, diffusion.",
        "L'Éditeur peut refuser, avant publication et par une décision motivée, une œuvre contraire à la loi ou aux droits de tiers ; le contrat est alors résilié sans frais pour l'Auteur.",
      ],
    },
    {
      title: "Article 8. Rémunération de l'Auteur",
      paragraphs: [
        `En contrepartie de la cession, l'Éditeur verse à l'Auteur une rémunération proportionnelle aux recettes d'exploitation (article L131-4 du Code de la propriété intellectuelle) : ${pct} % du prix public hors taxes de chaque exemplaire vendu et payé, pour chacun des deux Formats (imprimé à la demande et numérique).`,
        "Les exemplaires remboursés à l'acheteur sont déduits. Les exemplaires remis gratuitement à l'Auteur, à la presse ou à titre promotionnel, dans la limite de 10 % des ventes, ne donnent lieu à aucune rémunération.",
        "L'Éditeur supporte seul les frais de fabrication, de livraison, de paiement et de diffusion : ils ne sont pas déduits de l'assiette de la rémunération de l'Auteur.",
      ],
    },
    {
      title: "Article 9. Reddition des comptes et paiement",
      paragraphs: [
        `L'Éditeur rend compte à l'Auteur au moins une fois par an (article L132-13 du Code de la propriété intellectuelle) : un état arrêté au 31 décembre, remis dans les ${REPORT_DEADLINE_MONTHS} mois, indique pour chaque Format le nombre d'exemplaires vendus, les remboursements, le prix public hors taxes et le montant des droits dus. Un relevé des ventes est également consultable à tout moment dans l'espace de l'Auteur.`,
        "Les droits sont versés par Mobile Money, à la demande de l'Auteur, après le délai de sécurité et au-dessus du montant minimum indiqués dans les conditions de la Plateforme, et au plus tard avec l'état annuel.",
        "L'Auteur peut demander à l'Éditeur les justifications de son état, dans les conditions de la loi.",
      ],
    },
    {
      title: "Article 10. Prix de vente et exemplaires de l'Auteur",
      paragraphs: [
        "Le prix public de chaque Format est fixé par l'Éditeur, après avis de l'Auteur. L'Éditeur peut organiser des promotions, sans que la rémunération de l'Auteur soit calculée sur un prix inférieur à 80 % du prix public.",
        "L'Auteur reçoit gratuitement le fichier PDF final de l'Œuvre. Il peut commander des exemplaires imprimés au prix de fabrication, augmenté des frais de livraison.",
      ],
    },
    {
      title: "Article 11. ISBN, mentions légales et dépôt légal",
      paragraphs: [
        "L'Éditeur attribue à chaque Format un ISBN distinct, dont il est l'éditeur de référence. Une page de copyright est ajoutée à l'Œuvre : titre, nom de l'Auteur, © Auteur et année, éditeur du Format, ISBN, mention du dépôt légal, crédits de la Maquette.",
        "L'Éditeur accomplit les formalités de dépôt légal de chaque Format, conformément à la réglementation applicable.",
      ],
    },
    {
      title: "Article 12. Durée et renouvellement",
      paragraphs: [
        `Le contrat prend effet à la signature. La cession est consentie pour ${TERM_YEARS} ans à compter de la publication de l'Œuvre. Elle se renouvelle ensuite tacitement par périodes de ${RENEWAL_YEARS} ans, sauf dénonciation par l'une des Parties, par écrit (message adressé par la Plateforme ou par courriel), au moins ${NOTICE_MONTHS} mois avant l'échéance.`,
        "À l'expiration du contrat, les droits cédés reviennent à l'Auteur. L'Éditeur retire l'Œuvre de la vente dans un délai de 30 jours. Les fichiers déjà livrés aux acheteurs et les droits échus restent acquis.",
      ],
    },
    {
      title: "Article 13. Défaut d'exploitation et résiliation",
      paragraphs: [
        `Si l'Éditeur ne publie pas l'Œuvre dans le délai de l'article 7, ou cesse d'en assurer l'exploitation permanente et suivie, l'Auteur peut le mettre en demeure d'y remédier. Faute d'y remédier dans un délai de ${FORMAL_NOTICE_MONTHS} mois, le contrat est résilié de plein droit, par référence aux articles L132-17 et suivants du Code de la propriété intellectuelle, et l'Auteur recouvre ses droits.`,
        "Chaque Partie peut résilier le contrat en cas de manquement grave de l'autre, après une mise en demeure restée sans effet pendant 30 jours. L'Éditeur peut suspendre ou résilier sans préavis en cas de contenu manifestement illicite ou de réclamation fondée d'un tiers.",
      ],
    },
    {
      title: "Article 14. Sous-traitance et cession du contrat",
      paragraphs: [
        "L'Éditeur peut confier la fabrication, la livraison, l'hébergement et la distribution à des prestataires, tout en restant responsable à l'égard de l'Auteur. Il ne peut céder le contrat à un tiers qu'avec l'accord de l'Auteur, sauf transmission à une entité reprenant l'ensemble de son activité d'édition, qui reprend alors toutes ses obligations.",
      ],
    },
    {
      title: "Article 15. Données personnelles et confidentialité",
      paragraphs: [
        "L'Éditeur traite les données de l'Auteur pour exécuter le contrat, selon sa politique de confidentialité. Le Manuscrit reste confidentiel jusqu'à sa publication.",
      ],
    },
    {
      title: "Article 16. Acceptation en ligne et preuve",
      paragraphs: [
        "Le contrat est conclu en ligne : il est proposé à l'Auteur dans son espace, qui l'accepte en cochant la case d'acceptation et en saisissant son nom, ce qui vaut signature. Aucun rendez-vous n'est nécessaire.",
        "Le texte proposé, sa version, son empreinte SHA-256, l'horodatage de l'acceptation, le nom saisi, l'adresse électronique du compte et l'empreinte de la connexion de l'Auteur sont conservés par l'Éditeur et valent preuve entre les Parties. L'Auteur peut télécharger à tout moment un exemplaire du contrat en PDF depuis son espace.",
      ],
    },
    {
      title: "Article 17. Loi applicable et règlement des litiges",
      paragraphs: [
        `Le contrat est régi par le droit en vigueur au ${legal.country}. Les références au Code de la propriété intellectuelle français valent référence contractuelle des garanties consenties à l'Auteur : elles s'appliquent entre les Parties dans la mesure où elles ne contredisent pas les dispositions impératives de la loi applicable.`,
        "Les Parties recherchent d'abord une solution amiable. À défaut, le litige relève de la juridiction compétente selon la loi applicable, l'Auteur conservant les droits que la loi lui reconnaît.",
      ],
    },
  ];

  const annexes: ContractArticle[] = [
    {
      title: "Annexe A. Conditions particulières",
      paragraphs: [
        `Œuvre : « ${p.workTitle} » · Auteur : ${p.authorName} · Formats : livre imprimé à la demande et livre numérique PDF · Rémunération : ${pct} % du prix public hors taxes de chaque exemplaire vendu · Cession : à titre exclusif, monde entier, ${TERM_YEARS} ans renouvelables par périodes de ${RENEWAL_YEARS} ans · Délai de publication : ${MONTHS_TO_PUBLISH} mois · Corrections comprises : ${CORRECTION_ROUNDS} séries.`,
      ],
    },
    {
      title: "Annexe B. Exemple de calcul",
      paragraphs: [
        `Exemple fictif : un livre numérique vendu ${formatXof(5000)} rapporte à l'Auteur ${formatXof(exampleDigital)} (${pct} %) ; un exemplaire imprimé vendu ${formatXof(9000)} rapporte à l'Auteur ${formatXof(examplePrint)} (${pct} %), quels que soient les frais de fabrication et de livraison, supportés par l'Éditeur.`,
      ],
    },
    {
      title: "Annexe C. Bon à tirer",
      paragraphs: [
        "« Je soussigné(e), auteur de l'Œuvre, certifie avoir relu l'épreuve de la Maquette (version indiquée à l'écran, à la date de l'approbation) et approuve sa publication en l'état, avec ou sans les corrections listées. »",
      ],
    },
  ];

  return {
    version: PUBLISHER_CONTRACT_VERSION,
    title: "Contrat d'édition à compte d'éditeur",
    subtitle:
      "Contrat d'édition au sens des articles L132-1 et suivants du Code de la propriété intellectuelle, avec une partie distincte pour l'exploitation numérique",
    parties: [
      `ENTRE ${publisher}${seat}${registration}, exploitant l'activité d'édition TechLibrairie Édition (ci-après « l'Éditeur »),`,
      `ET ${p.authorName}, auteur de l'Œuvre, identifié par son compte sur la Plateforme et par l'adresse électronique et la signature enregistrées à la date d'acceptation (ci-après « l'Auteur »).`,
    ],
    articles,
    annexes,
  };
  }
