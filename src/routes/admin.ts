import { Router } from "express";
import { listLeads, getLeadById } from "../repositories/leadRepo";

export const adminRouter = Router();

/* =========================
   Utils simples
========================= */

function esc(v: any) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function money(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("es-AR");
}

/* =========================
   LISTA DE LEADS
========================= */

adminRouter.get("/admin/leads", (_req, res) => {
  const leads = listLeads(50);

  const rows = leads
    .map((l: any) => `
      <tr>
        <td><a href="/admin/leads/${l.id}">${l.id}</a></td>
        <td>${esc(l.createdAt)}</td>
        <td>${esc(l.operacion)}</td>
        <td>${esc(l.zona)}</td>
        <td style="text-align:right">${money(l.presupuestoMax)}</td>
        <td>${esc(l.nombre)}</td>
        <td>${esc(l.contacto)}</td>
        <td class="muted">${esc(l.summary)}</td>
      </tr>
    `)
    .join("");

  res.type("html").send(`
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Inmo24x7 – Leads</title>
  <style>
    body {
      font-family: system-ui, Arial;
      background: #0b1020;
      color: #fff;
      padding: 24px;
    }
    h1 { margin-bottom: 4px; }
    .muted { color: #aaa; font-size: 13px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    th, td {
      padding: 10px;
      border-bottom: 1px solid #333;
      vertical-align: top;
    }
    th {
      text-align: left;
      font-size: 12px;
      color: #bbb;
    }
    tr:hover td { background: #141a33; }
    a { color: #1abc9c; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn {
      padding: 8px 12px;
      border-radius: 8px;
      background: #1abc9c;
      color: #000;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <h1>Leads capturados</h1>
      <div class="muted">Panel demo – Inmo24x7</div>
    </div>
    <a class="btn" href="/admin/leads">Refrescar</a>
  </div>

  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Fecha</th>
        <th>Operación</th>
        <th>Zona</th>
        <th style="text-align:right">Presupuesto</th>
        <th>Nombre</th>
        <th>Contacto</th>
        <th>Resumen</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="8" class="muted">No hay leads todavía</td></tr>`}
    </tbody>
  </table>
</body>
</html>
  `);
});

/* =========================
   DETALLE DE LEAD
========================= */

adminRouter.get("/admin/leads/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).send("ID inválido");
  }

  const lead: any = getLeadById(id);
  if (!lead) {
    return res.status(404).send("Lead no encontrado");
  }

  res.type("html").send(`
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Lead #${id}</title>
  <style>
    body {
      font-family: system-ui, Arial;
      background: #0b1020;
      color: #fff;
      padding: 24px;
    }
    a { color: #1abc9c; }
    .box {
      background: #141a33;
      padding: 16px;
      border-radius: 12px;
      margin-bottom: 16px;
    }
    .k { color: #aaa; font-size: 12px; }
    .v { font-size: 14px; margin-bottom: 10px; }
    pre {
      background: #000;
      padding: 12px;
      border-radius: 8px;
      overflow: auto;
    }
  </style>
</head>
<body>
  <a href="/admin/leads">← Volver</a>

  <h1>Lead #${id}</h1>

  <div class="box">
    <div class="k">Fecha</div><div class="v">${esc(lead.createdAt)}</div>
    <div class="k">Operación</div><div class="v">${esc(lead.operacion)}</div>
    <div class="k">Zona</div><div class="v">${esc(lead.zona)}</div>
    <div class="k">Presupuesto</div><div class="v">${money(lead.presupuestoMax)}</div>
    <div class="k">Nombre</div><div class="v">${esc(lead.nombre)}</div>
    <div class="k">Contacto</div><div class="v">${esc(lead.contacto)}</div>
    <div class="k">Resumen</div><div class="v">${esc(lead.summary)}</div>
  </div>

  <div class="box">
    <div class="k">Raw</div>
    <pre>${esc(JSON.stringify(lead, null, 2))}</pre>
  </div>
</body>
</html>
  `);
});
