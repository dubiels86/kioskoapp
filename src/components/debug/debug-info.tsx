'use client'

import { useAppStore } from '@/lib/store'

export function DebugInfo() {
  const { 
    user, 
    isAuthenticated, 
    isLoadingAuth, 
    activeView,
    currentCashRegisterId 
  } = useAppStore()

  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white text-xs p-3 rounded-lg z-50 max-w-xs">
      <div className="font-bold mb-2 text-amber-300">DEBUG INFO</div>
      <div className="space-y-1">
        <div>Autenticado: <span className={isAuthenticated ? 'text-green-400' : 'text-red-400'}>{isAuthenticated ? '✅' : '❌'}</span></div>
        <div>Cargando: <span className={isLoadingAuth ? 'text-yellow-400' : 'text-gray-400'}>{isLoadingAuth ? '⏳' : '✅'}</span></div>
        <div>Usuario: <span className="text-blue-300">{user ? user.username : 'Ninguno'}</span></div>
        <div>Vista: <span className="text-purple-300">{activeView}</span></div>
        <div>Caja: <span className={currentCashRegisterId ? 'text-green-400' : 'text-red-400'}>{currentCashRegisterId ? 'Abierta' : 'Cerrada'}</span></div>
        <div className="pt-2 border-t border-gray-700 mt-2">
          <div className="text-gray-400">Resolución:</div>
          <div className="text-xs">Width: {typeof window !== 'undefined' ? window.innerWidth : 'N/A'}</div>
          <div className="text-xs">Height: {typeof window !== 'undefined' ? window.innerHeight : 'N/A'}</div>
          <div className="text-xs">Breakpoint: {typeof window !== 'undefined' ? (window.innerWidth >= 1024 ? 'lg+' : 'mobile') : 'N/A'}</div>
        </div>
      </div>
    </div>
  )
}