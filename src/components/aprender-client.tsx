"use client";

import { useState } from "react";
import { Send, GraduationCap } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Que es la UF y por que sube o baja?",
  "Como hacer un presupuesto mensual?",
  "Que es el interes compuesto?",
  "Como empezar a invertir en Chile?",
  "Diferencia entre cuenta corriente y cuenta vista?",
  "Que son los fondos mutuos?",
];

export function AprenderClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage(text: string) {
    if (!text.trim()) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.response }]);
    } catch {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Error al conectar con el asistente. Verifica tu API key de Anthropic en .env",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col h-[600px]">
      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-4">
              Preguntame lo que quieras sobre finanzas
            </h3>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-xs text-slate-600"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-800"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-xl px-4 py-3 text-sm text-slate-400">
              Pensando...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta..."
            className="flex-1 px-4 py-2 border rounded-lg text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
