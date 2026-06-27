# 📋 Gestión de Tareas — Dynamic Devs

Aplicación web personal para organizar el trabajo del día a día: **tareas, reuniones y eventos**, repartidos en
tres apartados (**Trabajo**, **Proyectos personales** y **Estudios**).

La aplicación funciona **en local**, en el propio equipo: no necesita internet ni servicios externos, y los datos
se guardan en una base de datos en la máquina del usuario. Está pensada como herramienta de productividad
personal, con tres formas de visualizar el trabajo (tablero, lista y calendario), recordatorios para las
reuniones, rúbricas reutilizables para preparar el orden del día y un **asistente de IA** que crea y consulta
ítems en lenguaje natural.

> **¿Para quién es este documento?** Para cualquier persona que vaya a instalar, ejecutar o continuar el
> desarrollo de la aplicación. No hace falta conocer el código para ponerla en marcha: basta con seguir la
> sección [Puesta en marcha](#-puesta-en-marcha-primera-vez).

### 🧭 Vistazo rápido

Al abrir la aplicación se muestra, de izquierda a derecha:

1. **Barra lateral** — los apartados (Trabajo / Personal / Estudios) con el número de ítems en cada uno, y la
   sección **Herramientas** con **📋 Rúbricas** (guiones reutilizables para reuniones) y **❓ FAQ / Ayuda**
   (preguntas frecuentes que explican toda la aplicación).
2. **Cabecera** — el logo de Dynamic Devs, el botón ☀️/🌙 para cambiar entre tema claro y oscuro, y el botón
   **+ Nueva tarea**.
3. **Zona principal** — tarjetas de resumen (totales, completadas, próximas a vencer, vencidas), un selector de
   vista (**Tablero / Lista / Calendario**), buscador, filtros, y el contenido según la vista elegida.
4. **Botón flotante 🤖** (abajo a la derecha) — abre el **asistente de IA** en un panel lateral.

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
- **Rúbricas**: guiones reutilizables (orden del día) gestionados en la sección **📋 Rúbricas** de la barra
  lateral. Cada rúbrica es **independiente** y se puede **asociar a un proyecto**; tiene un nombre, una
  descripción/objetivo y una lista de puntos clasificados (• punto a tratar / ✅ acuerdo / ➡️ próximo paso).
  Al crear una reunión se elige una rúbrica con **"Usar plantilla…"** y se **copia** a esa reunión, donde cada
  punto se marca como tratado, lleva **notas** y **responsable**, y se reordena. Editar la copia no altera la
  rúbrica original. También se pueden crear rúbricas desde el **asistente de IA** (ver abajo).
- **Acta de reunión**: distinta de la rúbrica. La rúbrica se prepara de antemano (vive en la sección Rúbricas);
  el **acta** es el resumen de lo hablado y se genera *dentro* de una reunión concreta, enlazada a ella.

### 🤖 Asistente de IA (chatbot)
Un botón flotante 🤖 abre un **chat** donde se le habla en lenguaje natural y el asistente crea los ítems por el
usuario. Funciona con **Ollama** (modelo `minimax-m3:cloud`); la llamada se ejecuta en el backend.
- **Crear por lenguaje natural**: al escribir *"recordar llamar al cliente mañana, urgente"* o
  *"reunión con el equipo el lunes a las 10, remota"*, el asistente arma la **tarea, reunión o evento** con
  todos sus campos (fecha, hora, prioridad, categoría, modalidad, etiquetas).
- **Proponer y confirmar**: nunca crea nada sin aprobación. Muestra un **borrador** que se puede
  **confirmar**, **editar** (abre el formulario precargado) o **descartar**. También entiende instrucciones como
  *"que sea prioridad alta"*, *"asignarla al proyecto Foundry"* o *"confírmala"*.
- **Consulta y resume tus ítems**: pregúntale *"¿qué tengo esta semana?"*, *"pendientes urgentes de Trabajo"*,
  *"¿qué reuniones tengo hoy?"*, *"¿qué tengo la semana que viene?"* o *"¿qué hay vencido?"* y responde con la
  lista real de la app. Los filtros (apartado, prioridad, tipo, estado, hoy/semana/semana próxima/mes/vencidas
  y rangos de fechas concretas) y el conteo se calculan en el servidor a partir de tus datos, así que las cifras
  son **siempre fieles** y nunca inventa ítems.
- **Crea proyectos y cursos por lenguaje natural**: *"crea un proyecto llamado Foundry"* o *"nuevo curso de
  inglés en Estudios"*. Detecta el apartado (los *cursos* van a Estudios) y evita duplicados.
- **Asistente secuencial de rúbricas**: al pedir *"crea una rúbrica"*, te guía **paso a paso** preguntando
  nombre → proyecto (si no existe, ofrece **crearlo**) → descripción/objetivo → puntos a tratar → acuerdos →
  próximos pasos → confirmación. En cualquier momento puedes decir *"editar nombre"* (o el campo que sea) para
  volver a ese paso, o *"cancelar"*. Si ya diste algún dato al inicio, se saltan esos pasos. Antes de crearla
  muestra un **resumen** para confirmar.
- **Robusto**: las fechas relativas se resuelven en el servidor; si no entiende algo, **conversa** y pregunta o
  explica qué puede hacer, en lugar de fallar. Responde siempre en español neutro.

Además, dentro de la rúbrica de una reunión hay dos asistentes de IA:
- **✨ Sugerir con IA**: genera un orden del día (3-6 puntos clasificados) a partir del título y el objetivo de la
  reunión. Se añaden a los puntos existentes y se pueden editar o borrar.
- **📝 Generar acta**: a partir de las notas y responsables de los puntos tratados, redacta un acta con
  **resumen, acuerdos y próximos pasos**. El acta se puede editar, copiar o volcar a las notas de la reunión.

> Requiere **Ollama** en ejecución. Si no está disponible, el chat lo avisa con un mensaje claro (el resto de la
> aplicación funciona igual).

### Interfaz
- **Tema claro / oscuro** con interruptor (recuerda tu preferencia), con los colores de marca de Dynamic Devs.
- Diálogos de confirmación y formularios propios (sin los popups nativos del navegador).
- **❓ FAQ / Ayuda**: sección en la barra lateral (debajo de Rúbricas) con preguntas frecuentes plegables que
  explican todo el software, incluida la diferencia entre rúbrica y acta y **cómo instalar Ollama**.

---

## 📁 Estructura

```
GestionTareasSystem/
├── client/                 # Frontend React + Vite
│   └── src/
│       ├── components/     # Board, Calendar, TaskModal, RubricManager,
│       │                   #   RubricEditor, ChatPanel, Faq, Sidebar, etc.
│       ├── api.ts          # Cliente de la API REST
│       ├── types.ts        # Tipos e info de presentación
│       └── App.tsx         # Componente raíz
├── server/                 # Backend Express + Prisma
│   ├── src/
│   │   ├── routes/         # tasks, projects, rubrics, ai
│   │   ├── ai/             # Integración con Ollama:
│   │   │                   #   ollamaClient, aiSchema, dateResolver, rubricAi
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
- **Frontend** en http://localhost:5174 ← **abrir esta dirección en el navegador**

En desarrollo el frontend hace proxy de `/api` al backend, así que no hay problemas de CORS.

---

## 🤖 Configurar el asistente de IA (Ollama)

El asistente de IA es **opcional**: el resto de la aplicación funciona sin él. Si quieres usar el chatbot 🤖,
necesitas **Ollama** corriendo en tu equipo:

1. Descarga e instala Ollama desde **https://ollama.com/download** (Windows, macOS o Linux).
2. Abre la app de Ollama; queda corriendo en segundo plano en `http://localhost:11434`.
3. Descarga el modelo que usa el asistente:
   ```bash
   ollama pull minimax-m3:cloud
   ```
4. Abre el chat 🤖 en la aplicación y pruébalo. Si Ollama está activo, ya responde.

> ¿Cómo saber si está corriendo? Abre `http://localhost:11434` en el navegador: si ves *"Ollama is running"*,
> está activo. Si el chat muestra un error de conexión, abre la app de Ollama y reinténtalo. El modelo se
> configura en `server/src/ai/ollamaClient.ts` (constante `MODEL`).

---

## 📖 Guía de uso paso a paso

**Crear una tarea.** Pulsar **+ Nueva tarea** (arriba a la derecha). Seleccionar el tipo (📋 Tarea), escribir el
título y completar apartado, prioridad, estado y fecha límite. Se pueden añadir etiquetas, notas y subtareas.
Guardar.

**Agendar una reunión.** Crear un ítem y seleccionar el tipo **👥 Reunión**. Aparecen los campos de **fecha**,
**hora de inicio y fin** y **modalidad** (presencial / remoto). Opcionalmente, desplegar su **rúbrica** (orden
del día). También se puede agendar desde la vista **Calendario**, haciendo clic en una franja horaria libre.

**Registrar un evento de varios días.** Seleccionar el tipo **📅 Evento** e indicar fecha de **inicio** y
**fin**. Útil para vacaciones, ausencias o conferencias; se muestra como una franja en el calendario.

**Trabajar con el tablero.** En la vista **▦ Tablero**, **arrastrar** las tarjetas entre las columnas
Pendiente / En curso / Hecha para cambiar su estado. El botón ＋ de cada columna crea un ítem ya en ese estado.

**Usar el calendario.** En la vista **📅 Calendario**, navegar entre meses y seleccionar un día para ver su
agenda por bloques de 30 minutos. Arrastrar una reunión para moverla de hora, o estirar su borde inferior para
alargarla.

**Preparar rúbricas.** En la barra lateral, entrar en **📋 Rúbricas** y crear una (un guion con puntos,
acuerdos y próximos pasos), con nombre, descripción/objetivo y, opcionalmente, un proyecto asociado. Luego, al
crear una reunión, seleccionar esa rúbrica con **"Usar plantilla…"**: su contenido se copia a la reunión, donde
durante la misma se marca cada punto como tratado, se añaden notas y se asignan responsables. Editar la copia no
modifica la rúbrica original. También se puede crear una rúbrica desde el asistente de IA (ver abajo).

**Usar el asistente de IA.** Pulsar el botón flotante **🤖** (abajo a la derecha). En lenguaje natural se puede:
crear tareas/reuniones/eventos (*"reunión con el equipo el lunes a las 10, remota"*), consultar lo anotado
(*"¿qué tengo esta semana?"*), crear proyectos (*"crea un proyecto llamado Foundry"*) o crear una rúbrica paso a
paso (*"crea una rúbrica"*). Requiere Ollama (ver [Configurar el asistente de IA](#-configurar-el-asistente-de-ia-ollama)).

**Recibir recordatorios.** Con la aplicación abierta, se muestra un aviso emergente con sonido a los 30, 15 y 5
minutos antes de cada reunión.

**Organizar por proyectos/cursos.** Dentro de un apartado, crear proyectos (en Estudios se llaman *cursos*) y
asignarlos a los ítems. El selector superior permite filtrar por proyecto.

**Resolver dudas.** En la barra lateral, **❓ FAQ / Ayuda** reúne preguntas frecuentes que explican toda la
aplicación.

**Cambiar el tema.** Pulsar ☀️/🌙 en la cabecera para alternar entre claro y oscuro; la elección se recuerda.

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
| `GET/POST/PUT/DELETE` | `/rubrics` | CRUD de rúbricas (filtro opcional: `projectId`) |
| `POST` | `/ai/chat` | Asistente de IA: propone un borrador de ítem, responde consultas/resúmenes, crea proyectos o inicia el asistente de rúbricas |
| `POST` | `/ai/rubric-flow` | Asistente secuencial de rúbricas: avanza un paso del flujo (nombre → proyecto → … → confirmar) |
| `POST` | `/ai/suggest-rubric` | Sugiere puntos del orden del día de una reunión |
| `POST` | `/ai/minutes` | Genera el acta de una reunión a partir de sus puntos y notas |

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
El chatbot ya **crea tareas, reuniones y eventos**, **consulta y resume** tus ítems, **crea proyectos/cursos** y
**crea rúbricas paso a paso** por lenguaje natural; dentro de la rúbrica la IA **sugiere el orden del día** y
**redacta el acta** (ver [Asistente de IA](#-asistente-de-ia-chatbot)). Próximas ideas:
- **Editar y completar ítems desde el chat**: *"marca como hecha la tarea del informe"* o *"pospón la reunión
  al jueves"*.

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
- **Windows + Prisma**: antes de ejecutar `prisma migrate` o `prisma generate`, **detener el servidor de
  desarrollo** (`npm run dev`), porque el proceso bloquea el motor de Prisma y la operación fallaría.
- **Puertos**: backend en `4000`, frontend en `5174`. Si alguno está ocupado, se puede cambiar en
  `server/src/index.ts` (constante `PORT`) y en `client/vite.config.ts` (`server.port` y el `proxy`).

---

## 👤 Autor

Construido por **Mauricio De Juan** — [mdejuan@dynamicdevs.io](mailto:mdejuan@dynamicdevs.io)

## 📄 Licencia

Proyecto de uso interno de **Dynamic Devs**. Todos los derechos reservados.
