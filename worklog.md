---
Task ID: 1
Agent: Main Agent
Task: Add product photo update capability from inventory module

Work Log:
- Reviewed existing codebase: Product model already has `image` field (Base64 data URL), ProductFormDialog already had image upload, API routes already support image via PUT
- Created new `ProductImageDialog` component (`src/components/inventory/product-image-dialog.tsx`) with: drag-and-drop upload, file selection, image preview with remove option, save/cancel buttons
- Updated `inventory-view.tsx` to: import ProductImageDialog and Camera icon, add state for image dialog (imageDialogOpen, imageProduct), make thumbnail clickable with camera overlay on hover, add ProductImageDialog to component tree
- Thumbnail shows camera icon overlay on hover for products with images, and camera icon placeholder for products without images
- Clicking thumbnail opens dedicated image upload dialog for that product
- Browser verification confirmed: app loads, inventory shows products with camera placeholders, clicking thumbnails opens image dialog correctly

Stage Summary:
- Created `src/components/inventory/product-image-dialog.tsx` - dedicated dialog for quick product photo update with drag-and-drop
- Updated `src/components/inventory/inventory-view.tsx` - clickable thumbnails with camera overlay
- No schema changes needed - `image` field already existed
- No API changes needed - PUT `/api/products/[id]` already supported image updates
- Lint passed, browser verification passed

---
Task ID: 3
Agent: Main Agent
Task: Add POS type configuration (Kiosko/Cafetería) with table support

Work Log:
- Added `tableNumber` (Int?) field to Sale model in Prisma schema
- Re-added SalePayment model to Prisma schema (was missing)
- Ran db:push to sync schema changes
- Added `pos_type` and `pos_tables` settings to settings API defaults (group: 'pos')
- Added PosType type, posType/posTables/selectedTable state to Zustand store
- Rewrote GeneralTab in settings with:
  - POS Type selector: two selectable cards (Kiosko with ShoppingBag icon, Cafetería with Coffee icon)
  - Cantidad de Mesas input (disabled when Kiosko, enabled when Cafetería)
  - Visual feedback: amber highlight for Cafetería, slate for Kiosko
  - Saves pos_type and pos_tables to settings API, syncs store on save
- Updated POS view (pos-view.tsx):
  - Fetches settings on mount to sync POS type with server
  - Shows table selector (grid of numbered buttons) when in Cafetería mode
  - Selected table shown with amber highlight (#N)
  - Table selection required before payment in Cafetería mode
  - Passes tableNumber to sales API
- Rewrote PaymentDialog with:
  - Multi-payment support (PaymentEntry array with method+amount)
  - Add/remove payment entries, "Resto" fill button
  - Cash received + change calculation for EFECTIVO entries
  - Table number display in header when Cafetería mode
  - Uses normalizePaymentMethod for labels
- Updated ReceiptDialog with:
  - tableNumber display (Mesa #N) with Coffee icon in amber
  - Multi-payment display (method: amount + method: amount)
  - normalizePaymentMethod for backward compat
- Updated sales API (POST) with:
  - tableNumber support
  - Payment validation and SalePayment creation
  - Correct movementType determination (MERMA only if all payments are CUENTA_CASA)
- Fixed normalizePaymentMethod function (was corrupted by browser agent)
- Lint passed, browser verification passed

Stage Summary:
- POS can be configured as Kiosko (default) or Cafetería in Settings > General
- Cafetería mode shows table selector in POS, requires table selection before charging
- Table number saved on Sale record, shown on receipt
- Multi-payment support fully working with payment dialog
- All existing functionality preserved
