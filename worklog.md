---
Task ID: 1
Agent: main
Task: Create comprehensive update system for KioskoApp downloaded system

Work Log:
- Explored existing project structure, scripts (update-v2.sh, update-v3.sh, update-system.ts, migrate-add-auth.ts)
- Created version tracking system (src/lib/version.ts with APP_VERSION and CHANGELOG)
- Created /api/version endpoint to expose version info
- Created /api/update endpoint to check for updates and update version in DB
- Updated /api/settings to include system group (app_version, last_updated)
- Updated /api/download to include version in filename
- Created comprehensive update.sh shell script (public/update.sh) for production updates
- Created build-update.ts script (scripts/build-update.ts) for packaging updates
- Updated update-system.ts to register version in database (step 8)
- Updated package.json version to 0.4.0 and added build-update script
- Added system info section to general-tab.tsx settings (version display, check version button, download button)
- Tested all APIs via curl: version, update, login, settings - all working

Stage Summary:
- Complete update system created with version tracking (v0.4.0)
- 3 ways to update: (1) shell script update.sh, (2) bun run update-system, (3) API POST /api/update
- Version info visible in Settings > General > System Info
- Update package builder: bun run build-update
