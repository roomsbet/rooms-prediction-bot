-- AlterTable: Add chatId column to rooms table
ALTER TABLE "rooms" ADD COLUMN "chat_id" TEXT;

-- CreateTable: ChatPool for managing reusable Telegram groups
CREATE TABLE "chat_pool" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'FREE',
    "room_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_pool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on chat_id
CREATE UNIQUE INDEX "chat_pool_chat_id_key" ON "chat_pool"("chat_id");

