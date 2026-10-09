import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    // Cette commande pousse silencieusement vos tables d'auteurs et de livres directement vers Neon
    const { stdout, stderr } = await execAsync('npx prisma db push --accept-data-loss');
    
    return Response.json({
      success: true,
      message: 'Base de données Neon synchronisée avec succès pour TechLibrairie !',
      log: stdout || stderr
    });
  } catch (error: any) {
    return Response.json({
      success: false,
      message: 'Erreur lors de la synchronisation.',
      error: error.message
    }, { status: 500 });
  }
}
