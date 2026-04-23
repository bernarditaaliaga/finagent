import { AprenderClient } from "@/components/aprender-client";

export default function AprenderPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Aprender Finanzas</h1>
        <p className="text-slate-500">
          Preguntale al agente sobre finanzas personales, ahorro, inversiones y mas
        </p>
      </div>
      <AprenderClient />
    </div>
  );
}
