# 📋 Gestión de Tareas — Dynamic Devs

Aplicación web personal para organizar el trabajo del día a día: **tareas, reuniones y eventos**, repartidos en
tres apartados (**Trabajo**, **Proyectos personales** y **Estudios**).

La app funciona **en local**, en tu propio equipo: no necesita internet ni servicios externos, y tus datos se
guardan en una base de datos en tu máquina. Está pensada como herramienta de productividad personal, con tres
formas de ver tu trabajo (tablero, lista y calendario), recordatorios para las reuniones y plantillas
reutilizables para preparar el orden del día.

> **¿Para quién es este documento?** Para cualquiera que vaya a instalar, ejecutar o continuar el desarrollo de
> la app. No hace falta conocer el código para ponerla en marcha: sigue la sección
> [Puesta en marcha](#-puesta-en-marcha-primera-vez).

### 🧭 Vistazo rápido

Al abrir la app verás, de izquierda a derecha:

1. **Barra lateral** — los apartados (Trabajo / Personal / Estudios) con el número de ítems en cada uno, y la
   sección **Rúbricas** para gestionar plantillas de reunión.
2. **Cabecera** — el logo de Dynamic Devs, el botón ☀️/🌙 para cambiar entre tema claro y oscuro, y el botón
   **+ Nueva tarea**.
3. **Zona principal** — tarjetas de resumen (totales, completadas, próximas a vencer, vencidas), un selector de
   vista (**Tablero / Lista / Calendario**), buscador, filtros, y el contenido según la vista elegida.

---

## 🧱 Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Backend:** Node + Express + TypeScript (API REST), validación con Zod
- **Base de datos:** SQLite (archivo local) con Prisma ORM
- **Monorepo:** workspaces de npm (`client` + `server`)

---

## ✨ Funcionalidades

### Organización
- **Tres apartados** en la barra lateral: 💼 Trabajo, 🚀 Proyectos personales, 🎓 Estudios, cada uno con su contador.
- **Proyectos / Cursos**: agrupa ítems dentro de un apartado. En Trabajo y Personal se llaman *Proyectos*;
  en Estudios, *Cursos*. Se crean, asignan, filtran y eliminan (al borrar un proyecto, sus tareas no se pierden).
- **Etiquetas** libres, **notas** y **subtareas** con barra de progreso.

### Tipos de ítem
- 📋 **Tarea**: con fecha límite.
- 👥 **Reunión**: fecha + **hora de inicio y fin** (duración) + **modalidad** (📍 presencial / 💻 remoto).
- 📅 **Evento**: rango de varios días (útil para vacaciones, ausencias, conferencias).

### Prioridades y estados
- Prioridades: 🔥 **Urgente** (destacada en rojo con pulso), Alta, Media, Baja.
- Estados: Pendiente, En curso, Hecha. Opción de **ocultar las completadas**.

### Vistas
- **▦ Tablero (Kanban)**: columnas Pendiente / En curso / Hecha con **arrastrar y soltar** entre columnas.
- **☰ Lista**: con búsqueda, ordenación (fecha / prioridad / recientes) y filtros por prioridad.
- **📅 Calendario**: mini-mes navegable + **agenda por bloques de 30 min**. Las reuniones se dibujan con
  altura según su duración; se pueden **arrastrar para mover** y **estirar para cambiar la duración**.
  Clic en una franja libre para **agendar** una reunión.

### Reuniones avanzadas
- **Recordatorios automáticos**: aviso emergente (toast) + **campanita** a los **30, 15 y 5 minutos** antes
  de cada reunión (mientras la app esté abierta).
- **Rúbricas de reunión**: plantillas reutilizables (guion / orden del día) gestionadas en la sección
  **📋 Rúbricas** de la barra lateral. Se asocian a un proyecto y, al crear una reunión, se elige una plantilla
  y se **copia** a esa reunión. Cada punto tiene tipo (• punto / ✅ acuerdo / ➡️ próximo paso), se marca como
  tratado, lleva **notas** y **responsable**, y se reordena. Editar la copia no altera la plantilla.

### 🤖 Asistente de IA (chatbot)
Un botón flotante 🤖 abre un **chat** donde le hablás en lenguaje natural y el asistente crea las cosas por vos.
Funciona con **Ollama** (modelo `minimax-m3:cloud`); la llamada corre en el backend.
- **Crear por lenguaje natural**: escribís *"recordame llamar al cliente mañana, urgente"* o
  *"reunión con el equipo el lunes a las 10, remota"* y el asistente arma la **tarea, reunión o evento** con
  todos sus campos (fecha, hora, prioridad, categoría, modalidad, etiquetas).
- **Proponer y confirmar**: nunca crea nada sin tu visto bueno. Te muestra un **borrador** que podés
  **confirmar**, **editar** (abre el formulario precargado) o **descartar**. También entiende
  *"que sea prioridad alta"*, *"ponela en el proyecto Foundry"* o *"dale, confirmala"*.
- **Genera rúbricas de reunión**: si mencionás una minuta u orden del día
  (*"con minuta para revisar pendientes, ver bloqueos y acordar la entrega"*), crea la rúbrica con los puntos
  ya **clasificados** en punto a tratar / acuerdo / próximo paso.
- **Robusto**: las fechas relativas se resuelven en el servidor; si no entiende algo, **conversa** y pregunta o
  explica qué puede hacer, en vez de fallar.

> Requiere **Ollama** corriendo. Si no está disponible, el chat lo avisa con un mensaje claro (el resto de la app
> funciona igual).

### Interfaz
- **Tema claro / oscuro** con interruptor (recuerda tu preferencia), con los colores de marca de Dynamic Devs.
- Diálogos de confirmación y formularios propios (sin los popups nativos del navegador).

---

## 📁 Estructura

```
GestionTareasSystem/
├── client/                 # Frontend React + Vite
│   └── src/
│       ├── components/     # Board, Calendar, TaskModal, RubricEditor, etc.
│       ├── api.ts          # Cliente de la API REST
│       ├── types.ts        # Tipos e info de presentación
│       └── App.tsx         # Componente raíz
├── server/                 # Backend Express + Prisma
│   ├── src/
│   │   ├── routes/         # tasks, projects, rubrics
│   │   ├── validation.ts   # Esquemas Zod
│   │   └── index.ts        # Servidor Express
│   └── prisma/
│       ├── schema.prisma   # Modelos de datos
│       └── dev.db          # Base SQLite (no se versiona)
└── package.json            # Scripts del monorepo
```

---

## 🚀 Puesta en marcha (primera vez)

Requisitos: **Node 18+** y npm.

```bash
npm install          # instala dependencias (raíz, client y server)
npm run db:migrate   # crea la base de datos SQLite y aplica las migraciones
```

> Opcional: `npm run db:seed --workspace server` carga datos de ejemplo (por defecto el seed está vacío).

## 🖥️ Uso diario

```bash
npm run dev
```

Levanta ambos servicios:
- **Backend (API)** en http://localhost:4000
- **Frontend** en http://localhost:5174 ← **abre esto en el navegador**

En desarrollo el frontend hace proxy de `/api` al backend, así que no hay problemas de CORS.

---

## 📖 Guía de uso paso a paso

**Crear una tarea.** Pulsa **+ Nueva tarea** (arriba a la derecha). Elige el tipo (📋 Tarea), escribe el título,
y completa apartado, prioridad, estado y fecha límite. Puedes añadir etiquetas, notas y subtareas. Guarda.

**Agendar una reunión.** Crea un ítem y elige el tipo **👥 Reunión**. Aparecerán los campos de **fecha**, **hora
de inicio y fin** y **modalidad** (presencial / remoto). Opcionalmente, despliega su **rúbrica** (orden del día).
También puedes agendarla desde la vista **Calendario**: haz clic en una franja horaria libre.

**Registrar un evento de varios días.** Elige el tipo **📅 Evento** e indica fecha de **inicio** y **fin**. Útil
para vacaciones, ausencias o conferencias; se muestra como una franja en el calendario.

**Trabajar con el tablero.** En la vista **▦ Tablero**, **arrastra** las tarjetas entre las columnas
Pendiente / En curso / Hecha para cambiar su estado. El botón ＋ de cada columna crea un ítem ya en ese estado.

**Usar el calendario.** En la vista **📅 Calendario**, navega entre meses, selecciona un día y verás su agenda
por bloques de 30 minutos. Arrastra una reunión para moverla de hora o estira su borde inferior para alargarla.

**Preparar rúbricas de reunión.** En la barra lateral, entra en **📋 Rúbricas** y crea una **plantilla** (un
guion con puntos, acuerdos y próximos pasos), opcionalmente asociada a un proyecto. Luego, al crear una reunión,
elige esa plantilla con **"Usar plantilla…"**: su contenido se copia a la reunión, donde durante la misma marcas
cada punto como tratado, añades notas y asignas responsables. Editar la copia no modifica la plantilla original.

**Recibir recordatorios.** Si tienes la app abierta, recibirás un aviso emergente con sonido a los 30, 15 y 5
minutos antes de cada reunión.

**Organizar por proyectos/cursos.** Dentro de un apartado, crea proyectos (en Estudios se llaman *cursos*) y
asígnalos a tus ítems. Usa el selector superior para filtrar por proyecto.

**Cambiar el tema.** Pulsa ☀️/🌙 en la cabecera para alternar entre claro y oscuro; tu elección se recuerda.

---

## 🛠️ Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta frontend + backend en modo desarrollo |
| `npm run build` | Compila client y server para producción |
| `npm run db:migrate` | Aplica las migraciones de la base de datos |
| `npm run db:studio` | Abre Prisma Studio (ver/editar la DB visualmente) |
| `npm run db:seed --workspace server` | Carga datos de ejemplo (seed) |

---

## 🌐 API REST

Base: `http://localhost:4000/api`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/tasks` | Lista tareas (filtros opcionales: `category`, `state`, `projectId`) |
| `POST` | `/tasks` | Crea una tarea/reunión/evento (rúbrica anidada incluida) |
| `PUT` | `/tasks/:id` | Reemplaza una tarea completa |
| `PATCH` | `/tasks/:id` | Actualización parcial (estado, fechas…) |
| `DELETE` | `/tasks/:id` | Elimina una tarea |
| `GET/POST/PATCH/DELETE` | `/projects` | CRUD de proyectos/cursos |
| `GET/POST/PUT/DELETE` | `/rubrics` | CRUD de plantillas de rúbrica |
| `POST` | `/ai/chat` | Asistente de IA: interpreta el mensaje y propone un borrador de ítem |

Los datos se guardan en `server/prisma/dev.db` y **persisten** entre reinicios.

---

## 🗺️ Roadmap — próximas funcionalidades

Estas son las funcionalidades planificadas para las siguientes versiones. Aún **no están implementadas**;
se documentan aquí para dar visibilidad de la dirección del proyecto.

### 🔔📲 Recordatorios automatizados con IA (email y WhatsApp)
Hoy los recordatorios de reunión son avisos dentro de la app (popup + sonido) y solo funcionan con la pestaña
abierta. El próximo paso es que la **IA envíe recordatorios por canales externos** al usuario que lo active,
para que lleguen aunque la app esté cerrada:
- **Correo electrónico**: aviso a los 30/15/5 min antes de cada reunión. La IA **redacta** el mensaje con el
  orden del día (la rúbrica), objetivo y datos de la reunión, listo para leer.
- **WhatsApp**: notificación al móvil con los datos de la reunión (hora, modalidad, enlace si es remota) y un
  resumen breve generado por IA.
- **Opt-in del usuario**: cada canal se activa/desactiva desde la configuración, eligiendo con cuánta antelación
  avisar. Si el usuario no lo habilita, todo sigue como hasta ahora (solo avisos dentro de la app).
- **Cómo funcionará**: un proceso en el servidor (un *scheduler*/cron) vigila las reuniones próximas, la IA
  compone el texto, y un proveedor de envío lo despacha (correo SMTP/servicio transaccional; API de mensajería
  para WhatsApp).

### 🤖 Más capacidades del asistente de IA
El chatbot ya **crea tareas, reuniones y eventos** y **genera rúbricas** por lenguaje natural (ver
[Asistente de IA](#-asistente-de-ia-chatbot)). Lo que sigue:
- **Lectura y resumen**: preguntar *"¿qué tengo esta semana?"* o *"pendientes urgentes de Trabajo"* y obtener una
  respuesta a partir de los datos de la app.
- **Actas automáticas**: a partir de las notas tomadas durante la reunión, generar un resumen con acuerdos y
  próximos pasos.
- **Crear proyectos/cursos** por lenguaje natural desde el chat.

### 💡 Otras ideas en estudio
- Reordenar puntos de la rúbrica con arrastrar y soltar.
- Vista semanal en el calendario y franjas de 15 minutos.
- Exportar/compartir reuniones y rúbricas (PDF).
- Soporte multiusuario y sincronización en la nube.

---

## 📝 Notas técnicas

- **Base de datos local**: los datos se guardan en `server/prisma/dev.db` (SQLite) y persisten entre reinicios.
  Este archivo está en `.gitignore`, así que **no se versiona**: cada entorno genera su propia base con
  `npm run db:migrate`. Para empezar con datos de ejemplo, ejecuta `npm run db:seed --workspace server`.
- **Windows + Prisma**: si vas a correr `prisma migrate` o `prisma generate`, **detén antes el servidor de
  desarrollo** (`npm run dev`), porque el proceso bloquea el motor de Prisma y la operación fallaría.
- **Puertos**: backend en `4000`, frontend en `5174`. Si alguno está ocupado, cámbialo en
  `server/src/index.ts` (constante `PORT`) y en `client/vite.config.ts` (`server.port` y el `proxy`).

---

## 👤 Autor

Construido por **Mauricio De Juan** — [mdejuan@dynamicdevs.io](mailto:mdejuan@dynamicdevs.io)

## 📄 Licencia

Proyecto de uso interno de **Dynamic Devs**. Todos los derechos reservados.
