-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'tarea',
    "category" TEXT NOT NULL DEFAULT 'Trabajo',
    "priority" TEXT NOT NULL DEFAULT 'media',
    "state" TEXT NOT NULL DEFAULT 'pendiente',
    "due" DATETIME,
    "endDate" DATETIME,
    "modality" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("category", "createdAt", "due", "id", "notes", "priority", "projectId", "state", "title", "updatedAt") SELECT "category", "createdAt", "due", "id", "notes", "priority", "projectId", "state", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_category_idx" ON "Task"("category");
CREATE INDEX "Task_state_idx" ON "Task"("state");
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
