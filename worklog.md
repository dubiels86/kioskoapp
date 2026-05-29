---
Task ID: 1
Agent: Main
Task: Create Settings module for user/role management, currency, bill denominations, and general settings

Work Log:
- Updated Prisma schema with Role, User, and Setting models
- Pushed schema changes to database
- Created API routes: /api/roles, /api/roles/[id], /api/users, /api/users/[id], /api/settings
- Created Settings view component with 5 tabs: Users, Roles, Currency, Denominations, General
- Added 'settings' to AppView type in types.ts
- Updated sidebar navigation with Ajustes button
- Updated header labels for settings view
- Updated page.tsx with SettingsView component
- Added RolePermission types and permission labels/groups
- Created default roles (Administrador, Vendedor) and admin user
- Fixed lint errors (setState in effect, variable before declaration)
- Restarted dev server to refresh Prisma client cache
- Verified all API endpoints work correctly

Stage Summary:
- Settings module fully implemented with 5 sub-tabs
- Users tab: CRUD with role assignment, password reset, soft delete
- Roles tab: CRUD with permission management by groups
- Currency tab: Locale selection with auto-fill, preview formatting
- Denominations tab: Add/remove bills and coins
- General tab: Business name, address, phone, invoice config
- Default admin user created (username: admin, password: admin)
- Default roles: Administrador (full access), Vendedor (basic sales access)
