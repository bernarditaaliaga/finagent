-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "isIgnored" BOOLEAN NOT NULL DEFAULT false;

-- Auto-ignore existing noise transactions
UPDATE "Transaction" SET "isIgnored" = true WHERE
  LOWER(description) LIKE '%linea de cred%'
  OR LOWER(description) LIKE '%linea de credito%'
  OR LOWER(description) LIKE '%transferencia desde linea%'
  OR LOWER(description) LIKE '%amortizacion a linea%'
  OR LOWER(description) LIKE '%traspaso a:%'
  OR LOWER(description) LIKE '%traspaso de:%';
