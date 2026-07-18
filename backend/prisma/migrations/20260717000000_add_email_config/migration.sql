-- Migration: add_email_config
-- Applied manually to production DB

CREATE TABLE IF NOT EXISTS "EmailConfig" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "host" TEXT,
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "user" TEXT,
    "pass" TEXT,
    "fromAddress" TEXT NOT NULL DEFAULT 'noreply@roomflow.local',
    "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);
