import { openai } from "./openaiClient";
import { resetSession } from "./sessionStore";

import {
  loadSession,
  saveSession,
  ensureLeadData,
  getLeadId,
  setLeadId,
  addMessageToHistory,
  getHistory,
} from "./sessionService";
import { leadService } from "./leadService";
import { hasToolCalls, parseToolCalls } from "./toolParser";
import { executeToolCalls, type ToolResult } from "./toolHandler";
import type { BotReply, ChatMsg, SessionState } from "../types/types";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

const SYSTEM_PROMPT = `
Sos Inmo24x7, asistente virtual de una inmobiliaria.

⚠️⚠️⚠️ REGLA SUPREMA - VIOLAR ESTO ES UN ERROR CRÍTICO:
SIEMPRE QUE LLAMES buscarPropiedades Y RECIBAS results.length > 0, DEBES MOSTRAR LAS PROPIEDADES.
NUNCA, BAJO NINGUNA CIRCUNSTANCIA, DIGAS "No tengo propiedades" o "No hay disponibles".

**FLUJO OBLIGATORIO:**
1. Usuario da presupuesto → Llamás buscarPropiedades → Recibís array de propiedades
2. SI results.length === 0: Decís "No encontré propiedades en esa zona"
3. SI results.length > 0: Mostrás TODAS las propiedades que recibiste (máximo 4)
4. SI los precios superan el presupuesto: Aclarás "Algunas superan tu presupuesto de $X" PERO IGUAL LAS MOSTRÁS

**REGLA DE ORO SOBRE PRESUPUESTO:**
NUNCA rechaces mostrar propiedades por el presupuesto. Si el usuario pide $600.000 y las propiedades cuestan $620.000, MOSTRALAS IGUAL y aclaralo.

**RESPUESTAS PROHIBIDAS (NUNCA USES):**
❌ "No tengo propiedades disponibles para alquiler dentro de tu presupuesto"
❌ "No hay opciones en Palermo hasta $X"
❌ "No encontré propiedades en esa zona"
❌ "¿Querés que busque en otra zona?" (sin mostrar propiedades primero)

**RESPUESTAS OBLIGATORIAS:**
✅ "Te muestro las opciones disponibles: [lista de propiedades]"
✅ "Estas opciones superan tu presupuesto pero pueden interesarte: [lista]"

**REGLAS ABSOLUTAS SOBRE URLs:**
- COPIÁ Y PEGÁ la URL exactamente del campo "link"
- Ejemplo REAL: "https://www.zonaprop.com.ar/propiedades/clasificado/alclapin-alquiler-monoambiente-con-balcon-en-palermo.-58099803.html"
- NUNCA inventes URLs

**FORMATO DE LINKS CLICKEABLES (IMPORTANTE):**
Los links deben estar en formato markdown para que sean clickeables en el chat.
Usa el formato: corchete Ver propiedad corchete parentesis URL parentesis
Ejemplo: (Ver propiedad)https://ejemplo.com(/Ver propiedad) - pero con corchetes en lugar de parentesis para el texto

CORRECTO (link clickeable en markdown):
- Texto entre CORCHETES seguido de URL entre PARENTESIS
- Ejemplo: [Ver en Zonaprop] (https://www.zonaprop.com.ar/...) - pero sin espacio entre corchetes y parentesis

INCORRECTO (texto plano no clickeable):
Link: https://www.zonaprop.com.ar/propiedades/clasificado/...

**EJEMPLO OBLIGATORIO DE RESPUESTA:**
Usuario: "600000 pesos"
Llamas buscarPropiedades y recibis 3 propiedades
Bot dice: "Te muestro opciones disponibles en Palermo:

1. Alquiler monoambiente con balcon - $620.000
[Ver en Zonaprop](https://www.zonaprop.com.ar/propiedades/clasificado/alclapin-alquiler-monoambiente-con-balcon-en-palermo.-58099803.html)

2. Departamento 2 ambientes - $700.000
[Ver en Zonaprop](https://www.zonaprop.com.ar/propiedades/clasificado/alclapin-departamento-en-palermo-57710529.html)

Algunas superan tu presupuesto de $600.000. Cual te interesa?"

⚠️ NUNCA digas que no hay propiedades si recibiste results.length > 0
`

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "buscarPropiedades",
      description:
        "Busca propiedades disponibles en la zona solicitada. Devuelve hasta 10 propiedades del barrio (sin filtrar por presupuesto todavía). El bot debe analizar el presupuesto del usuario y mostrar las propiedades apropiadas. Cada propiedad incluye: id, titulo, zona, precio, link (URL COMPLETA Y REAL de Zonaprop). Response fields: results (array de hasta 10 propiedades con URLs reales), userBudget (presupuesto del usuario), propertiesWithinBudget (cuántas entran en el presupuesto).",
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
      name: "guardarContactoLead",
      description:
        "Guarda el nombre y/o teléfono del lead cuando el usuario los proporciona. Usar cuando el usuario diga su nombre o número de contacto.",
      parameters: {
        type: "object",
        properties: {
          nombre: { type: "string", description: "Nombre del lead" },
          contacto: { type: "string", description: "Teléfono o email del lead" },
        },
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

function isResetCommand(text: string): boolean {
  return text.trim().toLowerCase() === "/reset";
}

function isOpenAIRateLimitOrQuota(err: any): boolean {
  return err?.status === 429;
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function buildMessages(history: ChatMsg[]) {
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];
}

async function callModel(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  tools?: typeof TOOLS
) {
  try {
    return await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: tools ? "auto" : undefined,
    });
  } catch (err: any) {
    if (isOpenAIRateLimitOrQuota(err)) {
      return null;
    }
    throw err;
  }
}

async function handleToolCalls(
  msg: any,
  session: SessionState,
  userId: string,
  nextHistory: ChatMsg[]
): Promise<BotReply> {
  const toolCalls = parseToolCalls(msg);
  console.log(`🔧 Tool calls detected: ${toolCalls.length}`);
  
  if (toolCalls.length === 0) {
    throw new Error("No valid tool calls found");
  }

  // Execute tool calls
  const { results, handoff } = await executeToolCalls(
    toolCalls.map((tc) => ({ id: tc.id, function: tc.function })),
    session,
    userId
  );
  
  // Log what we're sending to OpenAI
  results.forEach((r, i) => {
    console.log(`📤 Tool result ${i + 1}:`, r.content.substring(0, 200));
  });

  // Persist session state
  saveSession(userId, session);

  // Build messages for second call
  const messagesForSecondCall: any[] = [
    ...buildMessages(nextHistory),
    {
      role: "assistant",
      content: msg.content ?? "",
      tool_calls: msg.tool_calls,
    },
    ...results,
  ];

  // Second call to get final response
  const resp2 = await openai.chat.completions.create({
    model: MODEL,
    messages: messagesForSecondCall,
  });

  const finalMsg = resp2.choices[0]?.message?.content?.trim();
  if (!finalMsg) {
    return { messages: ["Ok. ¿Querés que te muestre opciones?"] };
  }

  // Update history with final response
  addMessageToHistory(session, { role: "assistant", content: finalMsg });
  saveSession(userId, session);

  // Update lead with summary if handoff occurred
  if (handoff?.summary) {
    const leadId = getLeadId(session);
    if (leadId) {
      leadService.updateLeadData(leadId, {}, handoff.summary);
    }
    return {
      messages: [finalMsg],
      handoff: { summary: handoff.summary },
    };
  }

  return { messages: [finalMsg] };
}

async function handleDirectResponse(
  msg: any,
  session: SessionState,
  userId: string,
  nextHistory: ChatMsg[]
): Promise<BotReply> {
  const content = (msg.content ?? "").trim();
  if (!content) {
    return { messages: ["¿Me decís si buscás comprar o alquilar?"] };
  }

  addMessageToHistory(session, { role: "assistant", content });
  saveSession(userId, session);

  return { messages: [content] };
}

function initializeLeadFromDatabase(userId: string, session: SessionState): void {
  const leadId = leadService.loadOrCreateLead(userId, ensureLeadData(session), getLeadId(session));
  if (leadId) {
    setLeadId(session, leadId);
  }
}

export async function botReply(args: { userId: string; text: string }): Promise<BotReply> {
  const { userId, text } = args;
  console.log(`\n📝 User message: "${text}"`);

  // Handle reset command
  if (isResetCommand(text)) {
    resetSession(userId);
    return { messages: ["Listo ✅ Reinicié la conversación. ¿Buscás comprar o alquilar?"] };
  }

  // Load session and initialize lead from database
  const session = loadSession(userId);
  ensureLeadData(session);
  initializeLeadFromDatabase(userId, session);

  // Build history
  const history = getHistory(session);
  const nextHistory: ChatMsg[] = [...history, { role: "user", content: text }];
  addMessageToHistory(session, { role: "user", content: text });

  // First call to OpenAI
  console.log("🤖 Calling OpenAI...");
  const resp = await callModel(buildMessages(nextHistory), TOOLS);
  if (!resp) {
    return {
      messages: [
        "Ahora mismo estoy sin cupo de IA ⚠️ (demo).",
        "¿Buscás comprar o alquilar?",
      ],
    };
  }

  const msg = resp.choices[0]?.message;
  if (!msg) {
    return { messages: ["Tuve un problema 😅 ¿me repetís eso?"] };
  }

  console.log(`🤖 OpenAI response type: ${hasToolCalls(msg) ? "TOOL_CALL" : "DIRECT"}`);
  
  // Handle tool calls or direct response
  if (hasToolCalls(msg)) {
    console.log(`🔧 Tool calls detected: ${msg.tool_calls?.length || 0}`);
    return handleToolCalls(msg, session, userId, nextHistory);
  } else {
    console.log(`💬 Direct response: "${msg.content?.substring(0, 100)}..."`);
    return handleDirectResponse(msg, session, userId, nextHistory);
  }
}
