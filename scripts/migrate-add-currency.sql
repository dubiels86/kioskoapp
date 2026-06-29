-- Migración para agregar campos de moneda a datos existentes

-- 1. Actualizar productos existentes con moneda ARS por defecto
UPDATE Product SET costCurrency = 'ARS', saleCurrency = 'ARS' WHERE costCurrency IS NULL OR saleCurrency IS NULL;

-- 2. Actualizar compras existentes con moneda ARS y tipo de cambio 1
UPDATE Purchase SET currencyCode = 'ARS', exchangeRate = 1 WHERE currencyCode IS NULL OR exchangeRate IS NULL;

-- 3. Actualizar items de compra con moneda de la compra padre
-- Primero, obtener las compras con sus monedas
WITH PurchaseCurrencies AS (
  SELECT id, currencyCode, exchangeRate FROM Purchase
)
UPDATE PurchaseItem 
SET costCurrency = COALESCE(
  (SELECT currencyCode FROM PurchaseCurrencies WHERE id = PurchaseItem.purchaseId), 
  'ARS'
), 
exchangeRate = COALESCE(
  (SELECT exchangeRate FROM PurchaseCurrencies WHERE id = PurchaseItem.purchaseId), 
  1
)
WHERE costCurrency IS NULL OR exchangeRate IS NULL;

-- 4. Verificar resultados
SELECT 'Productos actualizados:' AS description, COUNT(*) AS count FROM Product WHERE costCurrency = 'ARS' AND saleCurrency = 'ARS'
UNION ALL
SELECT 'Compras actualizadas:' AS description, COUNT(*) AS count FROM Purchase WHERE currencyCode = 'ARS' AND exchangeRate = 1
UNION ALL
SELECT 'Items de compra actualizados:' AS description, COUNT(*) AS count FROM PurchaseItem WHERE costCurrency IS NOT NULL AND exchangeRate IS NOT NULL;