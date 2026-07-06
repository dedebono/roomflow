-- Migration: add_waha_config
-- Applied manually to production DB

CREATE TABLE IF NOT EXISTS "WahaConfig" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "wahaUrl" TEXT,
    "wahaSession" TEXT NOT NULL DEFAULT 'default',
    "wahaApiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed with default row if empty
INSERT INTO "WahaConfig" (id, enabled, "wahaSession")
VALUES (gen_random_uuid(), true, 'default')
ON CONFLICT DO NOTHING;