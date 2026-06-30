import { useState } from "react";

interface QA {
  q: string;
  a: string;
}

// Preguntas frecuentes que explican el software. Agrupadas por tema.
const SECTIONS: { title: string; icon: string; items: QA[] }[] = [
  {
    title: "Lo básico",
    icon: "🚀",
    items: [
      {
        q: "¿Qué es esta aplicación?",
        a: "Un gestor personal de tareas, reuniones y eventos, organizados en tres apartados: 💼 Trabajo, 🚀 Proyectos personales y 🎓 Estudios. Funciona en tu equipo, sin necesidad de internet; los datos se guardan en una base local.",
      },
      {
        q: "¿Qué tipos de ítems puedo crear?",
        a: "Tres: 📋 Tarea (con fecha límite), 👥 Reunión (con hora de inicio/fin y modalidad presencial o remota) y 📅 Evento (un rango de varios días, útil para vacaciones, viajes o conferencias).",
      },
      {
        q: "¿Cómo creo una tarea?",
        a: "Pulsa '+ Nueva tarea' arriba a la derecha, elige el tipo, escribe el título y completa apartado, prioridad, estado y fecha. Puedes añadir etiquetas, notas y subtareas.",
      },
    ],
  },
  {
    title: "Vistas y organización",
    icon: "🗂️",
    items: [
      {
        q: "¿Qué vistas hay?",
        a: "▦ Tablero (Kanban con arrastrar y soltar entre Pendiente / En curso / Hecha), ☰ Lista (con búsqueda, orden y filtros) y 📅 Calendario (mini-mes + agenda por bloques de 30 min, donde puedes mover y estirar reuniones).",
      },
      {
        q: "¿Qué son los proyectos y cursos?",
        a: "Agrupan ítems dentro de un apartado. En Trabajo y Personal se llaman Proyectos; en Estudios, Cursos. Si borras un proyecto, sus tareas no se pierden: solo quedan sin proyecto.",
      },
      {
        q: "¿Cómo cambio entre tema claro y oscuro?",
        a: "Con el botón ☀️/🌙 de la cabecera. La app recuerda tu preferencia.",
      },
    ],
  },
  {
    title: "Reuniones y actas",
    icon: "📝",
    items: [
      {
        q: "¿Qué es un acta?",
        a: "El registro independiente de una reunión: tiene nombre, fecha, personas involucradas y los puntos tratados. Se gestionan en la sección 📝 Actas y, si quieres, se asocian a un proyecto. Cada punto se clasifica en • punto a tratar, ✅ acuerdo o ➡️ próximo paso.",
      },
      {
        q: "¿Las actas dependen de una reunión?",
        a: "No. Las actas son entidades autónomas: las creas y editas directamente en la sección Actas, sin necesidad de crear una reunión. Una reunión y un acta son cosas separadas.",
      },
      {
        q: "¿Puedo añadir puntos a una reunión?",
        a: "Sí, pero es opcional. Al crear una reunión puedes fijar algunos puntos (orden del día) si quieres, o dejarlo vacío. No hay plantillas que aplicar: los puntos son propios de esa reunión.",
      },
      {
        q: "¿Recibo recordatorios de las reuniones?",
        a: "Sí: con la app abierta, aparece un aviso emergente con sonido y campanita a los 30, 15 y 5 minutos antes de cada reunión.",
      },
    ],
  },
  {
    title: "Asistente de IA",
    icon: "🤖",
    items: [
      {
        q: "¿Qué hace el asistente (botón 🤖)?",
        a: "Entiende lenguaje natural y te ayuda a crear y consultar. Por ejemplo: 'recordar llamar al cliente mañana, urgente' o 'reunión con el equipo el lunes a las 10, remota'. Siempre te muestra un borrador para confirmar, editar o descartar antes de crear nada.",
      },
      {
        q: "¿Qué le puedo preguntar?",
        a: "Por lo que ya tienes anotado: '¿qué tengo esta semana?', 'pendientes urgentes de Trabajo', '¿qué hay vencido?', '¿tengo actas?'. Responde con tus datos reales, nunca inventa.",
      },
      {
        q: "¿Puede crear proyectos y actas?",
        a: "Sí. Puedes pedirle 'crea un proyecto llamado Foundry' o 'crea un acta de daily standup para el proyecto Foundry'. Para las actas te guía paso a paso (nombre, proyecto, descripción y puntos) antes de crearla.",
      },
      {
        q: "Necesita Ollama, ¿qué pasa si no está?",
        a: "El asistente de IA usa Ollama corriendo en tu equipo. Si no está disponible, el chat te avisa con un mensaje claro y el resto de la aplicación sigue funcionando con normalidad.",
      },
      {
        q: "¿Cómo instalo Ollama si no lo tengo?",
        a: "1) Descarga Ollama desde ollama.com/download (Windows, macOS o Linux) e instálalo. 2) Abre la app de Ollama; queda corriendo en segundo plano en http://localhost:11434. 3) Descarga el modelo que usa el asistente ejecutando en una terminal: ollama pull minimax-m3:cloud. 4) Vuelve al chat 🤖 y prueba; si Ollama está activo, ya responde. No hace falta configurar nada más.",
      },
      {
        q: "¿Cómo sé si Ollama está corriendo?",
        a: "Abre http://localhost:11434 en el navegador: si ves el texto 'Ollama is running', está activo. En Windows/macOS también aparece su ícono en la barra de tareas. Si el chat da un error de conexión, abre la app de Ollama y reinténtalo.",
      },
    ],
  },
];

function Item({ qa }: { qa: QA }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="surface rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-fg hover:bg-surface-soft/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{qa.q}</span>
        <span className={`text-fg-dim transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {open && <div className="px-4 pb-3 text-sm text-fg-dim leading-relaxed">{qa.a}</div>}
    </div>
  );
}

// Sección de preguntas frecuentes que explica todo el software.
export default function Faq() {
  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-fg">Preguntas frecuentes</h2>
        <p className="text-sm text-fg-dim">Todo lo que puedes hacer con la aplicación, explicado.</p>
      </div>

      <div className="space-y-6">
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <h3 className="text-sm font-semibold text-fg mb-2 flex items-center gap-2">
              <span>{s.icon}</span> {s.title}
            </h3>
            <div className="space-y-2">
              {s.items.map((qa) => (
                <Item key={qa.q} qa={qa} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
