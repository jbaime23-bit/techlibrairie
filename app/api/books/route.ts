import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, author, price, description, coverImage, pdfUrl } = body;

    // Validation de base des champs obligatoires
    if (!title || !author || !price || !coverImage || !pdfUrl) {
      return NextResponse.json(
        { success: false, message: 'Tous les champs obligatoires doivent être remplis.' },
        { status: 400 }
      );
    }

    // Enregistrement du livre technique dans la base de données Neon via Prisma
    const nouveauLivre = await prisma.book.create({
      data: {
        title,
        author,
        price: parseFloat(price),
        description: description || '',
        coverImage, // La chaîne textuelle de la photo de couverture
        pdfUrl,     // La chaîne textuelle du manuscrit PDF
        isPublished: true
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Livre publié avec succès sur TechLibrairie !',
      book: nouveauLivre
    });

  } catch (error: any) {
    console.error("Erreur Prisma lors de la publication du livre :", error);
    return NextResponse.json(
      { success: false, message: 'Erreur interne du serveur lors de la création du livre.', error: error.message },
      { status: 500 }
    );
  }
}

// Route GET pour afficher les livres sur la boutique
export async function GET() {
  try {
    const livres = await prisma.book.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ success: true, books: livres });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'Impossible de récupérer le catalogue de livres.', error: error.message },
      { status: 500 }
    );
  }
}
