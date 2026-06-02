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
