'use client'

import { useAppStore } from '@/lib/store'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { POSView } from '@/components/pos/pos-view'
import { InventoryView } from '@/components/inventory/inventory-view'
import { PurchasesView } from '@/components/purchases/purchases-view'
import { CashView } from '@/components/cash/cash-view'
import { RepairsView } from '@/components/repairs/repairs-view'
import { ReportsView } from '@/components/reports/reports-view'
import { SettingsView } from '@/components/settings/settings-view'
import { AnimatePresence, motion } from 'framer-motion'
import type { AppView } from '@/lib/types'

const MODULE_COMPONENTS: Record<AppView, React.ComponentType> = {
  pos: POSView,
  inventory: InventoryView,
  purchases: PurchasesView,
  cash: CashView,
  repairs: RepairsView,
  reports: ReportsView,
  settings: SettingsView,
}

const VIEW_LABELS: Record<AppView, string> = {
  pos: 'Punto de Venta',
  inventory: 'Inventario',
  purchases: 'Compras',
  cash: 'Caja',
  repairs: 'Reparaciones',
  reports: 'Reportes',
  settings: 'Ajustes',
}

export default function Home() {
  const { activeView } = useAppStore()
  const ActiveComponent = MODULE_COMPONENTS[activeView]

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex shrink-0 sticky top-0 h-screen">
          <AppSidebar />
        </aside>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Mobile Header */}
          <AppHeader />

          {/* Desktop Title Bar */}
          <div className="hidden lg:flex items-center h-14 px-6 border-b bg-white dark:bg-slate-950">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {VIEW_LABELS[activeView]}
            </h1>
          </div>

          {/* Module Content */}
          <main className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className={activeView === 'pos' ? 'h-full' : 'h-full overflow-y-auto p-4 md:p-6'}
              >
                <ActiveComponent />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  )
}
