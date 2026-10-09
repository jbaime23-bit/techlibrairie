import { prisma } from '../../../lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, author, price, description } = body;

    if (!title || !author || !price) {
      return Response.json(
        { success: false, message: 'Le titre, l\'auteur et le prix sont obligatoires.' },
        { status: 400 }
      );
    }

    const newBook = await prisma.book.create({
      data: {
        title,
        author,
        price: parseFloat(price),
        description: description || '',
      },
    });

    return Response.json({
      success: true,
      book: newBook,
      message: 'Votre ouvrage technique a été publié avec succès !',
    });
  } catch (error) {
    console.error('Erreur API Books:', error);
    return Response.json(
      { success: false, message: 'Erreur serveur lors de la publication de l\'ouvrage.' },
      { status: 500 }
    );
  }
}
  
