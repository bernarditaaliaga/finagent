-- DropForeignKey
ALTER TABLE "FixedExpense" DROP CONSTRAINT IF EXISTS "FixedExpense_categoryId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "FixedExpense_categoryId_idx";

-- AlterTable
ALTER TABLE "FixedExpense" DROP COLUMN IF EXISTS "categoryId";
