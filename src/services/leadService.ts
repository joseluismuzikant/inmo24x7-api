import { createLead, updateLead, getLeadByVisitorId, type Lead, type SourceType } from "../repositories/leadRepo.js";
import type { LeadData } from "./sessionService.js";

export class LeadService {
  async loadOrCreateLead(
    visitor_id: string, 
    tenant_id: string,
    source_type: SourceType,
    sessionData: LeadData, 
    sessionLeadId?: number
  ): Promise<number | undefined> {
    // If we already have a leadId in session, update it
    if (sessionLeadId) {
      return sessionLeadId;
    }

    // Create lead if we have enough data OR at least contact info
    if (this.canCreateLead(sessionData) || sessionData.nombre || sessionData.contacto) {
      console.log("📝 loadOrCreateLead sessionData:", sessionData);
      const leadId = await createLead({
        tenant_id,
        visitor_id,
        source_type,
        operacion: sessionData.operacion ?? undefined,
        zona: sessionData.zona ?? undefined,
        presupuesto_max: sessionData.presupuestoMax ?? undefined,
        nombre: sessionData.nombre ?? undefined,
        contacto: sessionData.contacto ?? undefined,
      });
      console.log("📝 loadOrCreateLead created leadId:", leadId);
      return leadId;
    }

    console.log("📝 loadOrCreateLead skipped, sessionData:", sessionData);
    return undefined;
  }

  async updateLeadData(leadId: number, data: Partial<LeadData>, summary?: string): Promise<void> {
    console.log("📝 updateLeadData called with leadId:", leadId, "data:", data);
    const updateData: Record<string, any> = {};
    if (data.operacion !== undefined) updateData.operacion = data.operacion;
    if (data.zona !== undefined) updateData.zona = data.zona;
    if (data.presupuestoMax !== undefined) updateData.presupuesto_max = data.presupuestoMax;
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.contacto !== undefined) updateData.contacto = data.contacto;
    if (summary) {
      updateData.summary = summary;
    }
    console.log("📝 updateLeadData updateData:", updateData);
    await updateLead(leadId, updateData);
  }

  private canCreateLead(data: LeadData): boolean {
    return !!(
      data.operacion &&
      data.zona &&
      typeof data.presupuestoMax === "number" &&
      data.presupuestoMax > 0
    );
  }
}

export const leadService = new LeadService();
