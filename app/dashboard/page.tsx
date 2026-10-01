import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="page-shell">
      <section className="page-header">
        <div>
          <p className="kicker">Espace utilisateur</p>
          <h1>Tableau de bord</h1>
        </div>
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>Auteur</h3>
          <p>Gérez vos livres, suivez vos ventes et recevez vos gains.</p>
        </div>
        <div className="dashboard-card">
          <h3>Éditeur</h3>
          <p>Publiez, validez et supervisez les ouvrages numériques.</p>
        </div>
        <div className="dashboard-card">
          <h3>Vendeur</h3>
          <p>Proposez les produits, traitez les commandes et suivez les commissions.</p>
        </div>
        <div className="dashboard-card">
          <h3>Client</h3>
          <p>Historique d’achats, factures et accès à vos téléchargements.</p>
        </div>
      </div>

      <div className="download-box">
        <h3>Téléchargement</h3>
        <p>Chaque achat génère un lien de téléchargement sécurisé à 2 usages maximum.</p>
        <Link href="/catalogue" className="primary-btn">Découvrir les livres</Link>
      </div>
    </main>
  );
}
