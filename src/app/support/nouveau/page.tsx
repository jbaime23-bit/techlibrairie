// src/app/support/nouveau/page.tsx
import type { Metadata } from "next";
import { NewThreadForm } from "@/components/support/new-thread-form";
import {
  CATEGORY_LABELS,
  SUPPORT_CATEGORY_VALUES,
  getSupportFeeXof,
  requireSupportUser,
} from "@/lib/support";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Nouvelle conversation",
};

export const dynamic = "force-dynamic";

export default async function NouvelleConversationPage() {
  await requireSupportUser("/support/nouveau");

  const fee = await getSupportFeeXof();

  const categories = SUPPORT_CATEGORY_VALUES.map((value) => ({
    value,
    label: CATEGORY_LABELS[value],
  }));

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-2xl">
        <div className="card">
          <h1 className="text-2xl font-bold">Contacter le support</h1>
          <p className="mt-1 text-sm text-slate-600">
            Décrivez votre demande : l&apos;équipe vous répond directement dans la
            conversation.
          </p>

          <div className="mt-6">
            <NewThreadForm
              categories={categories}
              feeLabel={formatPrice(fee, "XOF")}
              isFree={fee === 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
