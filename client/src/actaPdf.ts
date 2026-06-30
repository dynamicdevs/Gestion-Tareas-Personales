import type { RubricTemplateFull, RubricKind } from "./types";

// Genera un acta en una ventana nueva con un diseño limpio para imprimir/guardar
// como PDF (vía el diálogo del navegador). Sin dependencias externas.

const KIND_META: Record<RubricKind, { label: string; color: string; mark: string }> = {
  punto: { label: "Punto a tratar", color: "#0891b2", mark: "•" },
  acuerdo: { label: "Acuerdo", color: "#059669", mark: "✓" },
  siguiente_paso: { label: "Próximo paso", color: "#7c3aed", mark: "→" },
};

// Escapa texto para insertarlo de forma segura en el HTML.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Convierte saltos de línea en <br> (texto ya escapado).
function nl2br(s: string): string {
  return esc(s).replace(/\n/g, "<br>");
}

function fmtLongDate(iso: string | null): string {
  if (!iso) return "Sin fecha";
  return new Date(iso).toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function peopleList(people: string | null | undefined): string[] {
  return (people ?? "")
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function downloadActaPdf(acta: RubricTemplateFull, projectName: string | null) {
  // Normalizamos los campos de texto: en actas antiguas o creadas por IA pueden
  // venir undefined/null, lo que rompería los .trim() de más abajo.
  const name = (acta.name ?? "").trim() || "Acta sin título";
  const objective = (acta.objective ?? "").trim();
  const people = peopleList(acta.people);
  const generated = new Date().toLocaleString("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Agrupa los puntos por tipo, conservando el orden.
  const itemsHtml = acta.items.length
    ? acta.items
        .map((it) => {
          const meta = KIND_META[it.kind as RubricKind] ?? KIND_META.punto;
          // Campos opcionales: pueden venir undefined/null en actas antiguas o creadas por IA.
          const title = (it.title ?? "").trim();
          const responsible = (it.responsible ?? "").trim();
          const notes = (it.notes ?? "").trim();
          const extra: string[] = [];
          if (responsible) extra.push(`<span class="resp">👤 ${esc(responsible)}</span>`);
          if (notes) extra.push(`<div class="notes">${nl2br(notes)}</div>`);
          return `
            <li class="item">
              <span class="badge" style="background:${meta.color}1a;color:${meta.color};border-color:${meta.color}55">
                ${meta.mark} ${meta.label}
              </span>
              <div class="item-body">
                <div class="item-title ${it.done ? "done" : ""}">${it.done ? "☑ " : ""}${esc(title)}</div>
                ${extra.join("")}
              </div>
            </li>`;
        })
        .join("")
    : `<li class="empty">No se registraron puntos.</li>`;

  const peopleHtml = people.length
    ? `<ul class="people">${people.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`
    : `<span class="muted">No se registraron asistentes.</span>`;

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Acta — ${esc(name)}</title>
<style>
  :root { --accent: #0891b2; --ink: #0e1a26; --dim: #5b6b78; --line: #e2e8f0; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    color: var(--ink); margin: 0; padding: 40px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .sheet { max-width: 760px; margin: 0 auto; }
  header {
    display: flex; align-items: flex-start; justify-content: space-between;
    border-bottom: 3px solid var(--accent); padding-bottom: 16px; margin-bottom: 24px;
  }
  .brand { font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--accent); font-weight: 700; }
  h1 { font-size: 26px; margin: 4px 0 0; line-height: 1.2; }
  .doc-type { text-align: right; font-size: 11px; color: var(--dim); }
  .doc-type strong { display: block; font-size: 18px; color: var(--ink); letter-spacing: 0.1em; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 24px; }
  .meta .row { font-size: 13px; }
  .meta .k { color: var(--dim); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
  .meta .v { font-weight: 600; }
  .section-title { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--accent); font-weight: 700; margin: 24px 0 10px; }
  .objective { background: #f1f5f9; border-radius: 10px; padding: 12px 14px; font-size: 14px; line-height: 1.5; }
  ul.people { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 8px; }
  ul.people li { background: #f1f5f9; border-radius: 999px; padding: 4px 12px; font-size: 13px; }
  ol.items { list-style: none; margin: 0; padding: 0; counter-reset: it; }
  li.item { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); break-inside: avoid; }
  li.item:last-child { border-bottom: none; }
  .badge { flex-shrink: 0; align-self: flex-start; font-size: 11px; font-weight: 600;
    border: 1px solid; border-radius: 999px; padding: 3px 9px; white-space: nowrap; }
  .item-body { flex: 1; }
  .item-title { font-size: 14.5px; font-weight: 600; line-height: 1.4; }
  .item-title.done { color: var(--dim); }
  .resp { display: inline-block; font-size: 12px; color: var(--dim); margin-top: 4px; }
  .notes { font-size: 13px; color: #334155; margin-top: 4px; line-height: 1.5;
    border-left: 3px solid var(--line); padding-left: 10px; }
  .empty, .muted { color: var(--dim); font-size: 13px; font-style: italic; }
  footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid var(--line);
    font-size: 11px; color: var(--dim); display: flex; justify-content: space-between; }
  /* Márgenes de página controlados. Para quitar la fecha/título que Chrome añade
     arriba y abajo, desmarca "Encabezados y pies de página" en el diálogo de impresión. */
  @page { margin: 14mm 16mm; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="sheet">
    <header>
      <div>
        <div class="brand">Dynamic Devs</div>
        <h1>${esc(name)}</h1>
      </div>
      <div class="doc-type"><strong>ACTA</strong>de reunión</div>
    </header>

    <div class="meta">
      <div class="row"><div class="k">Fecha de la reunión</div><div class="v">${esc(fmtLongDate(acta.meetingDate))}</div></div>
      <div class="row"><div class="k">Proyecto</div><div class="v">${projectName ? esc(projectName) : "—"}</div></div>
    </div>

    ${objective ? `<div class="section-title">Objetivo</div><div class="objective">${nl2br(objective)}</div>` : ""}

    <div class="section-title">Asistentes</div>
    ${peopleHtml}

    <div class="section-title">Puntos tratados</div>
    <ol class="items">${itemsHtml}</ol>

    <footer>
      <span>Generado el ${esc(generated)}</span>
      <span>Dynamic Devs · Gestión de Tareas</span>
    </footer>
  </div>
</body>
</html>`;

  // Imprimimos desde un <iframe> oculto cargado con srcdoc: Chrome lo maneja de
  // forma fiable (no es ventana emergente, no se bloquea) y dispara onload bien.
  // El usuario elige "Guardar como PDF" en el diálogo de impresión.
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";

  let printed = false; // evita imprimir dos veces (onload + fallback)
  const cleanup = () => setTimeout(() => iframe.remove(), 1000);

  const doPrint = () => {
    if (printed) return;
    const win = iframe.contentWindow;
    if (!win) return;
    printed = true;
    try {
      win.focus();
      win.onafterprint = cleanup; // el diálogo es bloqueante; al cerrarse, limpiamos
      win.print();
    } catch (err) {
      console.error("[acta-pdf] fallo al imprimir:", err);
      cleanup();
    }
  };

  iframe.onload = () => {
    // Un pequeño respiro para que Chrome termine de maquetar antes de imprimir.
    setTimeout(doPrint, 60);
  };

  // srcdoc es lo más fiable en Chrome para iframes imprimibles generados en cliente.
  iframe.srcdoc = html;
  document.body.appendChild(iframe);

  // Fallback por si onload no dispara (raro): imprime igualmente tras 600ms.
  setTimeout(doPrint, 600);
}
