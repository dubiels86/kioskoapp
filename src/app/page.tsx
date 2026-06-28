'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { POSView } from '@/components/pos/pos-view'
import { InventoryView } from '@/components/inventory/inventory-view'
import { PurchasesView } from '@/components/purchases/purchases-view'
import { ExpensesView } from '@/components/expenses/expenses-view'
import { CashView } from '@/components/cash/cash-view'
import { RepairsView } from '@/components/repairs/repairs-view'
import { ReportsView } from '@/components/reports/reports-view'
import { SettingsView } from '@/components/settings/settings-view'
import { LoginView } from '@/components/auth/login-view'
import { AnimatePresence, motion } from 'framer-motion'
import type { AppView } from '@/lib/types'
import type { AuthUser } from '@/lib/store'
import { Loader2 } from 'lucide-react'

const MODULE_COMPONENTS: Record<AppView, React.ComponentType> = {
  pos: POSView,
  inventory: InventoryView,
  purchases: PurchasesView,
  expenses: ExpensesView,
  cash: CashView,
  repairs: RepairsView,
  reports: ReportsView,
  settings: SettingsView,
}

const VIEW_LABELS: Record<AppView, string> = {
  pos: 'Punto de Venta',
  inventory: 'Inventario',
  purchases: 'Compras',
  expenses: 'Gastos',
  cash: 'Caja',
  repairs: 'Reparaciones',
  reports: 'Reportes',
  settings: 'Ajustes',
}

export default function Home() {
  const { activeView, isAuthenticated, isLoadingAuth, setUser, setLoadingAuth, logout } = useAppStore()

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          if (data.authenticated && data.user) {
            setUser(data.user as AuthUser)
          } else {
            setUser(null)
          }
        } else {
          setUser(null)
        }
      } catch {
        // Network error (server might be starting up) - don't log out
        // Just stop loading so user can try to login
        setUser(null)
      }
    }
    checkSession()
  }, [setUser])

  // Loading state while checking session
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return <LoginView />
  }

  // Authenticated - show main app
  const ActiveComponent = MODULE_COMPONENTS[activeView]

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex shrink-0 sticky top-0 h-screen">
          <AppSidebar />
        </aside>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Mobile Header */}
          <AppHeader />

          {/* Desktop Title Bar */}
          <div className="hidden md:flex items-center h-14 px-6 border-b bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
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
