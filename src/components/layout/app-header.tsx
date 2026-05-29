'use client'

import { Menu } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import type { AppView } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { useState } from 'react'

const VIEW_LABELS: Record<AppView, string> = {
  pos: 'Punto de Venta',
  inventory: 'Inventario',
  purchases: 'Compras',
  cash: 'Caja',
  repairs: 'Reparaciones',
  reports: 'Reportes',
}

export function AppHeader() {
  const { activeView } = useAppStore()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center h-14 px-4 border-b bg-white dark:bg-slate-950 gap-3 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setSheetOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
          {VIEW_LABELS[activeView]}
        </h1>
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
