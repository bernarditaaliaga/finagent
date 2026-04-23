import { prisma } from "@/lib/db";
import { SplitClient } from "@/components/split-client";

export const dynamic = "force-dynamic";

export default async function SplitPage() {
  const groups = await prisma.splitGroup.findMany({
    include: {
      members: true,
      expenses: {
        include: { paidBy: true, shares: { include: { member: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = groups.map((g) => ({
    id: g.id,
    name: g.name,
    members: g.members.map((m) => ({ id: m.id, name: m.name })),
    expenses: g.expenses.map((e) => ({
      id: e.id,
      description: e.description,
      amount: e.amount,
      paidByName: e.paidBy.name,
      shares: e.shares.map((s) => ({
        memberName: s.member.name,
        amount: s.amount,
      })),
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dividir Gastos</h1>
        <p className="text-slate-500">
          Tipo Tricount: divide gastos entre amigos y lleva la cuenta
        </p>
      </div>
      <SplitClient groups={serialized} />
    </div>
  );
}
