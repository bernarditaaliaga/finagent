import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `Eres un asistente de educación financiera personal para usuarios en Chile.
Tu objetivo es enseñar conceptos financieros de forma simple y clara.

Reglas:
- Responde siempre en español chileno, de forma cercana pero profesional
- Usa ejemplos con pesos chilenos (CLP), UF, y contexto del mercado chileno
- Explica como si le hablaras a alguien que está aprendiendo por primera vez
- Si te preguntan sobre inversiones, siempre aclara los riesgos
- Mantén las respuestas concisas pero completas (máximo 300 palabras)
- Si no sabes algo específico sobre regulación chilena actual, dilo honestamente`;

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.includes("tu_key_aqui")) {
      return NextResponse.json({
        response:
          "La API key de Anthropic no está configurada. Agrega tu ANTHROPIC_API_KEY en el archivo .env para usar el chat educativo.",
      });
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ response: text });
  } catch (error) {
    console.error("Error en chat:", error);
    return NextResponse.json(
      { response: "Error al procesar tu pregunta. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
