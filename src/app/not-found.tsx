// src/app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-16">
      <div className="card mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold">Page introuvable</h1>
        <p className="mt-2 text-sm text-slate-600">
          La page ou l&apos;ouvrage que vous cherchez n&apos;existe pas ou n&apos;est
          plus disponible.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="btn-secondary">
            Accueil
          </Link>
          <Link href="/catalogue" className="btn-primary">
            Voir le catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}
