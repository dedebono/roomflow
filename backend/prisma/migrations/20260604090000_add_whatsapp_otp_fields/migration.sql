ALTER TABLE "User" ADD COLUMN "whatsappVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "whatsappOtpCode" TEXT;
ALTER TABLE "User" ADD COLUMN "whatsappOtpExpiresAt" TIMESTAMP(3);
