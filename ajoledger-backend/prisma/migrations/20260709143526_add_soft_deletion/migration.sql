-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletion_otp_expires_at" TIMESTAMP(3),
ADD COLUMN     "deletion_otp_hash" TEXT,
ADD COLUMN     "deletion_reason" TEXT,
ADD COLUMN     "is_deactivated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduled_deletion_date" TIMESTAMP(3);
