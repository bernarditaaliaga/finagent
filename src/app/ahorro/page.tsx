import { prisma } from "@/lib/db";
import { AhorroClient } from "@/components/ahorro-client";

export default async function AhorroPage() {
  const goals = await prisma.savingsGoal.findMany({
    orderBy: { createdAt: "desc" },
  });

  const serialized = goals.map((g) => ({
    id: g.id,
    name: g.name,
    targetAmount: g.targetAmount,
    currentAmount: g.currentAmount,
    deadline: g.deadline?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Planes de Ahorro</h1>
        <p className="text-slate-500">Establece metas y sigue tu progreso</p>
      </div>
      <AhorroClient goals={serialized} />
    </div>
  );
}
