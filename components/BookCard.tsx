import Link from 'next/link';
import type { Book } from '@/lib/data';

export function BookCard({ book }: { book: Book }) {
  return (
    <article className="book-card">
      <img src={book.image} alt={book.title} />
      <div className="book-body">
        <span className="tag">{book.category}</span>
        <h3>{book.title}</h3>
        <p>{book.description}</p>
        <div className="book-meta">
          <span>{book.author}</span>
          <strong>{book.price} FCFA</strong>
        </div>
        <Link href="/checkout" className="primary-btn full-width">Acheter</Link>
      </div>
    </article>
  );
}
