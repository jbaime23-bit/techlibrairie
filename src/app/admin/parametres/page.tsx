// src/app/admin/parametres/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import {
  SettingsForm,
  type SettingsFormValues,
} from "@/components/admin/settings-form";

export const metadata: Metadata = {
  title: "Paramètres",
};

export const dynamic = "force-dynamic";

export default async function AdminParametresPage() {
  await requireAdmin("/admin/parametres");

  const settings = await prisma.platformSetting.findUnique({
    where: { id: "global" },
  });

  const initialValues: SettingsFormValues = {
    commissionPercent: String((settings?.defaultCommissionRateBps ?? 1000) / 100),
    fxMarginPercent: String((settings?.fxMarginBps ?? 200) / 100),
    minPayoutAmountXof: String(settings?.minPayoutAmountXof ?? 5000),
    supportFeeXof: String(settings?.supportFeeXof ?? 1000),
    downloadLinkTtlHours: String(settings?.downloadLinkTtlHours ?? 72),
    downloadMaxAttempts: String(settings?.downloadMaxAttempts ?? 5),
    contactEmail: settings?.contactEmail ?? "",
    whatsappNumber: settings?.whatsappNumber ?? "",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Paramètres de la plateforme</h1>

      <div className="card">
        <SettingsForm initialValues={initialValues} />
      </div>
    </div>
  );
}
