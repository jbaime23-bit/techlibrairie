import Link from 'next/link';
import { books } from '@/lib/data';

export default function CheckoutPage() {
  const subtotal = books.slice(0, 2).reduce((sum, book) => sum + book.price, 0);

  return (
    <main className="page-shell checkout-layout">
      <div className="checkout-panel">
        <p className="kicker">Paiement</p>
        <h1>Finaliser votre commande</h1>

        <div className="payment-box">
          <h3>Modes de paiement disponibles</h3>
          <ul>
            <li>Orange Money : 76166974</li>
            <li>Moov Money : 70011017</li>
            <li>Virement bancaire international</li>
          </ul>
        </div>

        <div className="payment-methods">
          <div className="method-card selected">Orange Money</div>
          <div className="method-card">Moov Money</div>
          <div className="method-card">Virement bancaire</div>
        </div>

        <div className="checkout-actions">
          <Link href="/catalogue" className="secondary-btn">Retour</Link>
          <Link href="/dashboard" className="primary-btn">Confirmer le paiement</Link>
        </div>
      </div>

      <aside className="summary-panel">
        <h3>Résumé</h3>
        {books.slice(0, 2).map((book) => (
          <div className="summary-row" key={book.id}>
            <span>{book.title}</span>
            <strong>{book.price} FCFA</strong>
          </div>
        ))}
        <div className="summary-total">
          <span>Total</span>
          <strong>{subtotal} FCFA</strong>
        </div>
      </aside>
    </main>
  );
}
