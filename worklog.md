---
Task ID: 1
Agent: Main
Task: Implement kiosk/cafeteria mode configuration in Settings and POS

Work Log:
- Explored current Settings module (6 tabs: Users, Roles, Currency, Denominations, General)
- Found that kiosk/cafeteria mode was already partially implemented in previous session
- Fixed PaymentMethod type: TRANSFERENCIA → TARJETA across all files (types.ts, cart-panel.tsx, payment-dialog.tsx, cash-view.tsx, cash-close-dialog.tsx, reports-view.tsx, cash-register API, reports API)
- Added missing PaymentEntry type to types.ts (was causing TypeScript crash)
- Added normalizePaymentMethod() usage in all frontend components that display payment methods
- Added tableCarts support to Zustand store for multi-table cart management in cafeteria mode
- Enhanced POS view with visual table indicators (green dot for active orders, amber fill for tables with items)
- Added table badge (☕ Mesa #N) in cart panel header when in cafeteria mode
- Verified lint passes with zero errors
- Tested via agent-browser: POS loads correctly, Settings → General shows Kiosko/Cafetería toggle, payment buttons show "Efectivo", "Tarjeta", "Cuenta Casa / Merma"

Stage Summary:
- PaymentMethod type unified to: EFECTIVO | TARJETA | CUENTA_CASA
- normalizePaymentMethod() handles legacy TRANSFERENCIA records in DB
- Cafeteria mode: each table has its own cart, visual indicators for active tables
- Server stability is an ongoing issue (OOM kills with Turbopack at ~1.4GB RAM)
