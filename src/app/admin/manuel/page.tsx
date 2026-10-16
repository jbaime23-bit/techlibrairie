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

export default async function AdminManuelPage() {
  await requireAdmin("/admin/manuel");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manuel d&apos;exploitation</h1>
        <p className="mt-1 text-sm text-slate-600">
          Les gestes à faire chaque jour, chaque semaine et chaque mois, et la conduite à tenir en
          cas de problème. Les pages citées se trouvent dans le menu de l&apos;administration.
        </p>
      </div>

      <Section title="Chaque jour (10 minutes)">
        <Steps>
          <li>
            <strong>Tableau de bord</strong> : commandes payées, messages à traiter, demandes de
            versement.
          </li>
          <li>
            <strong>Commandes</strong> : filtre « En attente ». Une commande en attente depuis plus d&apos;une
            heure est anormale : voir « Paiement validé mais pas de téléchargement » plus bas.
          </li>
          <li>
            <strong>Support</strong> (onglet « À traiter ») : répondez, en commençant par les plus
            anciennes.
          </li>
          <li>
            <strong>Messages de contact</strong> : répondez par email, puis marquez « Répondu ».
          </li>
          <li>
            <strong>Versements</strong> : traitez les demandes en attente (procédure plus bas).
          </li>
        </Steps>
      </Section>

      <Section title="Chaque semaine (20 minutes)">
        <Steps>
          <li>
            <Link href="/admin/sante" className="font-semibold text-brand-700 hover:underline">
              Santé du site
            </Link>{" "}
            : aucune alerte rouge. Lancez aussi les tests de connexion.
          </li>
          <li>
            <Link href="/admin/journal" className="font-semibold text-brand-700 hover:underline">
              Journal
            </Link>{" "}
            : repérez toute connexion ou action que vous ne reconnaissez pas (catégorie « Connexions
            et sécurité »).
          </li>
          <li>
            <strong>Rapprochement des paiements</strong> : comparez les ventes du tableau de bord avec
            les relevés CinetPay (et Stripe le cas échéant). Les totaux doivent correspondre.
          </li>
          <li>
            <strong>Quotas</strong> : emails Resend (100 par jour en gratuit), espace Neon, factures Vercel.
          </li>
          <li>
            <strong>Journaux Vercel</strong> (menu Logs) : cherchez les erreurs répétées.
          </li>
          <li>
            <Link href="/admin/taux" className="font-semibold text-brand-700 hover:underline">
              Taux de change
            </Link>{" "}
            : si vous acceptez la carte via Stripe en dollars, vérifiez que le taux a moins de 60 jours.
          </li>
        </Steps>
      </Section>

      <Section title="Chaque mois (30 minutes)">
        <Steps>
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
            <Link href="/admin/securite" className="font-semibold text-brand-700 hover:underline">
              Sécurité du compte
            </Link>{" "}
            : vérifiez qu&apos;il vous reste au moins 3 codes de secours, sinon régénérez-les.
          </li>
          <li>
            <Link href="/admin/maintenance" className="font-semibold text-brand-700 hover:underline">
              Maintenance
            </Link>{" "}
            : lancez une analyse à blanc pour contrôler que rien d&apos;anormal ne s&apos;accumule.
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
              Ouvrez <Link href="/admin/versements" className="font-semibold text-brand-700 hover:underline">Versements</Link>{" "}
              et cliquez sur « Prendre en charge ».
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
              Les liens de téléchargement sont désactivés et les gains du vendeur retirés. L&apos;acheteur et
              le vendeur sont prévenus par email.
            </li>
          </Steps>
        </Incident>

        <Incident title="Suspendre un ouvrage ou un vendeur (contenu illicite, plainte)">
          <Bullets>
            <li>
              Un ouvrage : <Link href="/admin/produits" className="font-semibold text-brand-700 hover:underline">Produits</Link>,
              bouton « Suspendre ». Il disparaît du catalogue et le vendeur ne peut pas le remettre en vente.
            </li>
            <li>
              Un vendeur : <Link href="/admin/vendeurs" className="font-semibold text-brand-700 hover:underline">Vendeurs</Link>,
              bouton « Suspendre » (tous ses ouvrages quittent le catalogue).
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
            <li>S&apos;il s&apos;agit de votre compte administrateur : changez le mot de passe, régénérez les codes de secours et vérifiez le Journal.</li>
          </Steps>
        </Incident>

        <Incident title="Vous avez perdu votre téléphone (double authentification)">
          <Steps>
            <li>Avec un code de secours : saisissez-le à la place du code à 6 chiffres, puis réactivez la double authentification sur votre nouveau téléphone.</li>
            <li>
              Sans code de secours : dans Vercel, ajoutez la variable RESET_2FA_EMAIL (votre email
              d&apos;administrateur), redéployez, connectez-vous avec le seul mot de passe, puis{" "}
              <strong>supprimez la variable</strong> et réactivez la double authentification.
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

        <Incident title="Les emails ne partent plus">
          <Bullets>
            <li>Page Emails : envoyez un test, le message d&apos;erreur de Resend s&apos;affiche.</li>
            <li>Quota dépassé (100 par jour en gratuit) : attendez le lendemain ou passez au plan payant. Les opérations (paiements, remboursements) continuent de fonctionner sans email.</li>
            <li>Domaine non vérifié : revérifiez les enregistrements DNS dans Resend.</li>
          </Bullets>
        </Incident>

        <Incident title="Une publicité perturbe une page ou ralentit le site">
          <p>
            Page Publicités : désactivez l&apos;emplacement concerné (effet en moins d&apos;une minute). Les
            publicités ne s&apos;affichent jamais aux administrateurs : testez en navigation privée,
            déconnecté.
          </p>
        </Incident>
      </Section>

      <Section title="Limites actuelles à connaître">
        <Bullets>
          <li>
            Il n&apos;existe <strong>qu&apos;un seul compte administrateur</strong> (celui de l&apos;initialisation) :
            l&apos;interface ne permet pas d&apos;en créer d&apos;autres.
          </li>
          <li>
            Il n&apos;existe pas de fonction de <strong>suppression d&apos;un compte</strong> sur demande : le
            compte peut être désactivé, mais son effacement complet demande une intervention directe
            sur la base de données.
          </li>
          <li>Les versements aux vendeurs et certains remboursements sont <strong>manuels</strong>.</li>
          <li>Le journal des actions ne couvre pas les actions automatiques du système.</li>
        </Bullets>
      </Section>
    </div>
  );
}
