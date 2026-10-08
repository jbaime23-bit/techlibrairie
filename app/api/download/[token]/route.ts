import { NextResponse } from 'next/server';
import { books } from '@/lib/data';
// Liaison corrigée vers le bon fichier de votre dossier lib
import { createDownloadLink } from '@/lib/downloads';

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  // Utilisation de la fonction createDownloadLink de votre fichier downloads.ts
  const result = createDownloadLink(params.token);

  if (!result.valid || !result.payload) {
    return NextResponse.json({ success: false, message: 'Lien invalide ou expiré.' }, { status: 403 });
  }

  const record = result.payload;
  const book = books.find((entry) => entry.id === record.bookId) ?? {
    id: record.bookId,
    title: record.book.title,
    slug: record.book.slug,
    price: 0,
    category: 'PDF',
    author: 'TechLibrairie',
    image: '',
    description: 'Livre numérique sécurisé',
  };

  return NextResponse.json({
    success: true,
    message: 'Téléchargement autorisé.',
    book,
    remaining: record.remaining,
    used: record.used,
    maxDownloads: 2,
    expiresAt: null, // Géré par le décodage du token sécurisé
  });
}

export async function POST(
  _request: Request,
  { params }: { params: { token: string } }
) {
  const result = createDownloadLink(params.token);

  if (!result.valid) {
    return NextResponse.json({ success: false, message: 'Téléchargement invalide.' }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    message: 'Téléchargement validé.',
    remaining: 1,
    used: 1,
  });
}
