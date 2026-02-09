import { openai } from "./openaiClient.js";
import { getSession, setSession, resetSession } from "./sessionStore.js";
import { searchProperties } from "./propertyService.js";
import type { BotReply, Property, ChatMsg, Operation } from "../types/types.js";

function formatProps(props: Property[]) {
  return props.map((p, idx) => {
    const link = p.link ? `\nLink: ${p.link}` : "";
    return `**${idx + 1}. ${p.titulo}**\nZona: ${p.zona}\nPrecio: ${
      p.precio
    }${link}`;
  });
}

function keepLast(history: ChatMsg[], max = 10) {
  return history.slice(-max);
}

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

const SYSTEM_PROMPT = `
Sos Inmo24x7, asistente virtual de una inmobiliaria.
Objetivo: calificar el lead (operación, zona, presupuesto) y mostrar SOLO propiedades disponibles del listado.
Reglas:
- No inventes propiedades ni precios.
- Hacé una pregunta por mensaje. Máximo 3 preguntas seguidas.
- Si el usuario confirma interés ("sí", "quiero visitar", etc.), ofrecé derivarlo a un asesor.
- Si faltan datos, preguntá lo mínimo necesario.
- Respuestas cortas, claras y en español rioplatense.
`;

export async function botReply(args: {
  userId: string;
  text: string;
}): Promise<BotReply> {
  const { userId, text } = args;

  // comando útil
  if (text.trim().toLowerCase() === "/reset") {
    resetSession(userId);
    return {
      messages: [
        "Listo ✅ Reinicié la conversación. ¿Buscás comprar o alquilar?",
      ],
    };
  }

  const session = getSession(userId);
  const history: ChatMsg[] = session.history ?? [];

  // agrego el mensaje del usuario al historial
  const nextHistory = keepLast(
    [...history, { role: "user", content: text }],
    10
  );

  // tools que el modelo puede llamar
  const tools = [
    {
      type: "function" as const,
      function: {
        name: "buscarPropiedades",
        description:
          "Busca propiedades disponibles según operación, zona y presupuesto máximo. Devuelve hasta 3 opciones.",
        parameters: {
          type: "object",
          properties: {
            operacion: { type: "string", enum: ["venta", "alquiler"] },
            zona: { type: "string" },
            presupuestoMax: { type: "number" },
          },
          required: ["operacion", "zona", "presupuestoMax"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "derivarAHumano",
        description:
          "Marca el lead como listo para asesor humano. Debe incluir un resumen corto del caso.",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string" },
          },
          required: ["summary"],
        },
      },
    },
  ];

  // 1) Llamada al modelo (puede pedir tool calls)
  let resp;
  try {
    resp = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...nextHistory.map((m) => ({ role: m.role, content: m.content })),
      ],
      tools,
      tool_choice: "auto",
    });
  } catch (err: any) {
    // 429 quota/rate limit
    if (err?.status === 429) {
      return {
        messages: [
          "Ahora mismo estoy sin cupo de IA ⚠️ (demo).",
          "¿Buscás comprar o alquilar?",
        ],
      };
    }
    throw err;
  }
  const msg = resp.choices[0]?.message;
  if (!msg) {
    return { messages: ["Tuve un problema 😅 ¿me repetís eso?"] };
  }

  // Si el modelo pidió llamar herramientas
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const toolResults: {
      role: "tool";
      tool_call_id: string;
      content: string;
    }[] = [];

    for (const tc of msg.tool_calls) {
      if (tc.type === "function") {
        const name = tc.function.name;
        const argsJson = tc.function.arguments ?? "{}";
        const parsed = JSON.parse(argsJson);

        if (name === "buscarPropiedades") {
          const operacion = parsed.operacion as Operation;
          const zona = String(parsed.zona);
          const presupuestoMax = Number(parsed.presupuestoMax);

          const results = searchProperties({
            operacion,
            zona,
            presupuestoMax,
            limit: 3,
          });

          toolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ results }),
          });
        }

        if (name === "derivarAHumano") {
          toolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({
              ok: true,
              summary: String(parsed.summary),
            }),
          });
        }
      }
    }

    // 2) Segunda llamada: el modelo redacta la respuesta final usando resultados de tools
    const resp2 = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...nextHistory.map((m) => ({ role: m.role, content: m.content })),
        // mensaje assistant que contiene tool_calls
        {
          role: "assistant",
          content: msg.content ?? "",
          tool_calls: msg.tool_calls,
        },
        ...toolResults,
      ],
    });

    const finalMsg = resp2.choices[0]?.message?.content?.trim();
    if (!finalMsg)
      return { messages: ["Ok. ¿Querés que te muestre opciones?"] };

    // Persistimos historial con la respuesta final
    const updatedHistory = keepLast(
      [...nextHistory, { role: "assistant", content: finalMsg }],
      10
    );
    setSession(userId, { ...session, history: updatedHistory });

    // Si el modelo pidió derivar, lo detectamos desde toolResults
    const handoffTool = toolResults.find((t) =>
      t.content.includes('"summary"')
    );
    if (handoffTool) {
      const parsed = JSON.parse(handoffTool.content);
      // opcional: reset sesión si ya derivó
      // resetSession(userId);

      return {
        messages: [finalMsg],
        handoff: { summary: parsed.summary ?? "Lead interesado" },
      };
    }

    // Bonus: si se devolvieron propiedades, podés post-procesar para mostrar más lindo (opcional)
    // Pero ya debería venir en finalMsg.

    return { messages: [finalMsg] };
  }

  // Si no hubo tool calls, el modelo respondió directo (ej: pregunta)
  const content = (msg.content ?? "").trim();
  if (!content)
    return { messages: ["¿Me decís si buscás comprar o alquilar?"] };

  // Guardar historial
  const updatedHistory = keepLast(
    [...nextHistory, { role: "assistant", content }],
    10
  );
  setSession(userId, { ...session, history: updatedHistory });

  return { messages: [content] };
}
