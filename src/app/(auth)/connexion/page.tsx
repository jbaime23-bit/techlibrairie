// src/app/(auth)/connexion/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/validations";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Connexion",
};

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string | string[] };
}) {
  const callbackUrl = safeCallbackUrl(searchParams.callbackUrl);
  const user = await getCurrentUser();

  if (user) {
    redirect(callbackUrl);
  }

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-md">
        <div className="card">
          <h1 className="text-2xl font-bold">Connexion</h1>
          <p className="mt-1 text-sm text-slate-600">
            Accédez à votre espace TechLibrairie.
          </p>

          <div className="mt-6">
            <LoginForm callbackUrl={callbackUrl} />
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            Pas encore de compte ?{" "}
            <Link
              href="/inscription"
              className="font-semibold text-brand-700 hover:underline"
            >
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
