-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('OPEN', 'LOCKED', 'SETTLED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BetSide" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'BET', 'WIN', 'FEE', 'REFERRAL_REWARD');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "username" TEXT,
    "wallet_address" TEXT NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "balance" DECIMAL(18,9) NOT NULL DEFAULT 0,
    "total_deposited" DECIMAL(18,9) NOT NULL DEFAULT 0,
    "total_withdrawn" DECIMAL(18,9) NOT NULL DEFAULT 0,
    "referral_code" TEXT NOT NULL,
    "referred_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "RoomStatus" NOT NULL DEFAULT 'OPEN',
    "oracle_feed" TEXT NOT NULL,
    "oracle_source" TEXT NOT NULL DEFAULT 'PYTH',
    "cap" INTEGER NOT NULL DEFAULT 10,
    "current_players" INTEGER NOT NULL DEFAULT 0,
    "pool" DECIMAL(18,9) NOT NULL DEFAULT 0,
    "long_pool" DECIMAL(18,9) NOT NULL DEFAULT 0,
    "short_pool" DECIMAL(18,9) NOT NULL DEFAULT 0,
    "min_bet" DECIMAL(18,9) NOT NULL,
    "max_bet" DECIMAL(18,9),
    "lock_time" TIMESTAMP(3) NOT NULL,
    "settle_time" TIMESTAMP(3) NOT NULL,
    "lock_price" DECIMAL(18,9),
    "settle_price" DECIMAL(18,9),
    "winning_side" TEXT,
    "protocol_fee" DECIMAL(18,9) NOT NULL DEFAULT 0,
    "host_fee" DECIMAL(18,9) NOT NULL DEFAULT 0,
    "host_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "side" "BetSide" NOT NULL,
    "amount" DECIMAL(18,9) NOT NULL,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "won" BOOLEAN,
    "payout" DECIMAL(18,9) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,9) NOT NULL,
    "tx_signature" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrer_id" TEXT NOT NULL,
    "referred_id" TEXT NOT NULL,
    "rewards_earned" DECIMAL(18,9) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referrer_id_referred_id_key" ON "referrals"("referrer_id", "referred_id");

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_id_fkey" FOREIGN KEY ("referred_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
