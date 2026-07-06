/*
  Warnings:

  - You are about to drop the column `nomba_reference` on the `payouts` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[merchant_tx_ref]` on the table `payouts` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "memberships" ALTER COLUMN "payout_turn" DROP NOT NULL;

-- AlterTable
ALTER TABLE "payouts" DROP COLUMN "nomba_reference",
ADD COLUMN     "merchant_tx_ref" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payouts_merchant_tx_ref_key" ON "payouts"("merchant_tx_ref");
