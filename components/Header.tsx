import Link from 'next/link';

export function Header() {
  return (
    <header className="topbar">
      <div className="container nav">
        <Link href="/" className="brand">TechLibrairie</Link>
        <nav className="nav-links">
          <Link href="/">Accueil</Link>
          <Link href="/catalogue">Catalogue</Link>
          <Link href="/checkout">Paiement</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
        <Link href="/checkout" className="primary-btn small-btn">Commander</Link>
      </div>
    </header>
  );
}
