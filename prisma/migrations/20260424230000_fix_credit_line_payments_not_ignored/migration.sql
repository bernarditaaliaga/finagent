-- Fix: payments TO credit line are real expenses, should NOT be ignored
-- "Traspaso a: Línea de crédito" = paying back debt = real expense
UPDATE "Transaction" SET "isIgnored" = false WHERE
  LOWER(description) LIKE 'traspaso a:%'
  AND LOWER(description) LIKE '%linea de cred%';
