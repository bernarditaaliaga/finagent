import { prisma } from "@/lib/db";
import { BancoClient } from "@/components/banco-client";

export default async function BancoPage() {
  const bankLink = await prisma.bankLink.findFirst({
    orderBy: { createdAt: "desc" },
  });

  const linkData = bankLink
    ? {
        id: bankLink.id,
        bankName: bankLink.bankName,
        holderName: bankLink.holderName,
        lastSync: bankLink.lastSync?.toISOString() ?? null,
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Conexion Bancaria</h1>
        <p className="text-slate-500">Conecta tu banco via Fintoc para importar transacciones</p>
      </div>

      <BancoClient
        bankLink={linkData}
        fintocPublicKey={process.env.FINTOC_PUBLIC_KEY ?? ""}
      />
    </div>
  );
}
