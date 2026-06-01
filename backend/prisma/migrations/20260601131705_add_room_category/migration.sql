-- CreateEnum
CREATE TYPE "RoomCategory" AS ENUM ('EVENT', 'SPORT');

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "category" "RoomCategory";
