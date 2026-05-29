'use client'

import { Store, ShoppingCart, Package, Truck, Banknote, Wrench, BarChart3, Settings } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import type { AppView } from '@/lib/types'
import { cn } from '@/lib/utils'

interface NavItem {
  view: AppView
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { view: 'pos', label: 'POS', icon: ShoppingCart },
  { view: 'inventory', label: 'Inventario', icon: Package },
  { view: 'purchases', label: 'Compras', icon: Truck },
  { view: 'cash', label: 'Caja', icon: Banknote },
  { view: 'repairs', label: 'Reparaciones', icon: Wrench },
  { view: 'reports', label: 'Reportes', icon: BarChart3 },
  { view: 'settings', label: 'Ajustes', icon: Settings },
]

interface AppSidebarProps {
  onNavigate?: () => void
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const { activeView, setActiveView, currentCashRegisterId } = useAppStore()

  const handleNavClick = (view: AppView) => {
    setActiveView(view)
    onNavigate?.()
  }

  const cashOpen = currentCashRegisterId !== null

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-emerald-950 via-emerald-900 to-teal-900 text-white w-60">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex items-center justify-center w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-xl shadow-lg shadow-emerald-500/30">
          <Store className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-lg font-bold tracking-tight">KioskoApp</span>
          <span className="block text-[10px] font-medium text-emerald-300/70 uppercase tracking-widest">Gestión</span>
        </div>
      </div>

      <div className="mx-3 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.view
          const Icon = item.icon
          return (
            <button
              key={item.view}
              onClick={() => handleNavClick(item.view)}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-emerald-500/90 to-teal-500/90 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-400/20'
                  : 'text-emerald-100/70 hover:bg-emerald-800/40 hover:text-white'
              )}
            >
              <Icon className={cn(
                'w-5 h-5 transition-colors',
                isActive ? 'text-white' : 'text-emerald-400/60 group-hover:text-emerald-300'
              )} />
              {item.label}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-sm shadow-white/50" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Cash Register Status */}
      <div className="px-3 pb-4">
        <div className="mx-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent mb-4" />
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-950/50 backdrop-blur-sm ring-1 ring-emerald-500/10">
          <span
            className={cn(
              'w-2.5 h-2.5 rounded-full',
              cashOpen
                ? 'bg-emerald-400 shadow-sm shadow-emerald-400/60 animate-pulse'
                : 'bg-red-400 shadow-sm shadow-red-400/60'
            )}
          />
          <span className="text-xs font-medium text-emerald-200/80">
            Caja: {cashOpen ? 'ABIERTA' : 'CERRADA'}
          </span>
        </div>
      </div>
    </div>
  )
}
