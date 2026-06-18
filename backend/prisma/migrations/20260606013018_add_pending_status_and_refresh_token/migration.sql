-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "refreshToken" TEXT;

-- CreateIndex
CREATE INDEX "ChatMessage_bookingId_idx" ON "ChatMessage"("bookingId");
