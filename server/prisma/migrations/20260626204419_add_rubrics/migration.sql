-- CreateTable
CREATE TABLE "RubricTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL DEFAULT '',
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RubricTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RubricTemplateItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'punto',
    "order" INTEGER NOT NULL DEFAULT 0,
    "templateId" TEXT NOT NULL,
    CONSTRAINT "RubricTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RubricTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetingRubric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "objective" TEXT NOT NULL DEFAULT '',
    "sourceId" TEXT,
    "taskId" TEXT NOT NULL,
    CONSTRAINT "MeetingRubric_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetingRubricItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'punto',
    "order" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "responsible" TEXT NOT NULL DEFAULT '',
    "rubricId" TEXT NOT NULL,
    CONSTRAINT "MeetingRubricItem_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "MeetingRubric" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RubricTemplate_projectId_idx" ON "RubricTemplate"("projectId");

-- CreateIndex
CREATE INDEX "RubricTemplateItem_templateId_idx" ON "RubricTemplateItem"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingRubric_taskId_key" ON "MeetingRubric"("taskId");

-- CreateIndex
CREATE INDEX "MeetingRubricItem_rubricId_idx" ON "MeetingRubricItem"("rubricId");
