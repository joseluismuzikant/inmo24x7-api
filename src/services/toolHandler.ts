import { searchProperties } from "./propertyService";
import { leadService } from "./leadService";
import { ensureLeadData, getLeadId, setLeadId } from "./sessionService";
import { parseBuscarPropiedadesArgs, parseDerivarAHumanoArgs, parseGuardarContactoArgs } from "./toolParser";
import type { SessionState, Property } from "../types/types";

export interface ToolResult {
  role: "tool";
  tool_call_id: string;
  content: string;
}

export interface HandoffData {
  summary: string;
}

export interface ToolExecutionResult {
  results: ToolResult[];
  handoff?: HandoffData;
}

class ToolExecutor {
  async executeBuscarPropiedades(
    args: unknown,
    session: SessionState,
    userId: string
  ): Promise<{ results: Property[]; allWithinBudget: boolean; suggestedBudget?: number; leadId?: number }> {
    const parsedArgs = parseBuscarPropiedadesArgs(args);
    if (!parsedArgs) {
      console.log("⚠️ buscarPropiedades: Invalid arguments");
      return { results: [], allWithinBudget: true };
    }

    console.log(`🔍 Searching: ${parsedArgs.operacion} in ${parsedArgs.zona} up to $${parsedArgs.presupuestoMax}`);

    const data = ensureLeadData(session);
    data.operacion = parsedArgs.operacion;
    data.zona = parsedArgs.zona;
    data.presupuestoMax = parsedArgs.presupuestoMax;

    // Search properties
    const searchResult = await searchProperties({
      operacion: parsedArgs.operacion,
      zona: parsedArgs.zona,
      presupuestoMax: parsedArgs.presupuestoMax,
      limit: 10,
    });

    console.log(`✅ Search results: ${searchResult.results.length} properties, ${searchResult.propertiesWithinBudget} within budget`);
    if (searchResult.results.length > 0) {
      searchResult.results.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.titulo?.substring(0, 40)}... - $${p.precio} - Link: ${p.link?.substring(0, 50)}...`);
      });
    }

    // Create or update lead in background
    const leadId = leadService.loadOrCreateLead(userId, data, getLeadId(session));
    if (leadId) {
      setLeadId(session, leadId);
    }

    return { 
      results: searchResult.results, 
      allWithinBudget: searchResult.propertiesWithinBudget === searchResult.results.length,
      leadId 
    };
  }

  executeDerivarAHumano(
    args: unknown,
    session: SessionState,
    userId: string
  ): { ok: boolean; leadId?: number; summary: string } {
    const parsedArgs = parseDerivarAHumanoArgs(args);
    const summary = parsedArgs?.summary ?? "Lead interesado";

    const data = ensureLeadData(session);
    const existingLeadId = getLeadId(session);

    // Create or update lead
    const leadId = leadService.loadOrCreateLead(userId, data, existingLeadId);
    if (leadId) {
      setLeadId(session, leadId);
      leadService.updateLeadData(leadId, {}, summary);
    }

    return { ok: true, leadId, summary };
  }

  executeGuardarContacto(
    args: unknown,
    session: SessionState,
    userId: string
  ): { ok: boolean; nombre?: string; contacto?: string; leadId?: number } {
    const parsedArgs = parseGuardarContactoArgs(args);
    if (!parsedArgs) {
      return { ok: false };
    }

    const data = ensureLeadData(session);
    
    // Update session data with contact info
    if (parsedArgs.nombre) {
      data.nombre = parsedArgs.nombre;
    }
    if (parsedArgs.contacto) {
      data.contacto = parsedArgs.contacto;
    }

    // Update lead in database if it exists
    const leadId = getLeadId(session);
    if (leadId) {
      leadService.updateLeadData(leadId, {
        nombre: data.nombre,
        contacto: data.contacto,
      });
    }

    return {
      ok: true,
      nombre: parsedArgs.nombre,
      contacto: parsedArgs.contacto,
      leadId,
    };
  }
}

const toolExecutor = new ToolExecutor();

export async function executeToolCalls(
  toolCalls: Array<{ id: string; function: { name: string; arguments?: string } }>,
  session: SessionState,
  userId: string
): Promise<ToolExecutionResult> {
  const results: ToolResult[] = [];
  let handoff: HandoffData | undefined;

  for (const tc of toolCalls) {
    const name = tc.function.name;
    const argsJson = tc.function.arguments ?? "{}";
    const args = JSON.parse(argsJson);

    switch (name) {
      case "buscarPropiedades": {
        const result = await toolExecutor.executeBuscarPropiedades(args, session, userId);
        // Pass full property details including real URLs
        const propertiesWithUrls = result.results.map(p => ({
          id: p.id,
          titulo: p.titulo,
          precio: p.precio,
          zona: p.zona,
          link: p.link, // CRITICAL: Real URL from database
          tipo: p.tipo,
          ambientes: p.ambientes
        }));
        results.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ 
            results: propertiesWithUrls,
            userBudget: args.presupuestoMax,
            totalProperties: result.results.length,
            hasResults: result.results.length > 0
          }),
        });
        break;
      }

      case "guardarContactoLead": {
        const result = toolExecutor.executeGuardarContacto(args, session, userId);
        results.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ ok: result.ok, nombre: result.nombre, contacto: result.contacto }),
        });
        break;
      }

      case "derivarAHumano": {
        const result = toolExecutor.executeDerivarAHumano(args, session, userId);
        results.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ ok: result.ok, summary: result.summary }),
        });
        handoff = { summary: result.summary };
        break;
      }

      default:
        results.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ error: `Unknown tool: ${name}` }),
        });
    }
  }

  return { results, handoff };
}
