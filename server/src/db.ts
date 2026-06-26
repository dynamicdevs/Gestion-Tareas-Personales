import { PrismaClient } from "@prisma/client";

// Instancia única de Prisma reutilizada en toda la app.
export const prisma = new PrismaClient();
