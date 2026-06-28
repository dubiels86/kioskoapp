'use client'

import { Menu, LogOut, User } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import type { AppView } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { useState } from 'react'

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

export function AppHeader() {
  const { activeView, user, logout } = useAppStore()
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    } catch {
      // Ignore
    }
    logout()
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center h-14 px-4 border-b bg-white/80 dark:bg-slate-950/80 backdrop-blur-md gap-3 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={() => setSheetOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100 truncate flex-1">
          {VIEW_LABELS[activeView]}
        </h1>

        {/* Mobile user dropdown */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0" aria-label="Menú de usuario">
                <div className="flex items-center justify-center w-7 h-7 bg-emerald-100 dark:bg-emerald-900/40 rounded-full text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                  {getInitials(user.name)}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.role.name}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {/* Mobile sidebar sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="p-0 w-60 bg-slate-900 border-none">
          <SheetHeader className="sr-only">
            <SheetTitle>Menú de navegación</SheetTitle>
          </SheetHeader>
          <AppSidebar onNavigate={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
