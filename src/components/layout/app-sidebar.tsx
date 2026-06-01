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
        {NAV_ITEMS.map((item) => {
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
                isActive ? 'text-blue-300' : 'text-slate-500'
              )} />
              {item.label}
              {isActive && (
                <div className="ml-auto w-1 h-4 rounded-full bg-blue-400" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Cash Register Status */}
      <div className="px-3 pb-4">
        <div className="mx-0 h-px bg-slate-700/60 mb-4" />
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
      </div>
    </div>
  )
}
