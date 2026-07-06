/*
  Warnings:

  - Added the required column `default_contribution_amount_kobo` to the `savings_groups` table without a default value. This is not possible if the table is not empty.
  - Added the required column `frequency` to the `savings_groups` table without a default value. This is not possible if the table is not empty.
  - Added the required column `max_participants` to the `savings_groups` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ContributionFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "savings_groups" ADD COLUMN     "default_contribution_amount_kobo" INTEGER NOT NULL,
ADD COLUMN     "frequency" "ContributionFrequency" NOT NULL,
ADD COLUMN     "max_participants" INTEGER NOT NULL;
