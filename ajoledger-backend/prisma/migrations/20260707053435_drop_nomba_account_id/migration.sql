/*
  Warnings:

  - You are about to drop the column `nomba_account_id` on the `savings_groups` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "savings_groups_nomba_account_id_key";

-- AlterTable
ALTER TABLE "savings_groups" DROP COLUMN "nomba_account_id";
