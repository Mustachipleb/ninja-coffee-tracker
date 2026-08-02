/*
  Warnings:

  - You are about to drop the column `grindAmountGrams` on the `Brew` table. All the data in the column will be lost.
  - You are about to drop the column `milkFrothed` on the `Brew` table. All the data in the column will be lost.
  - You are about to drop the column `grindAmountGrams` on the `FavoriteSetting` table. All the data in the column will be lost.
  - You are about to drop the column `milkFrothed` on the `FavoriteSetting` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "MilkType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "pricePerLiterCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Brew" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "beanId" TEXT NOT NULL,
    "basketSize" TEXT NOT NULL DEFAULT 'DOUBLE',
    "milkTypeId" TEXT,
    "milkVolumeMl" REAL,
    "brewStyle" TEXT NOT NULL DEFAULT 'CLASSIC',
    "label" TEXT,
    "brewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Brew_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Brew_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Brew_milkTypeId_fkey" FOREIGN KEY ("milkTypeId") REFERENCES "MilkType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Brew" ("beanId", "brewStyle", "brewedAt", "id", "label", "userId") SELECT "beanId", "brewStyle", "brewedAt", "id", "label", "userId" FROM "Brew";
DROP TABLE "Brew";
ALTER TABLE "new_Brew" RENAME TO "Brew";
CREATE INDEX "Brew_userId_idx" ON "Brew"("userId");
CREATE INDEX "Brew_beanId_idx" ON "Brew"("beanId");
CREATE INDEX "Brew_milkTypeId_idx" ON "Brew"("milkTypeId");
CREATE TABLE "new_FavoriteSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "basketSize" TEXT NOT NULL DEFAULT 'DOUBLE',
    "milkTypeId" TEXT,
    "milkVolumeMl" REAL,
    "brewStyle" TEXT NOT NULL DEFAULT 'CLASSIC',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FavoriteSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FavoriteSetting_milkTypeId_fkey" FOREIGN KEY ("milkTypeId") REFERENCES "MilkType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FavoriteSetting" ("brewStyle", "createdAt", "id", "label", "userId") SELECT "brewStyle", "createdAt", "id", "label", "userId" FROM "FavoriteSetting";
DROP TABLE "FavoriteSetting";
ALTER TABLE "new_FavoriteSetting" RENAME TO "FavoriteSetting";
CREATE INDEX "FavoriteSetting_milkTypeId_idx" ON "FavoriteSetting"("milkTypeId");
CREATE UNIQUE INDEX "FavoriteSetting_userId_label_key" ON "FavoriteSetting"("userId", "label");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MilkType_name_key" ON "MilkType"("name");
