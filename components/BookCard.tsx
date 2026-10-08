import Link from 'next/link';

// Nous définissons directement la structure du livre ici pour éviter l'erreur d'importation
export interface Book {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  category: string;
  author: string;
  image: string;
}

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
