import Link from 'next/link';
import { BookCard } from '@/components/BookCard';
import { books } from '@/lib/data';

export default function CataloguePage() {
  return (
    <main className="page-shell">
      <section className="page-header">
        <div>
          <p className="kicker">Catalogue</p>
          <h1>Tous nos livres PDF</h1>
        </div>
        <Link href="/checkout" className="primary-btn">Valider la commande</Link>
      </section>

      <div className="card-grid">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </main>
  );
}
