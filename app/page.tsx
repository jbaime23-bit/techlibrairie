import Link from 'next/link';
import { BookCard } from '@/components/BookCard';
// Connexion sécurisée avec le fichier prisma de votre dossier lib
import { prisma } from '../lib/prisma';

// Force Next.js à vérifier la base de données Neon en direct à chaque visite (pas de cache bloqué)
export const dynamic = 'force-dynamic';

// Fonction pour récupérer les vrais livres de la base de données
async function getBooks() {
  try {
    const books = await prisma.book.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    return books;
  } catch (error) {
    console.error("Erreur lors de la récupération des livres :", error);
    return [];
  }
}

export default async function HomePage() {
  const books = await getBooks();

  return (
    <main>
      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow">TechLibrairie</div>
          <h1>Savoir & Technologie au Burkina Faso</h1>
          <p>
            Découvrez des livres PDF en innovation, technologie, entrepreneuriat, développement
            numérique et culture du savoir.
          </p>
          <div className="hero-actions">
            <Link href="/catalogue" className="primary-btn">
              Voir le catalogue
            </Link>
            <Link href="/login" className="secondary-btn">
              Mon espace
            </Link>
          </div>
        </div>
      </section>

      <section className="popular-books" style={{ padding: '60px 20px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <h2>Livres populaires</h2>
          <Link href="/catalogue" style={{ color: '#0087db', fontWeight: 'bold' }}>Tout voir</Link>
        </div>

        {books.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666', border: '1px dashed #ccc', borderRadius: '8px' }}>
            <p style={{ fontSize: '18px', marginBottom: '10px' }}>Aucun livre n'est disponible pour le moment.</p>
            <p style={{ fontSize: '14px' }}>Inscrivez-vous comme vendeur pour ajouter le tout premier livre !</p>
          </div>
        ) : (
          <div className="books-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' }}>
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
