import { NextResponse } from 'next/server';
import { books } from '@/lib/data';
import { consumeDownload, getDownloadByToken } from '@/lib/store';

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  const record = getDownloadByToken(params.token);

  if (!record) {
    return NextResponse.json({ success: false, message: 'Lien invalide ou expiré.' }, { status: 403 });
  }

  const book = books.find((entry) => entry.id === record.bookId) ?? {
    id: record.bookId,
    title: record.bookTitle,
    slug: record.bookSlug,
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
    maxDownloads: record.maxDownloads,
    expiresAt: record.expiresAt,
  });
}

export async function POST(
  _request: Request,
  { params }: { params: { token: string } }
) {
  const result = consumeDownload(params.token);

  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.message }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    message: 'Téléchargement validé.',
    remaining: result.remaining,
    used: result.used,
  });
}
