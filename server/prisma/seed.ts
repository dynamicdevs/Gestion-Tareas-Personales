import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Seed vacío: la base de datos arranca sin datos de ejemplo.
// Añade aquí registros con prisma.task.create(...) si quieres datos de prueba.
async function main() {
  console.log("Seed vacío: no se crean datos de ejemplo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
