-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Bean" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "roaster" TEXT,
    "weightGrams" REAL NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Brew" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "beanId" TEXT NOT NULL,
    "grindAmountGrams" REAL NOT NULL,
    "milkFrothed" BOOLEAN NOT NULL DEFAULT false,
    "brewStyle" TEXT NOT NULL DEFAULT 'CLASSIC',
    "label" TEXT,
    "brewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Brew_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Brew_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FavoriteSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "grindAmountGrams" REAL NOT NULL,
    "milkFrothed" BOOLEAN NOT NULL DEFAULT false,
    "brewStyle" TEXT NOT NULL DEFAULT 'CLASSIC',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FavoriteSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- CreateIndex
CREATE INDEX "Brew_userId_idx" ON "Brew"("userId");

-- CreateIndex
CREATE INDEX "Brew_beanId_idx" ON "Brew"("beanId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteSetting_userId_label_key" ON "FavoriteSetting"("userId", "label");
