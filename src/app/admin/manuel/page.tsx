// src/app/admin/manuel/page.tsx
// Manuel d'exploitation de la boutique, consultable depuis l'administration.
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Manuel d'exploitation",
};

export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">{children}</div>
    </section>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal space-y-1 pl-5">{children}</ol>;
}

function Bullets({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
}

function Incident({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-brand-700 hover:underline">
      {children}
    </Link>
  );
}

export default async function AdminManuelPage() {
  await requireAdmin("/admin/manuel");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manuel d&apos;exploitation</h1>
        <p className="mt-1 text-sm text-slate-600">
          Les gestes à faire chaque jour, chaque semaine et chaque mois, les procédures courantes et
          la conduite à tenir en cas de problème. Les pages citées se trouvent dans le menu de
          l&apos;administration.
        </p>
      </div>

      <Section title="Ce qui tourne tout seul">
        <Bullets>
          <li>
            <strong>Chaque nuit (3 h UTC)</strong> : la maintenance annule les commandes abandonnées
            (après revérification du paiement) et supprime les données périmées.
          </li>
          <li>
            <strong>Chaque jour (16 h UTC)</strong> : rappel unique des commandes non terminées,
            envoi du rapport mensuel (une fois par mois, en début de mois) et envoi de l&apos;email
            d&apos;alertes (seulement s&apos;il y a quelque chose à traiter).
          </li>
          <li>
            Leur bon fonctionnement se contrôle sur la page <A href="/admin/sante">Santé du site</A>,
            section « Tâches planifiées et alertes ».
          </li>
        </Bullets>
      </Section>

      <Section title="Chaque jour (10 minutes)">
        <Steps>
          <li>
            <strong>Tableau de bord</strong> et <A href="/admin/alertes">Alertes</A> : rien ne doit
            traîner (versements, support, messages).
          </li>
          <li>
            <strong>Commandes</strong> : filtre « En attente ». Une commande en attente depuis plus
            d&apos;une heure est anormale : voir « Paiement validé mais pas de téléchargement » plus bas.
          </li>
          <li>
            <strong>Support</strong> (onglet « À traiter ») : répondez, en commençant par les plus
            anciennes.
          </li>
          <li>
            <strong>Messages de contact</strong> : répondez par email, puis marquez « Répondu ». Repérez
            les demandes de suppression de compte (voir « Effacer un compte sur demande »).
          </li>
          <li>
            <strong>Versements</strong> : traitez les demandes en attente (procédure plus bas).
          </li>
          <li>
            <A href="/admin/avis">Avis</A> : parcourez les nouveaux avis et masquez ceux qui sont
            injurieux ou trompeurs.
          </li>
        </Steps>
      </Section>

      <Section title="Chaque semaine (20 minutes)">
        <Steps>
          <li>
            <A href="/admin/sante">Santé du site</A> : aucune alerte rouge. Lancez aussi les tests de
            connexion.
          </li>
          <li>
            <A href="/admin/journal">Journal</A> : repérez toute connexion ou action que vous ne
            reconnaissez pas (catégorie « Connexions et sécurité »).
          </li>
          <li>
            <strong>Rapprochement des paiements</strong> : comparez les ventes du tableau de bord avec
            les relevés CinetPay (et Stripe le cas échéant). Les totaux doivent correspondre.
          </li>
          <li>
            <strong>Quotas</strong> : emails Resend (100 par jour en gratuit, non surveillés par le
            site), espace Neon, factures Vercel.
          </li>
          <li>
            <strong>Journaux Vercel</strong> (menu Logs) : cherchez les erreurs répétées.
          </li>
          <li>
            <A href="/admin/promotions">Promotions</A> : désactivez les codes périmés ou qui ne servent
            plus.
          </li>
          <li>
            <A href="/admin/taux">Taux de change</A> : si vous acceptez la carte via Stripe en dollars,
            vérifiez que le taux a moins de 60 jours.
          </li>
        </Steps>
      </Section>

      <Section title="Chaque mois (30 minutes)">
        <Steps>
          <li>
            <A href="/admin/rapports">Rapport mensuel</A> : vous le recevez par email en début de mois.
            Lisez-le, puis téléchargez l&apos;<A href="/admin/export">export comptable</A> du mois écoulé
            pour votre comptable (colonne « Prix payé » = argent réellement encaissé).
          </li>
          <li>
            <strong>Abonnements</strong> : Vercel Pro, Neon, nom de domaine, Resend. Vérifiez que la
            carte de paiement (par exemple votre carte virtuelle) est alimentée : un abonnement
            impayé peut couper le site.
          </li>
          <li>
            <strong>Sécurité du logiciel</strong> : consultez les annonces de sécurité de Next.js
            (nextjs.org/blog). Si une version corrigée est publiée, un redéploiement récupère les
            mises à jour (versions « ^ » du fichier package.json).
          </li>
          <li>
            <A href="/admin/securite">Sécurité du compte</A> : vérifiez qu&apos;il vous reste au moins 3
            codes de secours, sinon régénérez-les.
          </li>
          <li>
            <A href="/admin/administrateurs">Administrateurs</A> : la liste ne doit contenir que des
            personnes qui en ont encore besoin, toutes avec la double authentification activée.
          </li>
          <li>
            <A href="/admin/maintenance">Maintenance</A> : lancez une analyse à blanc pour contrôler que
            rien d&apos;anormal ne s&apos;accumule.
          </li>
          <li>
            <strong>Sauvegarde</strong> : vérifiez dans Neon la durée de restauration disponible et la
            procédure à suivre.
          </li>
          <li>
            <strong>Pages légales</strong> : relisez-les si votre activité ou vos moyens de paiement ont
            changé.
          </li>
        </Steps>
      </Section>

      <Section title="Procédures courantes">
        <Incident title="Traiter une demande de versement vendeur">
          <Steps>
            <li>
              Ouvrez <A href="/admin/versements">Versements</A> et cliquez sur « Prendre en charge ».
            </li>
            <li>
              Dans votre application Orange Money ou Moov Money, envoyez le montant exact au numéro
              indiqué dans la demande (celui-ci est figé au moment de la demande).
            </li>
            <li>
              Revenez saisir la <strong>référence de la transaction</strong>, puis « Marquer comme payé ».
              Le vendeur est prévenu par email.
            </li>
            <li>Pour refuser : indiquez un motif. Le montant redevient disponible pour le vendeur.</li>
          </Steps>
        </Incident>

        <Incident title="Rembourser une commande">
          <Steps>
            <li>
              Ouvrez la fiche de la commande (Commandes, puis son numéro). Lisez l&apos;alerte éventuelle
              concernant un vendeur déjà payé.
            </li>
            <li>
              Carte Stripe : le remboursement est automatique. Mobile Money ou carte CinetPay :
              effectuez-le d&apos;abord de votre côté, puis saisissez sa référence.
            </li>
            <li>
              Le remboursement porte sur le montant <strong>réellement payé</strong> : si un code
              promotionnel a été utilisé, c&apos;est le prix après remise. Les liens de téléchargement sont
              désactivés et les gains du vendeur retirés. L&apos;acheteur et le vendeur sont prévenus par
              email.
            </li>
          </Steps>
        </Incident>

        <Incident title="Créer un code promotionnel">
          <Steps>
            <li>
              Ouvrez <A href="/admin/promotions">Promotions</A>, « Créer un code » : le code (lettres,
              chiffres, tirets), le type (pourcentage ou montant en FCFA), les limites (montant minimum,
              dates, nombre d&apos;utilisations).
            </li>
            <li>
              Choisissez <strong>qui supporte la remise</strong> : « Partagée » (la commission est
              calculée sur le prix remisé : le vendeur gagne un peu moins) ou « Boutique seule » (le
              vendeur garde son gain normal ; la remise est alors plafonnée à votre commission).
            </li>
            <li>
              Testez-le avec un achat de test avant de le communiquer. Un code déjà utilisé ne se
              supprime plus : désactivez-le.
            </li>
          </Steps>
        </Incident>

        <Incident title="Modérer un avis">
          <Bullets>
            <li>
              <A href="/admin/avis">Avis</A> : « Masquer » retire l&apos;avis de la page publique (son
              auteur ne peut plus le modifier) et recalcule la note ; « Supprimer » est définitif.
            </li>
            <li>Les avis sont publiés immédiatement : la modération se fait après coup.</li>
          </Bullets>
        </Incident>

        <Incident title="Suspendre un ouvrage ou un vendeur (contenu illicite, plainte)">
          <Bullets>
            <li>
              Un ouvrage : <A href="/admin/produits">Produits</A>, bouton « Suspendre ». Il disparaît du
              catalogue et le vendeur ne peut pas le remettre en vente.
            </li>
            <li>
              Un vendeur : <A href="/admin/vendeurs">Vendeurs</A>, bouton « Suspendre » (tous ses
              ouvrages quittent le catalogue).
            </li>
            <li>Un compte entier : Utilisateurs, bouton « Désactiver » (sa session est coupée).</li>
            <li>Conservez la plainte reçue et notez la décision prise.</li>
          </Bullets>
        </Incident>

        <Incident title="Modifier un prix, une commission ou un taux">
          <Bullets>
            <li>Commission d&apos;un vendeur : page Vendeurs (champ vide = taux par défaut). Elle ne s&apos;applique qu&apos;aux ventes futures.</li>
            <li>Commission par défaut, tarif du support, durée des liens : page Paramètres.</li>
            <li>Taux de change : page Taux de change.</li>
            <li>Toutes ces modifications apparaissent dans le Journal.</li>
          </Bullets>
        </Incident>

        <Incident title="Ajouter une bannière pour un annonceur local">
          <p>
            Page Publicités, « Ajouter une publicité », type « Bannière locale » : image (2 Mo maximum),
            lien, dates éventuelles et prix convenu. Elle est visible au plus tard une minute après
            l&apos;enregistrement. Les statistiques de vues et de clics s&apos;affichent dans la liste.
          </p>
        </Incident>

        <Incident title="Préparer les chiffres pour le comptable">
          <Steps>
            <li>
              Ouvrez <A href="/admin/export">Export comptable</A>, choisissez le mois et le rapport « Ventes
              et commissions » (puis « Remboursements », « Versements » et « Support payant »).
            </li>
            <li>
              Dans Excel, additionnez la colonne <strong>« Prix payé »</strong> après avoir filtré les
              lignes « Remboursée » (ou déduisez le rapport des remboursements).
            </li>
            <li>
              Pour une vue d&apos;ensemble, le <A href="/admin/rapports">rapport mensuel</A> résume le mois ;
              il ne remplace pas l&apos;export.
            </li>
          </Steps>
        </Incident>

        <Incident title="Ajouter ou retirer un administrateur">
          <Steps>
            <li>
              Ouvrez <A href="/admin/administrateurs">Administrateurs</A>.
            </li>
            <li>
              Pour <strong>nommer</strong> : la personne doit déjà avoir un compte, actif, avec
              l&apos;adresse email vérifiée. Saisissez son email, votre mot de passe et votre code à 6 chiffres.
            </li>
            <li>
              Elle doit se déconnecter puis se reconnecter, puis activer la double authentification
              (obligatoire) avant d&apos;accéder à l&apos;administration.
            </li>
            <li>
              Pour <strong>retirer</strong> : le compte redevient vendeur ou acheteur, sa double
              authentification est effacée et ses sessions sont coupées. Vous ne pouvez pas retirer le
              dernier administrateur, ni vous-même.
            </li>
          </Steps>
        </Incident>

        <Incident title="Effacer un compte sur demande">
          <Steps>
            <li>
              Vérifiez l&apos;identité du demandeur (réponse depuis l&apos;adresse du compte, ou demandez-lui de
              le faire lui-même depuis Mon profil, Supprimer mon compte).
            </li>
            <li>
              Pour un vendeur : réglez d&apos;abord ses versements (Versements). L&apos;effacement est refusé
              s&apos;il reste de l&apos;argent à lui verser ou un versement en cours.
            </li>
            <li>
              Ouvrez <A href="/admin/effacement">Effacement d&apos;un compte</A>, saisissez l&apos;email, votre
              mot de passe et votre code, puis le mot EFFACER.
            </li>
            <li>
              Les données personnelles sont effacées (avis et favoris compris) ; les commandes sont
              conservées sans lien avec une adresse email. L&apos;opération est irréversible et figure
              dans le Journal. Répondez à la personne pour confirmer.
            </li>
          </Steps>
        </Incident>
      </Section>

      <Section title="En cas d'incident">
        <Incident title="Le site est inaccessible ou affiche une erreur partout">
          <Steps>
            <li>Ouvrez Vercel, projet TechLibrairie, onglet Deployments : le dernier déploiement est-il en échec ?</li>
            <li>
              Si un déploiement récent a cassé le site : dans Deployments, ouvrez le <strong>dernier
              déploiement réussi</strong> et choisissez de le remettre en production (« Promote » ou
              « Redeploy »). Le site revient à l&apos;état précédent immédiatement.
            </li>
            <li>Consultez l&apos;état de Vercel et de Neon (leurs pages de statut) : la panne peut venir d&apos;eux.</li>
            <li>Si la base est suspendue ou son quota atteint, passez au plan payant de Neon.</li>
          </Steps>
        </Incident>

        <Incident title="Le site s'affiche sans design (texte brut)">
          <Bullets>
            <li>
              Vérifiez que les fichiers <code>postcss.config.mjs</code> et <code>tailwind.config.ts</code>{" "}
              sont à la racine du dépôt GitHub, et <code>globals.css</code> dans <code>src/app/</code>.
            </li>
            <li>Rechargez le site en navigation privée : l&apos;ancien CSS peut rester en mémoire.</li>
            <li>Consultez les Build Logs du dernier déploiement dans Vercel.</li>
          </Bullets>
        </Incident>

        <Incident title="Paiement validé mais l'acheteur n'a pas son téléchargement">
          <Steps>
            <li>Trouvez la commande (Commandes, recherche par email ou numéro) et regardez son statut.</li>
            <li>
              « En attente » : demandez à l&apos;acheteur d&apos;ouvrir Mon espace puis « Vérifier le paiement » :
              le site interroge CinetPay ou Stripe et valide la commande s&apos;il a bien été payé. La
              maintenance quotidienne fait aussi cette vérification.
            </li>
            <li>
              Toujours en attente alors que le prestataire montre le paiement : vérifiez que
              NEXT_PUBLIC_APP_URL est correct et que le webhook Stripe est bien déclaré (page Santé).
            </li>
            <li>
              Si l&apos;acheteur n&apos;a pas reçu l&apos;email, il retrouve ses liens dans Mon espace, Mes
              commandes, et peut générer un nouveau lien.
            </li>
          </Steps>
        </Incident>

        <Incident title="Un client dit que son code promotionnel est refusé">
          <Steps>
            <li>
              Ouvrez <A href="/admin/promotions">Promotions</A> et retrouvez le code : est-il actif, dans ses
              dates, sous sa limite d&apos;utilisations ?
            </li>
            <li>
              Causes fréquentes : montant minimum d&apos;achat non atteint, code déjà utilisé par ce
              compte (1 fois par acheteur par défaut), ouvrages en euros ou en dollars (les codes ne
              s&apos;appliquent qu&apos;au FCFA), ou règle « Boutique seule » dont la remise est plafonnée à la
              commission du panier.
            </li>
            <li>
              Trop d&apos;essais de codes inexistants bloquent la saisie 15 minutes depuis la même
              connexion internet.
            </li>
          </Steps>
        </Incident>

        <Incident title="Un acheteur signale un PDF corrompu ou non conforme">
          <Bullets>
            <li>Vérifiez le fichier en le téléchargeant vous-même depuis votre propre achat de test ou en demandant au vendeur de le renvoyer.</li>
            <li>Le vendeur peut remplacer le PDF depuis Modifier : les acheteurs précédents reçoivent la nouvelle version à leur prochain téléchargement.</li>
            <li>Si le problème est avéré et non réglé, remboursez la commande.</li>
          </Bullets>
        </Incident>

        <Incident title="Un compte est piraté ou suspect">
          <Steps>
            <li>Page Utilisateurs : désactivez le compte (sa session est coupée immédiatement).</li>
            <li>Consultez le Journal si c&apos;est un administrateur, et le support si c&apos;est un client.</li>
            <li>
              Demandez à la personne de réinitialiser son mot de passe depuis « Mot de passe oublié »,
              puis réactivez le compte.
            </li>
            <li>
              S&apos;il s&apos;agit d&apos;un autre administrateur : demandez à un administrateur de confiance de lui
              retirer le rôle (page Administrateurs). S&apos;il s&apos;agit de votre compte : changez le mot de
              passe, régénérez les codes de secours et vérifiez le Journal.
            </li>
          </Steps>
        </Incident>

        <Incident title="Vous avez perdu votre téléphone (double authentification)">
          <Steps>
            <li>Avec un code de secours : saisissez-le à la place du code à 6 chiffres, puis réactivez la double authentification sur votre nouveau téléphone.</li>
            <li>
              Sans code de secours : dans Vercel, ajoutez la variable RESET_2FA_EMAIL (votre email
              d&apos;administrateur), redéployez, connectez-vous avec le seul mot de passe, puis{" "}
              <strong>supprimez la variable</strong> et réactivez la double authentification. La page
              Santé vous signale cette variable tant qu&apos;elle existe.
            </li>
          </Steps>
        </Incident>

        <Incident title="Une clé secrète a été divulguée (capture d'écran, dépôt public...)">
          <Steps>
            <li>Régénérez immédiatement la clé concernée chez son fournisseur (Stripe, CinetPay, Resend, jetons Vercel Blob).</li>
            <li>Remplacez-la dans Vercel (Environment Variables) et redéployez.</li>
            <li>
              Pour NEXTAUTH_SECRET : le changer déconnecte tout le monde et rend la clé de double
              authentification illisible (il faudra un code de secours ou RESET_2FA_EMAIL). À faire
              seulement si ce secret a fuité.
            </li>
            <li>Ne copiez jamais de clé dans GitHub ni dans une conversation : seulement dans Vercel.</li>
          </Steps>
        </Incident>

        <Incident title="Les emails ne partent plus (ou vous ne recevez ni rapport ni alertes)">
          <Bullets>
            <li>Page Emails : envoyez un test, le message d&apos;erreur de Resend s&apos;affiche.</li>
            <li>Quota dépassé (100 par jour en gratuit) : attendez le lendemain ou passez au plan payant. Les opérations (paiements, remboursements) continuent de fonctionner sans email.</li>
            <li>Domaine non vérifié : revérifiez les enregistrements DNS dans Resend.</li>
            <li>
              Le rapport mensuel et les alertes sont envoyés par la tâche de 16 h : si elle ne tourne
              pas, rien ne part (voir l&apos;incident suivant). Vous pouvez recevoir les deux à la demande
              depuis <A href="/admin/rapports">Rapports mensuels</A> et <A href="/admin/alertes">Alertes</A>.
            </li>
          </Bullets>
        </Incident>

        <Incident title="Les tâches planifiées ne semblent pas tourner">
          <Steps>
            <li>
              Ouvrez la page <A href="/admin/sante">Santé du site</A>, section « Tâches planifiées et
              alertes » : la dernière exécution de chaque tâche doit dater de moins de 36 heures.
            </li>
            <li>
              Dans Vercel, Settings, Cron Jobs : les deux tâches (3 h et 16 h) doivent être listées. Si
              elles ne le sont pas, vérifiez que le fichier <code>vercel.json</code> est à la racine du
              dépôt et redéployez.
            </li>
            <li>
              Vérifiez que la variable <code>CRON_SECRET</code> existe dans Vercel (16 caractères au
              minimum), puis consultez les journaux (Logs) de la tâche.
            </li>
          </Steps>
        </Incident>

        <Incident title="La base de données est presque pleine">
          <Steps>
            <li>
              Vous recevez une alerte (page <A href="/admin/alertes">Alertes</A>) à 80 % puis à 95 % de la
              limite supposée du plan gratuit (512 Mo).
            </li>
            <li>
              Passez à un plan supérieur chez Neon, puis définissez la variable{" "}
              <code>DB_STORAGE_LIMIT_MB</code> dans Vercel pour que les pourcentages restent justes.
            </li>
            <li>
              Lancez une analyse à blanc dans <A href="/admin/maintenance">Maintenance</A> pour voir ce
              qui peut être nettoyé.
            </li>
          </Steps>
        </Incident>

        <Incident title="Une publicité perturbe une page ou ralentit le site">
          <p>
            Page Publicités : désactivez l&apos;emplacement concerné (effet en moins d&apos;une minute). Les
            publicités ne s&apos;affichent jamais aux administrateurs : testez en navigation privée,
            déconnecté.
          </p>
        </Incident>
      </Section>

      <Section title="Variables d'environnement utiles à connaître">
        <Bullets>
          <li>
            <code>CRON_SECRET</code> : indispensable aux tâches planifiées (maintenance, rappels, rapport
            mensuel, alertes).
          </li>
          <li>
            <code>CINETPAY_CARD_ENABLED=true</code> : active le paiement par carte via CinetPay.
          </li>
          <li>
            <code>DB_STORAGE_LIMIT_MB</code> : espace de votre plan Neon, pour des alertes d&apos;espace justes.
          </li>
          <li>
            <code>RESET_2FA_EMAIL</code> et <code>ADMIN_2FA_REQUIRED=false</code> : procédures de secours à
            retirer dès que possible.
          </li>
        </Bullets>
      </Section>

      <Section title="Limites actuelles à connaître">
        <Bullets>
          <li>
            Pour nommer un administrateur, l&apos;adresse email du compte doit être <strong>vérifiée</strong> :
            cela suppose que l&apos;envoi d&apos;emails fonctionne.
          </li>
          <li>
            L&apos;effacement d&apos;un compte <strong>anonymise</strong> les données mais conserve les commandes
            (numéros, montants, dates). Les sauvegardes Neon peuvent contenir d&apos;anciennes données
            jusqu&apos;à leur expiration. La durée de conservation légale des pièces comptables est à
            confirmer avec votre comptable.
          </li>
          <li>Les versements aux vendeurs et certains remboursements sont <strong>manuels</strong>.</li>
          <li>
            Les alertes et le rapport mensuel arrivent au rythme de la tâche de 16 h : une urgence
            survenue juste après n&apos;est signalée que le lendemain. Le quota d&apos;emails de Resend et les
            paiements bloqués chez les prestataires ne sont pas surveillés par les alertes.
          </li>
          <li>
            Le journal ne couvre pas les actions des acheteurs et des vendeurs, ni le détail des
            actions automatiques du système (il note seulement leur passage).
          </li>
        </Bullets>
      </Section>
    </div>
  );
}
