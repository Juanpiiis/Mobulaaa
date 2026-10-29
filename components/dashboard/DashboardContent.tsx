'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useTienda } from '@/lib/context/TiendaContext'
import { useNotificaciones } from '@/lib/context/NotificacionesContext'
import { useTheme } from '@/lib/context/ThemeContext'
import {
  HomeIcon, CubeIcon, BuildingStorefrontIcon, UsersIcon,
  ArrowsRightLeftIcon, ClipboardDocumentListIcon, ChartBarIcon,
  ArrowLeftOnRectangleIcon, ShoppingCartIcon, CreditCardIcon,
  DocumentTextIcon, BeakerIcon, CalculatorIcon, ClipboardIcon,
  ChevronDownIcon, BellIcon, PlusIcon,
  SunIcon, MoonIcon, ArrowLeftIcon,
} from '@heroicons/react/24/outline'

/* ============================================================
   Configuración de navegación por rol
   ============================================================ */
const navigationConfig = {
  admin: {
    title: 'Panel de Administración',
    items: [
      { name: 'Dashboard', href: '/admin', icon: HomeIcon },
      { name: 'Productos', href: '/admin/productos', icon: CubeIcon },
      { name: 'Inventario', href: '/admin/inventario', icon: CubeIcon },
      { name: 'Bodegas', href: '/admin/bodegas', icon: BuildingStorefrontIcon },
      { name: 'Usuarios', href: '/admin/usuarios', icon: UsersIcon },
      { name: 'Reportes', href: '/admin/reportes', icon: DocumentTextIcon },
      { name: 'Estadísticas', href: '/admin/estadisticas', icon: ChartBarIcon },
      { name: 'Subir Inventario', href: '/admin/subir-inventario', icon: ClipboardIcon },
      { name: 'Cortes', href: '/admin/cortes', icon: ClipboardDocumentListIcon },
      { name: 'Pedidos de Vendedor', href: '/vendedor/mis-pedidos', icon: ClipboardDocumentListIcon },
      { name: 'Pedidos', href: '/admin/pedidos', icon: ClipboardDocumentListIcon },
      { name: 'Pedidos de Cartera', href: '/cartera', icon: ClipboardDocumentListIcon },
      { name: 'Movimientos de bodega', href: '/admin/movimientos', icon: ArrowsRightLeftIcon },
      { name: 'Entrada Mercancía', href: '/admin/entradas', icon: ClipboardIcon },
      { name: 'Historial del Sistema', href: '/admin/logs', icon: ClipboardDocumentListIcon },
    ]
  },
  bodeguero: {
    title: 'Panel de Bodeguero',
    items: [
      { name: 'Inicio', href: '/bodeguero', icon: HomeIcon },
      { name: 'Pedidos', href: '/bodeguero/pedidos', icon: ClipboardDocumentListIcon },
    ]
  },
  cartera: {
    title: 'Panel de Cartera',
    items: [
      { name: 'Inicio', href: '/cartera', icon: HomeIcon },
      { name: 'Pedidos', href: '/cartera/pedidos', icon: ClipboardDocumentListIcon },
    ]
  },
  vendedor: {
    title: 'Panel de Vendedor',
    items: [
      { name: 'Inicio', href: '/vendedor', icon: HomeIcon },
      { name: 'Pedidos', href: '/vendedor/mis-pedidos', icon: ClipboardDocumentListIcon },
    ]
  }
}

/* ============================================================
   Componente: Botón de cambio de tema (claro / oscuro)
   ============================================================ */
function BotonTema() {
  const { tema, toggleTema } = useTheme()
  const esOscuro = tema === 'dark'

  return (
    <button
      onClick={toggleTema}
      className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 active:scale-[0.98] transition-colors dark:text-gray-300 dark:hover:bg-gray-800"
      aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={esOscuro ? 'Modo claro' : 'Modo oscuro'}
    >
      {esOscuro ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
    </button>
  )
}

/* ============================================================
   Componente: Campana de Notificaciones
   ============================================================ */
function Campana() {
  const { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas } = useNotificaciones()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.campana-container')) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="campana-container relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="campana-trigger w-11 h-11 flex items-center justify-center rounded-xl active:scale-[0.98] relative"
        aria-label="Notificaciones"
      >
        <BellIcon className="campana-trigger__icon w-6 h-6" />
        {noLeidas > 0 && (
          <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[9px] text-white font-bold items-center justify-center">
              {noLeidas > 9 ? '9+' : noLeidas}
            </span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="campana-panel z-50 w-80 max-w-[calc(100vw-1.5rem)] right-0 absolute mt-2 shadow-2xl rounded-xl border border-gray-200 bg-white overflow-hidden dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
            <p className="font-bold text-[#232323] text-sm dark:text-white">Notificaciones</p>
            {noLeidas > 0 && (
              <button onClick={marcarTodasLeidas} className="text-xs text-[#1A0087] dark:text-blue-400 font-medium hover:underline">
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notificaciones.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No tienes notificaciones</p>
            ) : (
              notificaciones.map(n => (
                <Link
                  key={n.id}
                  href={n.link || '#'}
                  onClick={() => { marcarLeida(n.id); setIsOpen(false) }}
                  className={`block p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-700 ${!n.leida ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {!n.leida && <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shrink-0" />}
                    <div>
                      <p className={`text-sm ${!n.leida ? 'font-semibold text-[#232323] dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                        {n.titulo}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">{n.mensaje}</p>
                      <p className="text-[10px] text-gray-400 mt-2">
                        {new Date(n.created_at).toLocaleString('es-CO')}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ============================================================
   Componente: DashboardContent (Layout visual)
   ============================================================ */
export default function DashboardContent({ children, rol }: { children: React.ReactNode; rol: string }) {
  const { tiendaActual, setTiendaActual, bodegas, soloUnaBodega } = useTienda()
  const router = useRouter()
  const supabase = createClient()
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navConfig = navigationConfig[rol as keyof typeof navigationConfig] || navigationConfig.admin

  const handleNavClick = () => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false)
    }
  }

  const rutasPrincipales = ['/admin', '/vendedor', '/bodeguero', '/cartera']
  const mostrarBotonAtras = !rutasPrincipales.includes(pathname)
  const esPaginaBodegas = pathname === '/admin/bodegas'

  const renderSelector = () => {
    if (rol !== 'admin' && bodegas.length === 0) {
      return (
        <div className="sidebar-store-selector">
          <p className="sidebar-store-selector__label">Tienda / Bodega</p>
          <div className="bg-amber-900/40 border border-amber-500/40 text-amber-100 px-3 py-2.5 rounded-xl text-sm font-medium min-h-[44px] flex flex-col justify-center">
            <span className="font-semibold">Sin bodega asignada</span>
            <span className="text-xs text-amber-200/80">Pide al admin que te asigne una</span>
          </div>
        </div>
      )
    }

    if (bodegas.length === 0) {
      return (
        <div className="sidebar-store-selector">
          <p className="sidebar-store-selector__label">Tienda / Bodega</p>
          <Link href="/admin/bodegas" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px]">
            <PlusIcon className="w-4 h-4" />
            <span>Crear primera bodega</span>
          </Link>
        </div>
      )
    }

    if (soloUnaBodega) {
      return (
        <div className="sidebar-store-selector">
          <p className="sidebar-store-selector__label">Tienda / Bodega</p>
          <div className="bg-white/10 text-white px-3 py-2.5 rounded-xl text-sm font-medium min-h-[44px] flex items-center">
            {tiendaActual?.nombre || bodegas[0]?.nombre || 'Bodega'}
          </div>
        </div>
      )
    }

    return (
      <div className="sidebar-store-selector">
        <p className="sidebar-store-selector__label">Tienda / Bodega</p>
        <div className="sidebar-store-selector__select-wrapper">
          <select
            className="sidebar-store-selector__select"
            value={tiendaActual?.id || ''}
            onChange={e => {
              if (!e.target.value) {
                setTiendaActual(bodegas[0] || null)
                return
              }
              const bodega = bodegas.find(b => b.id === e.target.value) || null
              setTiendaActual(bodega)
            }}
          >
            {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
          <ChevronDownIcon className="sidebar-store-selector__chevron" />
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-shell">
      <div className={`sidebar-overlay ${isSidebarOpen ? 'sidebar-overlay--visible' : ''}`} onClick={() => setIsSidebarOpen(false)} />

      {/* ======================== SIDEBAR ======================== */}
      <aside className={`dashboard-sidebar ${isSidebarOpen ? 'dashboard-sidebar--open' : 'dashboard-sidebar--collapsed'} pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}>
        <div className="sidebar-logo">
          <img src="/logo-mobulaa-blanco.png" alt="Mobulaa" className="sidebar-logo__img" />
        </div>

        <div className="sidebar-role-info">
          <p className="sidebar-role-info__title">{navConfig.title}</p>
          <p className="sidebar-role-info__name">{rol === 'admin' ? 'Administrador' : rol}</p>
        </div>

        {renderSelector()}

        <nav className="sidebar-nav">
          {navConfig.items.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={handleNavClick}
                className={`sidebar-nav-item flex items-center justify-between ${isActive ? 'sidebar-nav-item--active' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="sidebar-nav-item__icon" />
                  <span>{item.name}</span>
                </div>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-logout">
          <button onClick={handleLogout} className="sidebar-logout__btn">
            <ArrowLeftOnRectangleIcon className="sidebar-logout__icon" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* ================== CONTENIDO PRINCIPAL ================== */}
      <div className="dashboard-main-wrapper">
        <header className="dashboard-topbar pt-[env(safe-area-inset-top)] min-h-[calc(4rem+env(safe-area-inset-top))]">
          <div className="topbar-left flex items-center gap-2">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="topbar-hamburger w-11 h-11 flex items-center justify-center rounded-xl active:scale-[0.98]" aria-label="Menú de navegación">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {mostrarBotonAtras && (
              <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:scale-[0.95] text-gray-700 transition-all dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" aria-label="Volver atrás" title="Volver atrás">
                <ArrowLeftIcon className="w-5 h-5 stroke-[2.5]" />
              </button>
            )}

            <h1 className="topbar-greeting">Bienvenido 👋</h1>
          </div>

          <div className="topbar-right flex items-center gap-2">
            <BotonTema />
            <Campana />
            <div className="user-avatar">
              {rol.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="dashboard-main">
          {/* 🔥 CORRECCIÓN: Si es admin, siempre renderizamos el contenido */}
          {rol === 'admin' ? (
            children
          ) : bodegas.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__card">
                <div className="empty-state__icon-wrapper">
                  <BuildingStorefrontIcon className="empty-state__icon" />
                </div>
                <p className="empty-state__title">Sin bodega asignada</p>
                <p className="empty-state__description">No tienes una bodega asignada. Pídele al administrador que te asigne una para poder operar.</p>
              </div>
            </div>
          ) : (!tiendaActual && !esPaginaBodegas && bodegas.length > 0) ? (
            <div className="empty-state">
              <div className="empty-state__card">
                <div className="empty-state__icon-wrapper">
                  <BuildingStorefrontIcon className="empty-state__icon" />
                </div>
                <p className="empty-state__title">Selecciona una tienda</p>
                <p className="empty-state__description">Usa el selector en el menú lateral para comenzar</p>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )
}