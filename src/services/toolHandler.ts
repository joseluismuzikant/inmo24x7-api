import { searchProperties } from "./propertyService.js";
import { leadService } from "./leadService.js";
import { ensureLeadData, getLeadId, setLeadId } from "./sessionService.js";
import { parseBuscarPropiedadesArgs, parseDerivarAHumanoArgs, parseGuardarContactoArgs } from "./toolParser.js";
import type { SessionState, Property, SourceType } from "../types/types";

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
    visitorId: string,
    tenantId: string,
    sourceType: SourceType
  ): Promise<{ results: Property[]; allWithinBudget: boolean; suggestedBudget?: number; leadId?: number }> {
    const parsedArgs = parseBuscarPropiedadesArgs(args);
    if (!parsedArgs) {
      return { results: [], allWithinBudget: true };
    }

    const data = ensureLeadData(session);
    data.operacion = parsedArgs.operacion;
    data.zona = parsedArgs.zona;
    data.presupuestoMax = parsedArgs.presupuestoMax;

    const searchResult = await searchProperties({
      operacion: parsedArgs.operacion,
      zona: parsedArgs.zona,
      presupuestoMax: parsedArgs.presupuestoMax,
      limit: 10,
    });

    // Create or update lead in background
    const leadId = await leadService.loadOrCreateLead(visitorId, tenantId, sourceType, data, getLeadId(session));
    if (leadId) {
      setLeadId(session, leadId);
    }

    return { 
      results: searchResult.results, 
      allWithinBudget: searchResult.propertiesWithinBudget === searchResult.results.length,
      leadId 
    };
  }

  async executeDerivarAHumano(
    args: unknown,
    session: SessionState,
    visitorId: string,
    tenantId: string,
    sourceType: SourceType
  ): Promise<{ ok: boolean; leadId?: number; summary: string }> {
    const parsedArgs = parseDerivarAHumanoArgs(args);
    const summary = parsedArgs?.summary ?? "Lead interesado";

    const data = ensureLeadData(session);
    const existingLeadId = getLeadId(session);

    // Extract nombre and contacto from summary if not in session
    // Format: "Lead Juan Carlos quiere visitar depto en Belgrano, contacto: 112334552"
    const nombreMatch = summary.match(/Lead\s+([A-Za-z\s]+?)(?:\s+quiere|,\s*contacto)/i);
    const contactoMatch = summary.match(/contacto:\s*([^\s,]+)/i);
    
    if (nombreMatch && !data.nombre) {
      data.nombre = nombreMatch[1].trim();
    }
    if (contactoMatch && !data.contacto) {
      data.contacto = contactoMatch[1].trim();
    }

    // Create or update lead with all available data
    const leadId = await leadService.loadOrCreateLead(visitorId, tenantId, sourceType, data, existingLeadId);
    if (leadId) {
      setLeadId(session, leadId);
      await leadService.updateLeadData(leadId, {
        nombre: data.nombre,
        contacto: data.contacto,
        zona: data.zona,
      }, summary);
    }

    return { ok: true, leadId, summary };
  }

  async executeGuardarContacto(
    args: unknown,
    session: SessionState,
    visitorId: string,
    tenantId: string,
    sourceType: SourceType
  ): Promise<{ ok: boolean; nombre?: string; contacto?: string; leadId?: number }> {
    const parsedArgs = parseGuardarContactoArgs(args);
    if (!parsedArgs) {
      console.log("⚠️ guardarContacto: Invalid arguments", args);
      return { ok: false };
    }

    console.log("📥 guardarContacto parsedArgs:", parsedArgs);

    const data = ensureLeadData(session);
    
    // Update session data with contact info
    if (parsedArgs.nombre) {
      data.nombre = parsedArgs.nombre;
    }
    if (parsedArgs.contacto) {
      data.contacto = parsedArgs.contacto;
    }

    console.log("📥 guardarContacto data after update:", data);

    // Update lead in database if it exists
    let leadId = getLeadId(session);
    const updatePayload: any = {};
    if (data.nombre) updatePayload.nombre = data.nombre;
    if (data.contacto) updatePayload.contacto = data.contacto;
    
    console.log("📥 guardarContacto updatePayload:", updatePayload, "leadId:", leadId);
    
    if (leadId) {
      if (Object.keys(updatePayload).length > 0) {
        await leadService.updateLeadData(leadId, updatePayload);
      }
    } else {
      // Create lead with contact info (even without presupuesto)
      if (data.nombre || data.contacto) {
        const newLeadId = await leadService.loadOrCreateLead(visitorId, tenantId, sourceType, data, undefined);
        console.log("📥 guardarContacto newLeadId:", newLeadId);
        if (newLeadId) {
          setLeadId(session, newLeadId);
          leadId = newLeadId;
        }
      }
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
  visitorId: string,
  tenantId: string,
  sourceType: SourceType
): Promise<ToolExecutionResult> {
  const results: ToolResult[] = [];
  let handoff: HandoffData | undefined;

  for (const tc of toolCalls) {
    const name = tc.function.name;
    const argsJson = tc.function.arguments ?? "{}";
    const args = JSON.parse(argsJson);

    switch (name) {
      case "buscarPropiedades": {
        const result = await toolExecutor.executeBuscarPropiedades(args, session, visitorId, tenantId, sourceType);
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
        const result = await toolExecutor.executeGuardarContacto(args, session, visitorId, tenantId, sourceType);
        results.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ ok: result.ok, nombre: result.nombre, contacto: result.contacto }),
        });
        break;
      }

      case "derivarAHumano": {
        const result = await toolExecutor.executeDerivarAHumano(args, session, visitorId, tenantId, sourceType);
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
