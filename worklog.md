---
Task ID: 1
Agent: Main Agent
Task: Fix app loading issue and remove warehouse management from POS

Work Log:
- Identified that the Toaster component in layout.tsx was using shadcn/ui toaster (`@/components/ui/toaster`) instead of Sonner's Toaster. All components in the app use `toast` from `sonner`, so this was causing a conflict.
- Changed layout.tsx to import `Toaster` from `sonner` instead of `@/components/ui/toaster`
- Added `<Toaster richColors position="top-right" />` to the layout
- Removed warehouse selector from POS view per user request - POS now auto-selects the VENTAS warehouse
- Warehouse info is displayed as read-only in POS (shows which warehouse products come from)
- Warehouse management remains only in the Inventory module (Almacenes tab)
- Fixed React fragment key warnings in inventory-view.tsx and warehouse-view.tsx by replacing `<>` with `<React.Fragment key={...}>`
- Verified all API endpoints work correctly (warehouses, products, categories)
- Lint passes with no errors
- App loads successfully on the preview

Stage Summary:
- Fixed the Sonner Toaster integration (was using wrong toast system)
- POS now auto-uses VENTAS warehouse (no selector, read-only display)
- Warehouse management only accessible from Inventory > Almacenes tab
- Fixed React fragment key issues in table rendering
- All lint checks pass
