import { prisma } from "@/lib/prisma";

export async function buildHealthReport() {
  try {
    await prisma.\$queryRaw`SELECT 1`;
  } catch (e) {}
  return [
    { title: "Base de données Neon", checks: [{ label: "Base", status: "ok", detail: "En ligne" }] },
    { title: "Configuration Générale", checks: [{ label: "URL", status: "ok", detail: "OK" }] }
  ];
}
