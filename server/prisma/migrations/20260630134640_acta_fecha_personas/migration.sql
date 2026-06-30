-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RubricTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL DEFAULT '',
    "meetingDate" DATETIME,
    "people" TEXT NOT NULL DEFAULT '',
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RubricTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RubricTemplate" ("createdAt", "id", "name", "objective", "projectId") SELECT "createdAt", "id", "name", "objective", "projectId" FROM "RubricTemplate";
DROP TABLE "RubricTemplate";
ALTER TABLE "new_RubricTemplate" RENAME TO "RubricTemplate";
CREATE INDEX "RubricTemplate_projectId_idx" ON "RubricTemplate"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
