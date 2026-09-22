-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "approach" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "challenge" TEXT,
ADD COLUMN     "outcome" TEXT;

