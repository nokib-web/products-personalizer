-- CreateTable
CREATE TABLE "CustomizableProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mockupImageUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CustomizationOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customizableProductId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT NOT NULL,
    "printAreaX" REAL NOT NULL DEFAULT 0,
    "printAreaY" REAL NOT NULL DEFAULT 0,
    "printAreaWidth" REAL NOT NULL DEFAULT 200,
    "printAreaHeight" REAL NOT NULL DEFAULT 200,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CustomizationOption_customizableProductId_fkey" FOREIGN KEY ("customizableProductId") REFERENCES "CustomizableProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DesignSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customizableProductId" TEXT NOT NULL,
    "shopifyOrderId" TEXT,
    "shopifyLineItemId" TEXT,
    "designData" TEXT NOT NULL,
    "previewImageUrl" TEXT NOT NULL,
    "hiResImageUrl" TEXT,
    "customerNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DesignSubmission_customizableProductId_fkey" FOREIGN KEY ("customizableProductId") REFERENCES "CustomizableProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
