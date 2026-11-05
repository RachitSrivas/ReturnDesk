-- Migration: add partial unique index for live return requests
-- This index enforces that at most one active (OPEN, IN_REVIEW, APPROVED) request exists per orderNumber/itemSku pair.
-- Soft‑deleted rows (removedAt IS NOT NULL) are excluded.
CREATE UNIQUE INDEX "unique_live_order_item" ON "ReturnRequest" ("orderNumber", "itemSku")
WHERE "status" IN ('OPEN','IN_REVIEW','APPROVED') AND "removedAt" IS NULL;
