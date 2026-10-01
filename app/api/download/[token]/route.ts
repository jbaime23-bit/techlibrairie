import { notFound } from 'next/navigation';
import { createDownloadLink } from '@/lib/downloads';

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  const { valid, payload } = createDownloadLink(params.token);

  if (!valid || !payload) {
    return Response.json({ success: false, message: 'Lien invalide ou expiré.' }, { status: 403 });
  }

  return Response.json({
    success: true,
    message: 'Téléchargement autorisé.',
    book: payload.book,
    remaining: payload.remaining,
    used: payload.used,
  });
}

export async function POST(
  _request: Request,
  { params }: { params: { token: string } }
) {
  const { valid, payload } = createDownloadLink(params.token);

  if (!valid || !payload) {
    return Response.json({ success: false, message: 'Lien invalide ou expiré.' }, { status: 403 });
  }

  if (payload.remaining <= 0) {
    return Response.json({ success: false, message: 'Ce téléchargement a déjà été utilisé deux fois.' }, { status: 403 });
  }

  return Response.json({
    success: true,
    downloadUrl: `/api/files/${payload.book.slug}.pdf`,
    remaining: payload.remaining - 1,
  });
}
