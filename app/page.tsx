import Link from 'next/link';
import { BookCard } from '@/components/BookCard';
import { books } from '@/lib/data';

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow">TechLibrairie</div>
          <h1>Savoir & Technologie au Burkina Faso</h1>
          <p>
            Découvrez des livres PDF en innovation, technologie, entrepreneuriat,
            développement numérique et culture du savoir.
          </p>
          <div className="hero-actions">
            <Link href="/catalogue" className="primary-btn">Voir le catalogue</Link>
            <Link href="/dashboard" className="secondary-btn">Mon espace</Link>
          </div>
          <div className="hero-stats">
            <div>
              <strong>500+</strong>
              <span>ouvrages</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>accès digital</span>
            </div>
            <div>
              <strong>2</strong>
              <span>téléchargements max</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <p className="kicker">Nos best sellers</p>
            <h2>Livres populaires</h2>
          </div>
          <Link href="/catalogue" className="link-btn">Tout voir</Link>
        </div>
        <div className="card-grid">
          {books.slice(0, 3).map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </section>

      <section className="section muted-section">
        <div className="section-header">
          <div>
            <p className="kicker">Pourquoi nous</p>
            <h2>Une boutique pensée pour la confiance</h2>
          </div>
        </div>
        <div className="feature-grid">
          <div className="feature-card">
            <h3>Paiement sécurisé</h3>
            <p>Orange Money, Moov Money, virement bancaire pour les achats internationaux.</p>
          </div>
          <div className="feature-card">
            <h3>Téléchargement protégé</h3>
            <p>Chaque achat génère un accès limité à 2 téléchargements maximum.</p>
          </div>
          <div className="feature-card">
            <h3>Étapes claires</h3>
            <p>Un parcours de paiement simple et transparent pour chaque client.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
