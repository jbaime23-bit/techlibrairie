// src/lib/edition-contract.ts
// Contrat d'édition à compte d'auteur (contrat de prestation, art. L132-2 du Code de la propriété
// intellectuelle) : texte, version, empreinte et textes des cases à cocher.
//
// RÈGLE : ne jamais modifier une version déjà utilisée. Toute évolution du texte passe par une nouvelle
// version (CONTRACT_VERSION), car le texte accepté par chaque auteur est archivé avec sa version.

import { createHash } from "crypto";
import { getLegalConfig, operatorName } from "@/lib/legal-config";
import { getContributionConfig } from "@/lib/publication-fee";

export const CONTRACT_VERSION = "1.0";

// Valeurs contractuelles (jours, nombre de tours, pourcentages) : à confirmer avec votre conseil juridique.
const DAYS_SERVICE = 30;
const DAYS_PROOF_REVIEW = 15;
const DAYS_PROOF_REMINDER = 30;
const CORRECTION_ROUNDS = 2;
const DAYS_AUTHOR_NOTICE = 30;
const DAYS_PUBLISHER_NOTICE = 60;
const PRICE_FLOOR_MARGIN_PERCENT = 10;

export const RIGHTS_WARRANTY_TEXT =
  "Je déclare être l'auteur de cette œuvre, ou détenir les droits nécessaires à son édition et à sa diffusion. Je n'ai pas cédé à un tiers, en exclusivité, les droits sur ces formats. Je garantis TechLibrairie Édition contre les réclamations de tiers résultant de cette déclaration.";

export const SERVICE_START_TEXT =
  "Je demande que TechLibrairie Édition commence la prestation (contrôle et mise en page) avant la fin du délai de rétractation de 14 jours. Je sais que si je me rétracte, je paierai la part déjà exécutée, et que je perds ce droit lorsque la prestation est entièrement exécutée.";

function formatXof(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export function contractAcceptanceText(amountXof: number): string {
  return `J'ai lu et j'accepte le contrat d'édition à compte d'auteur (version ${CONTRACT_VERSION}), y compris le forfait de ${formatXof(amountXof)} pour ce livre et la prise en charge des frais d'impression.`;
}

export interface ContractArticle {
  title: string;
  paragraphs: string[];
}

export interface ContractDocument {
  version: string;
  title: string;
  subtitle: string;
  parties: string[];
  articles: ContractArticle[];
  annexes: ContractArticle[];
}

export function buildContract(): ContractDocument {
  const legal = getLegalConfig();
  const fee = formatXof(getContributionConfig().amountXof);
  const publisher = operatorName(legal);
  const seat = legal.address ? `, dont le siège est situé ${legal.address}` : "";
  const registration = legal.registration ? `, immatriculée sous le numéro ${legal.registration}` : "";

  const articles: ContractArticle[] = [
    {
      title: "Article 1. Objet et qualification",
      paragraphs: [
        "Le présent contrat a pour objet la réalisation par TechLibrairie Édition, aux frais de l'Auteur, de l'édition de l'œuvre déposée sur la Plateforme (ci-après « l'Œuvre »), sa publication dans le catalogue de TechLibrairie et sa mise à disposition aux Formats définis à l'article 2.",
        "Les Parties reconnaissent qu'il s'agit d'un contrat à compte d'auteur, qui n'est pas un contrat d'édition au sens de l'article L132-1 du Code de la propriété intellectuelle. C'est un contrat de prestation (louage d'ouvrage) régi par ses stipulations et par le droit commun des contrats. TechLibrairie Édition ne supporte aucun risque d'exploitation et ne garantit aucune vente.",
      ],
    },
    {
      title: "Article 2. Définitions",
      paragraphs: [
        "Manuscrit : le fichier de l'Œuvre déposé par l'Auteur sur la Plateforme.",
        "Maquette : la mise en page de l'Œuvre selon la charte graphique de TechLibrairie Édition (annexe B).",
        "Bon à tirer (BAT) : l'épreuve de la Maquette, soumise à l'approbation de l'Auteur (annexe D).",
        "Formats : (a) le PDF numérique, vendu au téléchargement ; (b) le livre imprimé à la demande, fabriqué à l'unité à chaque commande par un prestataire d'impression, lorsque ce format est proposé sur la Plateforme.",
        "Plateforme : le site techlibrairie.com.",
      ],
    },
    {
      title: "Article 3. Déclarations et garanties de l'Auteur",
      paragraphs: [
        "L'Auteur déclare et garantit : être l'auteur de l'Œuvre ou en détenir les droits nécessaires à son édition et à sa diffusion ; que l'Œuvre est originale et que les éléments de tiers qu'elle contient (textes, images, schémas, polices) sont utilisés avec autorisation et mentionnés ; ne pas avoir cédé à un tiers, en exclusivité, les droits sur les Formats pour la durée du présent contrat ; que l'Œuvre ne contient rien d'illicite, de diffamatoire, d'injurieux, de discriminatoire, de contrefaisant ou de contraire à la vie privée ; avoir obtenu l'accord de chaque coauteur, illustrateur ou ayant droit, dont les noms sont indiqués à l'annexe A.",
        "L'Auteur garantit TechLibrairie Édition contre toute réclamation de tiers résultant d'un manquement à ces déclarations, et prend en charge les frais en résultant, dans les limites permises par la loi.",
        "Lorsque l'Auteur dépose l'Œuvre en qualité de titulaire des droits sans en être l'auteur, il remet sur demande l'autorisation écrite de l'auteur. À défaut, TechLibrairie Édition refuse ou suspend la prestation.",
      ],
    },
    {
      title: "Article 4. Droits et licence",
      paragraphs: [
        "L'Auteur demeure seul titulaire des droits de propriété intellectuelle sur l'Œuvre. Aucune cession n'est consentie.",
        "L'Auteur concède à TechLibrairie Édition, pour la seule exécution du présent contrat, une licence non exclusive comprenant, chacun séparément : (a) le droit de reproduction de l'Œuvre, pour la Maquette, la fabrication des exemplaires imprimés à la demande et la mise à disposition du PDF numérique ; (b) le droit de représentation et de distribution, en ligne et par le prestataire d'impression, aux Formats définis ; (c) le droit de reproduire des extraits (couverture, quatrième de couverture, premières pages) pour la présentation de l'Œuvre dans le catalogue et sa promotion.",
        "Territoire : le monde entier, sous réserve des restrictions du prestataire d'impression. Durée : celle du présent contrat (article 13). Destination : la vente aux acheteurs finals, par la Plateforme.",
        "Droit moral : le nom de l'Auteur (ou son pseudonyme) figure sur l'Œuvre et sur sa fiche. Aucune modification du texte n'est faite sans son accord écrit ; seule la mise en page est adaptée, sous réserve du bon à tirer.",
        "L'Auteur reste libre de publier l'Œuvre ailleurs, sous réserve de l'article 11 (ISBN).",
      ],
    },
    {
      title: "Article 5. Prestations de TechLibrairie Édition",
      paragraphs: [
        "TechLibrairie Édition réalise les prestations de l'annexe A : contrôle de conformité, Maquette, fichiers PDF numérique et d'impression, fiche catalogue et publication.",
        `Elle les exécute avec diligence, dans un délai indicatif de ${DAYS_SERVICE} jours à compter du règlement du forfait. Ce délai est suspendu pendant les périodes où la réponse de l'Auteur est attendue.`,
        "TechLibrairie Édition peut refuser une œuvre contraire à la loi, aux droits de tiers ou à sa charte éditoriale. Le refus est motivé. Si le forfait a été réglé, il est intégralement remboursé.",
      ],
    },
    {
      title: "Article 6. Forfait d'édition et paiement",
      paragraphs: [
        `Le forfait d'édition est de ${fee} (toutes taxes comprises, le cas échéant). Il est dû pour chaque nouveau livre, y compris pour un livre ultérieur du même Auteur.`,
        "Il est payable par Mobile Money, aussitôt après le dépôt du Manuscrit et avant le début de la Maquette, selon les modalités indiquées sur la Plateforme. Un reçu est remis à l'Auteur sur demande.",
        "Le forfait rémunère les prestations de l'annexe A. Il ne comprend ni les frais d'impression (article 9), ni les prestations optionnelles.",
        "Remboursement : intégral en cas de refus pour non-conformité (article 5) ou de rétractation exercée avant tout commencement de la prestation ; proportionnel dans les conditions de l'article 15. Aucun remboursement après la publication, sauf manquement de TechLibrairie Édition.",
        `Sont comprises dans le forfait ${CORRECTION_ROUNDS} séries de corrections de la Maquette avant bon à tirer. Toute correction ultérieure, après publication, fait l'objet d'un devis.`,
      ],
    },
    {
      title: "Article 7. Maquette et bon à tirer",
      paragraphs: [
        "TechLibrairie Édition soumet un bon à tirer à l'Auteur. La publication n'a lieu qu'après l'approbation expresse de ce bon à tirer par l'Auteur, donnée en ligne depuis son espace ou, à défaut, par écrit (courriel ou message) dont TechLibrairie Édition conserve la trace.",
        `L'Auteur dispose de ${DAYS_PROOF_REVIEW} jours pour approuver l'épreuve ou demander des corrections. Passé ce délai, TechLibrairie Édition le relance ; à défaut de réponse dans les ${DAYS_PROOF_REMINDER} jours suivant la relance, le projet est suspendu et peut être clos sans remboursement.`,
        "Le bon à tirer approuvé engage l'Auteur : les erreurs qu'il contient (texte, images, mise en page validée) ne peuvent être reprochées à TechLibrairie Édition.",
      ],
    },
    {
      title: "Article 8. Prix de vente et rémunération de l'Auteur",
      paragraphs: [
        "L'Auteur fixe le prix public de chaque Format, dans le respect du prix plancher de l'article 9.",
        "L'Auteur perçoit 100 % du produit net de chaque vente, c'est-à-dire le prix payé par l'acheteur, diminué : (a) pour un exemplaire imprimé, du coût de fabrication (article 9) ; (b) des frais de transaction du prestataire de paiement, le cas échéant ; (c) des taxes qui ne reviennent pas à l'Auteur. TechLibrairie Édition ne perçoit aucune commission sur ces ventes.",
        "Un relevé de ventes est disponible dans l'espace de l'Auteur. Les sommes dues sont versées par Mobile Money à sa demande, après le délai de sécurité et au-dessus du montant minimum indiqués dans les conditions de la Plateforme.",
        "En cas de remboursement d'un acheteur, la somme correspondante est déduite du produit net de l'Auteur.",
      ],
    },
    {
      title: "Article 9. Frais d'impression et de livraison : à la charge exclusive de l'Auteur",
      paragraphs: [
        "Les frais de fabrication des exemplaires imprimés sont intégralement supportés par l'Auteur. Ils sont déduits du produit de chaque vente d'un exemplaire imprimé.",
        "Les frais de livraison sont payés par l'acheteur au moment de sa commande, en plus du prix du livre.",
        "L'Auteur peut commander des exemplaires pour lui-même, au prix de fabrication augmenté des frais de livraison, payables avant le lancement de l'impression.",
        `Prix plancher : le prix public d'un exemplaire imprimé ne peut être inférieur au coût de fabrication estimé, majoré d'une marge de sécurité de ${PRICE_FLOOR_MARGIN_PERCENT} %. TechLibrairie Édition ajuste ce plancher lorsque le tarif du prestataire d'impression ou le taux de change évolue, et en informe l'Auteur. Tant que le prix de l'Auteur est inférieur au plancher, le Format imprimé est suspendu.`,
        "Un exemplaire défectueux du fait de la fabrication est réimprimé ou remboursé aux frais du prestataire d'impression. Un défaut provenant d'un fichier approuvé par l'Auteur (bon à tirer) reste à sa charge.",
        "Les commandes livrées au Burkina Faso peuvent être traitées par TechLibrairie Édition ou par un prestataire local, selon un barème communiqué à l'Auteur ; les frais de fabrication restent à sa charge.",
        "TechLibrairie Édition n'avance aucun frais : la fabrication d'un exemplaire n'est lancée qu'après le paiement confirmé de l'acheteur.",
      ],
    },
    {
      title: "Article 10. Distribution",
      paragraphs: [
        "TechLibrairie Édition met l'Œuvre en vente sur la Plateforme aux Formats choisis. Elle peut suspendre une commande ou un territoire pour des raisons légales, de sécurité de paiement ou d'impossibilité de livraison.",
        "La mention « Édition à compte d'auteur » figure sur chaque fiche de l'Œuvre.",
      ],
    },
    {
      title: "Article 11. ISBN, mentions légales et dépôt légal",
      paragraphs: [
        "Un ISBN distinct est attribué à chaque Format commercialisé. L'Auteur qui fournit son propre ISBN garantit qu'il lui a été attribué pour cette édition ; à défaut, TechLibrairie Édition peut attribuer un ISBN lorsqu'elle est l'éditeur de référence du Format. Un ISBN ne peut être réutilisé pour une autre édition.",
        "Une page de copyright est ajoutée à l'Œuvre : titre, nom de l'Auteur, © Auteur et année, éditeur du Format, ISBN, mention du dépôt légal, crédits de la Maquette.",
        "Les formalités de dépôt légal sont accomplies par l'éditeur de référence de chaque Format, conformément à la réglementation applicable.",
      ],
    },
    {
      title: "Article 12. Données personnelles et confidentialité",
      paragraphs: [
        "TechLibrairie Édition traite les données de l'Auteur pour exécuter le contrat, selon sa politique de confidentialité. Le Manuscrit reste confidentiel jusqu'à sa publication.",
      ],
    },
    {
      title: "Article 13. Durée, retrait et résiliation",
      paragraphs: [
        "Le contrat est conclu pour une durée indéterminée.",
        `L'Auteur peut retirer l'Œuvre de la vente à tout moment, avec un préavis de ${DAYS_AUTHOR_NOTICE} jours. Les acheteurs conservent leurs fichiers et les commandes en cours sont honorées. Le forfait n'est pas remboursé.`,
        `TechLibrairie Édition peut suspendre ou résilier le contrat sans préavis en cas de contenu illicite, de réclamation fondée d'un tiers, de fausse déclaration de l'Auteur ou de fraude. Elle peut le résilier pour toute autre raison avec un préavis de ${DAYS_PUBLISHER_NOTICE} jours, avec remboursement du forfait si la Maquette n'est pas terminée.`,
        "À la fin du contrat, la licence de l'article 4 prend fin. Les exemplaires déjà vendus et les fichiers déjà livrés aux acheteurs ne sont pas affectés.",
      ],
    },
    {
      title: "Article 14. Responsabilité",
      paragraphs: [
        "L'Auteur est seul responsable du contenu de l'Œuvre. TechLibrairie Édition n'est pas responsable de son contenu éditorial, mais s'engage à retirer ou suspendre un contenu manifestement illicite dès qu'elle en a connaissance.",
        "La responsabilité de TechLibrairie Édition est limitée aux dommages directs, hors faute lourde ou dolosive, dans la mesure où la loi le permet. Elle ne répond pas des retards, erreurs ou défauts imputables à un prestataire d'impression au-delà de ce que ce prestataire garantit lui-même.",
      ],
    },
    {
      title: "Article 15. Droit de rétractation de l'Auteur consommateur",
      paragraphs: [
        "Si l'Auteur agit en dehors de son activité professionnelle, il dispose de 14 jours à compter de l'acceptation du contrat pour se rétracter, sans motif.",
        "S'il a demandé expressément que la prestation commence avant la fin de ce délai, il paie, en cas de rétractation, la part de la prestation déjà fournie, proportionnellement au prix convenu.",
        "Une fois la prestation entièrement exécutée, l'Auteur ne peut plus se rétracter s'il y a consenti expressément et reconnu qu'il perdait ce droit.",
      ],
    },
    {
      title: "Article 16. Dispositions générales",
      paragraphs: [
        "Le contrat comprend ses annexes A à D. Toute modification du modèle de contrat n'a d'effet que pour les contrats acceptés ensuite.",
        "Le contrat est accepté en ligne. Le texte accepté, sa version, son empreinte, l'horodatage, le nom saisi par l'Auteur comme signature, l'adresse électronique de son compte et l'empreinte de sa connexion sont conservés par TechLibrairie Édition. L'Auteur peut en obtenir un exemplaire sur demande.",
        "TechLibrairie Édition peut sous-traiter l'impression et la livraison. Aucune des Parties ne peut céder le contrat sans l'accord de l'autre, sauf transmission à une entité reprenant l'activité d'édition.",
        `Le contrat est régi par le droit en vigueur au ${legal.country}. Les Parties recherchent d'abord une solution amiable ; l'Auteur consommateur peut recourir à un médiateur de la consommation dont les coordonnées lui sont communiquées sur demande, et conserve ses droits devant la juridiction compétente.`,
      ],
    },
  ];

  const annexes: ContractArticle[] = [
    {
      title: "Annexe A. Prestations incluses",
      paragraphs: [
        "Contrôle de conformité · Maquette (charte, polices incorporées et libres de droits, crédits) · fichier PDF numérique · fichiers d'impression (intérieur et couverture) · fiche catalogue · publication · attribution d'ISBN selon l'article 11 · deux séries de corrections avant bon à tirer.",
        "Non inclus : réécriture, correction orthographique approfondie, traduction, création de couverture personnalisée, illustrations, promotion.",
        "Auteurs, coauteurs et ayants droit : tels que déclarés lors du dépôt.",
      ],
    },
    {
      title: "Annexe B. Cahier des charges de la Maquette",
      paragraphs: [
        "Charte graphique et logo « TechLibrairie Édition » · format, marges et polices définis par la charte · polices incorporées et sous licence · page de titre et page de copyright · métadonnées intégrées (titre, auteur, langue, ISBN) · texte extractible · images en haute résolution, libres de droits ou autorisées.",
      ],
    },
    {
      title: "Annexe C. Barème et exemple de calcul",
      paragraphs: [
        `Forfait d'édition : ${fee} par nouveau livre. Le coût de fabrication d'un exemplaire imprimé est celui du prestataire d'impression, tenu à jour et communiqué dans l'espace de l'Auteur.`,
        "Exemple fictif : prix de vente 9 000 FCFA − fabrication 4 200 FCFA = produit net de l'Auteur 4 800 FCFA ; prix plancher = coût de fabrication estimé + marge de sécurité.",
      ],
    },
    {
      title: "Annexe D. Bon à tirer",
      paragraphs: [
        "« Je soussigné(e), auteur de l'Œuvre, certifie avoir relu l'épreuve de la Maquette (version indiquée à l'écran, à la date de l'approbation) et approuve sa publication en l'état, avec ou sans les corrections listées. »",
      ],
    },
  ];

  return {
    version: CONTRACT_VERSION,
    title: "Contrat d'édition à compte d'auteur",
    subtitle:
      "Contrat de prestation d'édition, au sens de l'article L132-2 du Code de la propriété intellectuelle",
    parties: [
      `ENTRE ${publisher}${seat}${registration}, exploitant l'activité d'édition TechLibrairie Édition (ci-après « TechLibrairie Édition »),`,
      "ET l'auteur désigné lors du dépôt de l'Œuvre sur la Plateforme, dont le nom, l'adresse électronique et la signature sont ceux enregistrés à la date d'acceptation (ci-après « l'Auteur »).",
    ],
    articles,
    annexes,
  };
}

/** Texte intégral du contrat, tel qu'archivé à l'acceptation et utilisé pour calculer l'empreinte. */
export function contractToPlainText(contract: ContractDocument): string {
  const blocks = [
    `${contract.title} (version ${contract.version})`,
    contract.subtitle,
    ...contract.parties,
    ...[...contract.articles, ...contract.annexes].flatMap((article) => [
      article.title,
      ...article.paragraphs,
    ]),
  ];

  return blocks.join("\n\n");
}

export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
                                  }
