import { openai } from "./openaiClient.js";
import { resetSession } from "./sessionStore.js";

import {
  loadSession,
  saveSession,
  ensureLeadData,
  getLeadId,
  setLeadId,
  addMessageToHistory,
  getHistory,
} from "./sessionService.js";
import { leadService } from "./leadService.js";
import { hasToolCalls, parseToolCalls } from "./toolParser.js";
import { executeToolCalls, type ToolResult } from "./toolHandler.js";
import type { BotReply, ChatMsg, SessionState, SourceType } from "../types/types";

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

**EJEMPLO CORRECTO:**
Usuario: "Busco en Palermo hasta 600.000"
→ Llamás buscarPropiedades
→ Recibís 3 propiedades: $580.000, $620.000, $650.000
→ Respondés: "¡Buenas noticias! Encontré 3 opciones en Palermo. Te las muestro:
   1. Depto 2 amb - $580.000 - [link]
   2. Depto 3 amb - $620.000 (supera tu presupuesto) - [link]
   3. Depto 2 amb - $650.000 (supera tu presupuesto) - [link]"

**EJEMPLO PROHIBIDO (NUNCA HAGAS ESTO):**
❌ "Lamentablemente no tengo propiedades disponibles para alquiler dentro de tu presupuesto de 600.000 en Palermo."

**PROPIEDADES:**
Cuando muestres propiedades, SIEMPRE incluí:
- 📍 Dirección completa
- 💰 Precio exacto (si supera el presupuesto, aclaralo)
- 🏠 Características (ambientes, baños, etc.)
- 🔗 Link para ver más fotos

**CONVERSACIÓN:**
- Sé amable y profesional
- Guía al usuario paso a paso
- Validá los datos antes de buscar
- Si el usuario no tiene presupuesto definido, preguntá por rango
- Si la zona es muy amplia, sugerí refinar

**FLUJO DE CAPTURA DE LEAD (CRÍTICO):**
1. Cuando el usuario quiera visitar: Pedí nombre y contacto directamente
2. Cuando te dé los datos:
   - LLAMÁ guardarContacto(nombre, contacto)
   - INMEDIATAMENTE LLAMÁ derivarAHumano(summary) con un resumen tipo "Lead Jorge quiere visitar depto en Palermo, contacto: jorge@email.com"
3. La respuesta después de derivarAHumano debe ser CORTA y FINAL: "¡Perfecto Jorge! Un agente se comunicará con vos para coordinar la visita."
4. NO preguntes nada más, NO sigas la conversación, NO ofrezcas más ayuda

**REGLA DE HANDOFF:**
- Después de derivarAHumano() la conversación TERMINA
- El usuario será atendido por un humano
- Tu último mensaje debe ser de despedida confirmando que un agente se contactará

**HERRAMIENTAS DISPONIBLES:**
1. buscarPropiedades(operacion, zona, presupuestoMax) → SIEMPRE mostrá los resultados
2. derivarAHumano(summary) → Cuando el usuario quiera hablar con un humano
3. guardarContacto(nombre, contacto) → Para guardar datos de contacto

REGLA DE ORO: Si recibís propiedades, LAS MOSTRÁS. Punto.
`;

function isResetCommand(text: string): boolean {
  const t = text.toLowerCase().trim();
  return t === "reset" || t === "reiniciar" || t === "empezar de nuevo" || t === "nueva conversación";
}

export async function botReply(args: { 
  userId: string; 
  text: string;
  tenantId: string;
  sourceType: SourceType;
}): Promise<BotReply> {
  const { userId, text, tenantId, sourceType } = args;
  console.log(`\n📝 User message: "${text}"`);

  try {
    // Handle reset command
    if (isResetCommand(text)) {
      resetSession(userId);
      return { messages: ["Listo ✅ Reinicié la conversación. ¿Buscás comprar o alquilar?"] };
    }

    // Load session and initialize lead from database
    const session = loadSession(userId);
    ensureLeadData(session);
    
    try {
      await initializeLeadFromDatabase(userId, tenantId, sourceType, session);
    } catch (leadError) {
      console.error("⚠️ Failed to initialize lead (continuing anyway):", leadError);
    }

    // Build history
    const history = getHistory(session);
    const messages: ChatMsg[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: text },
    ];

    console.log(`🤖 Calling OpenAI with ${messages.length} messages...`);

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: messages as any,
      tools: [
        {
          type: "function",
          function: {
            name: "buscarPropiedades",
            description: "Busca propiedades según operación, zona y presupuesto máximo",
            parameters: {
              type: "object",
              properties: {
                operacion: { type: "string", enum: ["venta", "alquiler"], description: "Tipo de operación" },
                zona: { type: "string", description: "Zona/barrio donde buscar" },
                presupuestoMax: { type: "number", description: "Presupuesto máximo en pesos argentinos" },
              },
              required: ["operacion", "zona", "presupuestoMax"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "derivarAHumano",
            description: "Deriva la conversación a un agente humano",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "Resumen de la conversación para el agente" },
              },
              required: ["summary"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "guardarContacto",
            description: "Guarda el nombre y datos de contacto del usuario",
            parameters: {
              type: "object",
              properties: {
                nombre: { type: "string", description: "Nombre del usuario" },
                contacto: { type: "string", description: "Teléfono, email o forma de contacto" },
              },
              required: ["nombre", "contacto"],
            },
          },
        },
      ],
      tool_choice: "auto",
      temperature: 0.7,
    });

    const assistantMessage = completion.choices[0].message;
    console.log(`✅ OpenAI response received`);

    // Handle tool calls
    let toolResults: ToolResult[] = [];
    let handoffData: { summary: string } | undefined;

    if (hasToolCalls(assistantMessage)) {
      console.log(`🔧 Processing ${assistantMessage.tool_calls?.length} tool calls...`);
      const toolCalls = parseToolCalls(assistantMessage);
      
      try {
        const executionResult = await executeToolCalls(toolCalls, session, userId, tenantId, sourceType);
        toolResults = executionResult.results;
        handoffData = executionResult.handoff;

        // Update lead ID in session if returned from tool
        const leadIdFromTool = toolResults.find(r => {
          try {
            const content = JSON.parse(r.content);
            return content.leadId;
          } catch {
            return false;
          }
        });
        if (leadIdFromTool) {
          try {
            const content = JSON.parse(leadIdFromTool.content);
            if (content.leadId) {
              setLeadId(session, content.leadId);
            }
          } catch {
            // ignore
          }
        }
      } catch (toolError) {
        console.error("⚠️ Tool execution failed:", toolError);
      }
    }

    // Build final messages for second OpenAI call
    const finalMessages: ChatMsg[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: text },
    ];

    // Include the assistant message (with tool_calls if present) - MUST come before tool results
    finalMessages.push(assistantMessage as any);

    if (toolResults.length > 0) {
      finalMessages.push(...toolResults as any);
    }

    // Get final response
    const finalCompletion = await openai.chat.completions.create({
      model: MODEL,
      messages: finalMessages as any,
      temperature: 0.7,
    });

    const finalContent = finalCompletion.choices[0].message.content ?? "";
    console.log(`🤖 Final response: "${finalContent.substring(0, 100)}..."`);

    // Update history
    addMessageToHistory(session, { role: "user", content: text });
    addMessageToHistory(session, { role: "assistant", content: finalContent });
    saveSession(userId, session);

    return { 
      messages: [finalContent],
      handoff: handoffData,
    };
  } catch (error: any) {
    console.error("❌ Error in botReply:", error);
    // Return a graceful error message to the user
    return {
      messages: ["Lo siento, hubo un error procesando tu mensaje. ¿Podés intentar de nuevo?"],
    };
  }
}

async function initializeLeadFromDatabase(
  visitorId: string, 
  tenantId: string, 
  sourceType: SourceType,
  session: SessionState
): Promise<void> {
  try {
    const leadId = await leadService.loadOrCreateLead(visitorId, tenantId, sourceType, ensureLeadData(session), getLeadId(session));
    if (leadId) {
      setLeadId(session, leadId);
    }
  } catch (error) {
    console.error("⚠️ Failed to initialize lead from database:", error);
    // Don't throw - we can continue without lead tracking
  }
}
