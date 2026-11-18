// src/app/admin/assemblage/page.tsx
// Module d'assemblage éditeur : page d'administration privée (administrateur connecté).
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { AssemblyStudio } from "@/components/admin/assembly/assembly-studio";

export const metadata: Metadata = {
  title: "Assemblage éditeur",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AssemblagePage() {
  await requireAdmin("/admin/assemblage");

  return <AssemblyStudio />;
}
