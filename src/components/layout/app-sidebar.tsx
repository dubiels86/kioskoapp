'use client'

import { Store, ShoppingCart, Package, Truck, Banknote, Wrench, BarChart3 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import type { AppView } from '@/lib/types'
import { Separator } from '@/components/ui/separator'
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
        <div className="flex items-center justify-center w-9 h-9 bg-emerald-600 rounded-lg">
          <Store className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight">KioskoApp</span>
      </div>

      <Separator className="bg-slate-700/60" />

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
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive ? 'text-white' : 'text-slate-400')} />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Cash Register Status */}
      <div className="px-3 pb-4">
        <Separator className="bg-slate-700/60 mb-4" />
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-800/60">
          <span
            className={cn(
              'w-2.5 h-2.5 rounded-full',
              cashOpen ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-red-400 shadow-sm shadow-red-400/50'
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
