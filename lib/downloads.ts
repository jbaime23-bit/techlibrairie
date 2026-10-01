export function createOrderReference() {
  return `TL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function createSecureDownload({
  book,
  userId,
  orderReference,
  maxDownloads = 2,
}: {
  book: { id: string; title: string; slug: string };
  userId: string;
  orderReference: string;
  maxDownloads?: number;
}) {
  const token = Buffer.from(`${userId}:${book.id}:${orderReference}:${Date.now()}`).toString('base64url');

  return {
    token,
    book,
    userId,
    orderReference,
    maxDownloads,
    remaining: maxDownloads,
    used: 0,
  };
}

export function createDownloadLink(token: string) {
  if (!token || token.length < 20) {
    return { valid: false, payload: null };
  }

  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [userId, bookId, orderReference, createdAt] = decoded.split(':');

    if (!userId || !bookId || !orderReference || !createdAt) {
      return { valid: false, payload: null };
    }

    return {
      valid: true,
      payload: {
        userId,
        bookId,
        orderReference,
        book: { id: bookId, title: 'Livre sécurisé', slug: 'livre-securise' },
        remaining: 2,
        used: 0,
      },
    };
  } catch {
    return { valid: false, payload: null };
  }
}
