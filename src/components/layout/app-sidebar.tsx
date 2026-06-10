'use client'

import { Store, ShoppingCart, Package, Truck, Banknote, Wrench, BarChart3, Settings, Download, Receipt, LogOut, User } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import type { AppView, RolePermission } from '@/lib/types'
import { cn } from '@/lib/utils'
import { CurrencySelector } from '@/components/layout/currency-selector'

interface NavItem {
  view: AppView
  label: string
  icon: React.ComponentType<{ className?: string }>
  permission: RolePermission
}

const NAV_ITEMS: NavItem[] = [
  { view: 'pos', label: 'POS', icon: ShoppingCart, permission: 'pos.access' },
  { view: 'inventory', label: 'Inventario', icon: Package, permission: 'inventory.access' },
  { view: 'purchases', label: 'Compras', icon: Truck, permission: 'purchases.access' },
  { view: 'expenses', label: 'Gastos', icon: Receipt, permission: 'expenses.access' },
  { view: 'cash', label: 'Caja', icon: Banknote, permission: 'cash.access' },
  { view: 'repairs', label: 'Reparaciones', icon: Wrench, permission: 'repairs.access' },
  { view: 'reports', label: 'Reportes', icon: BarChart3, permission: 'reports.access' },
  { view: 'settings', label: 'Ajustes', icon: Settings, permission: 'settings.access' },
]

interface AppSidebarProps {
  onNavigate?: () => void
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const { activeView, setActiveView, currentCashRegisterId, user, hasPermission, logout } = useAppStore()

  const handleNavClick = (view: AppView) => {
    setActiveView(view)
    onNavigate?.()
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    } catch {
      // Ignore errors, we'll clear client state anyway
    }
    logout()
  }

  const cashOpen = currentCashRegisterId !== null

  // Filter nav items by user permissions
  const visibleNavItems = NAV_ITEMS.filter((item) => hasPermission(item.permission))

  // Get initials for avatar
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white w-60">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex items-center justify-center w-9 h-9 bg-slate-700 rounded-xl">
          <Store className="w-5 h-5 text-slate-200" />
        </div>
        <div>
          <span className="text-lg font-bold tracking-tight">KioskoApp</span>
          <span className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest">Gestión</span>
        </div>
      </div>

      <div className="mx-3 h-px bg-slate-700/60" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const isActive = activeView === item.view
          const Icon = item.icon
          return (
            <button
              key={item.view}
              onClick={() => handleNavClick(item.view)}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-white/[0.08] text-white'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
              )}
            >
              <Icon className={cn(
                'w-5 h-5 transition-colors',
                isActive ? 'text-emerald-300' : 'text-slate-500'
              )} />
              {item.label}
              {isActive && (
                <div className="ml-auto w-1 h-4 rounded-full bg-emerald-400" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 space-y-2">
        <div className="mx-0 h-px bg-slate-700/60 mb-2" />

        {/* Download link */}
        <a
          href="/kiosko-app.tar.gz"
          download="kiosko-app.tar.gz"
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 transition-all duration-150"
        >
          <Download className="w-4 h-4" />
          Descargar Proyecto
        </a>

        {/* Cash Register Status */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-800/60">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              cashOpen
                ? 'bg-green-400 animate-pulse'
                : 'bg-red-400'
            )}
          />
          <span className="text-xs font-medium text-slate-300">
            Caja: {cashOpen ? 'ABIERTA' : 'CERRADA'}
          </span>
        </div>

        {/* Currency Selector */}
        <div className="px-1">
          <CurrencySelector />
        </div>

        {/* User Info & Logout */}
        {user && (
          <div className="rounded-lg bg-slate-800/60 p-3 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 bg-emerald-600/30 rounded-full text-emerald-300 text-xs font-bold">
                {getInitials(user.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.role.name}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-150"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
