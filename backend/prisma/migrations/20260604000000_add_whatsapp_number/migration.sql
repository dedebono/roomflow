-- Add whatsappNumber column to User model
ALTER TABLE "User" ADD COLUMN "whatsappNumber" TEXT;

-- Unique index
CREATE UNIQUE INDEX "User_whatsappNumber_key" ON "User"("whatsappNumber");
