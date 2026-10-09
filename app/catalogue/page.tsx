import Link from 'next/link';
import { BookCard } from '@/components/BookCard';
import { prisma } from '../../lib/prisma';

// Force le catalogue à récupérer les nouveaux livres en temps réel
export const dynamic = 'force-dynamic';

async function getCatalogueBooks() {
  try {
    const books = await prisma.book.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    return books;
  } catch (error) {
    console.error("Erreur catalogue :", error);
    return [];
  }
}

export default async function CataloguePage() {
  const books = await getCatalogueBooks();

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        
        {/* En-tête épuré de la boutique */}
        <header style={{ marginBottom: '40px', borderBottom: '2px solid #e2e8f0', pb: '20px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#0f172a' }}>Boutique TechLibrairie</h1>
          <p style={{ color: '#64748b', marginTop: '5px' }}>Explorez l'ensemble de nos manuels techniques et guides numériques officiels.</p>
        </header>

        {/* Grille des ouvrages réels */}
        {books.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: '18px', color: '#475569', fontWeight: '500' }}>Aucun ouvrage n'est disponible dans le catalogue pour le moment.</p>
            <Link href="/dashboard" style={{ display: 'inline-block', marginTop: '15px', color: '#0087db', fontWeight: 'bold', textDecoration: 'none' }}>
              Aller sur le Dashboard pour publier le premier e-book →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' }}>
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
