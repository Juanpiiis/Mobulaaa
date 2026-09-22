'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useTienda } from '@/lib/context/TiendaContext'
import { useNotificaciones } from '@/lib/context/NotificacionesContext'
import {
  HomeIcon, CubeIcon, BuildingStorefrontIcon, UsersIcon,
  ArrowsRightLeftIcon, ClipboardDocumentListIcon, ChartBarIcon,
  ArrowLeftOnRectangleIcon, ShoppingCartIcon, CreditCardIcon,
  DocumentTextIcon, BeakerIcon, CalculatorIcon, ClipboardIcon,
  ChevronDownIcon, BellIcon
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
      { name: 'Inventario', href: '/bodeguero/inventario', icon: CubeIcon },
      { name: 'Bodegas', href: '/admin/bodegas', icon: BuildingStorefrontIcon },
      { name: 'Usuarios', href: '/admin/usuarios', icon: UsersIcon },
      { name: 'Reportes', href: '/admin/reportes', icon: DocumentTextIcon },
      { name: 'Estadísticas', href: '/admin/estadisticas', icon: ChartBarIcon },
      { name: 'Subir Inventario', href: '/admin/subir-inventario', icon: ClipboardIcon },
      { name: 'Cortes', href: '/admin/cortes', icon: ClipboardDocumentListIcon },
      { name: 'Pedidos de Vendedor', href: '/vendedor/mis-pedidos', icon: ClipboardDocumentListIcon },
      { name: 'Pedidos de Bodega', href: '/bodeguero/pedidos', icon: ClipboardDocumentListIcon },
      { name: 'Pedidos de Cartera', href: '/cartera', icon: ClipboardDocumentListIcon },
      { name: 'Movimientos de bodega', href: '/bodeguero/movimientos', icon: ArrowsRightLeftIcon },
      { name: 'Entrada Mercancía', href: '/bodeguero/entradas', icon: ClipboardIcon },
    ]
  },
  bodeguero: {
    title: 'Panel de Bodeguero',
    items: [
      { name: 'Inicio', href: '/bodeguero', icon: HomeIcon },
      { name: 'Inventario', href: '/bodeguero/inventario', icon: CubeIcon },
      { name: 'Movimientos', href: '/bodeguero/movimientos', icon: ArrowsRightLeftIcon },
      { name: 'Pedidos', href: '/bodeguero/pedidos', icon: ClipboardDocumentListIcon },
      { name: 'Entrada Mercancía', href: '/bodeguero/entradas', icon: ClipboardIcon },
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
        className="campana-trigger w-11 h-11 flex items-center justify-center rounded-xl active:scale-[0.98]"
        aria-label="Notificaciones"
      >
        <BellIcon className="campana-trigger__icon" />
        {noLeidas > 0 && (
          <span className={`campana-badge ${noLeidas > 3 ? 'campana-badge--pulse' : ''}`}>
            {noLeidas}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="campana-panel z-50 max-w-[calc(100vw-1.5rem)] right-0 shadow-2xl rounded-xl border border-gray-200">
          <div className="campana-panel__header">
            <p className="campana-panel__title">Notificaciones</p>
            {noLeidas > 0 && (
              <button
                onClick={marcarTodasLeidas}
                className="campana-panel__mark-all"
              >
                Marcar todas
              </button>
            )}
          </div>

          <div className="campana-panel__list">
            {notificaciones.length === 0 ? (
              <p className="campana-panel__empty">Sin notificaciones nuevas</p>
            ) : notificaciones.map(n => (
              <div
                key={n.id}
                onClick={() => marcarLeida(n.id)}
                className={`campana-notification ${!n.leida ? 'campana-notification--unread' : ''}`}
              >
                <p className="campana-notification__message">{n.mensaje}</p>
                <p className="campana-notification__date">{new Date(n.fecha).toLocaleString()}</p>
              </div>
            ))}
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
  const { tiendaActual, setTiendaActual, bodegas } = useTienda()
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

  return (
    <div className="dashboard-shell">

      <div
        className={`sidebar-overlay ${isSidebarOpen ? 'sidebar-overlay--visible' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* ======================== SIDEBAR ======================== */}
      <aside className={`dashboard-sidebar ${isSidebarOpen ? 'dashboard-sidebar--open' : 'dashboard-sidebar--collapsed'} pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}>

        <div className="sidebar-logo">
          <img
            src="/logo-mobulaa-blanco.png"
            alt="Mobulaa"
            className="sidebar-logo__img"
          />
        </div>

        <div className="sidebar-role-info">
          <p className="sidebar-role-info__title">{navConfig.title}</p>
          <p className="sidebar-role-info__name">
            {rol === 'admin' ? 'Administrador' : rol}
          </p>
        </div>

        <div className="sidebar-store-selector">
          <p className="sidebar-store-selector__label">Tienda / Bodega</p>
          <div className="sidebar-store-selector__select-wrapper">
            <select
              className="sidebar-store-selector__select"
              value={tiendaActual?.id || ''}
              onChange={e => {
                const bodega = bodegas.find(b => b.id === e.target.value) || null
                setTiendaActual(bodega)
              }}
            >
              <option value="">Sin seleccionar</option>
              {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
            <ChevronDownIcon className="sidebar-store-selector__chevron" />
          </div>
        </div>

        <nav className="sidebar-nav">
          {navConfig.items.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={handleNavClick}
                className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}
              >
                <item.icon className="sidebar-nav-item__icon" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-logout">
          <button
            onClick={handleLogout}
            className="sidebar-logout__btn"
          >
            <ArrowLeftOnRectangleIcon className="sidebar-logout__icon" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* ================== CONTENIDO PRINCIPAL ================== */}
      <div className="dashboard-main-wrapper">

        <header className="dashboard-topbar pt-[env(safe-area-inset-top)] min-h-[calc(4rem+env(safe-area-inset-top))]">
          <div className="topbar-left">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="topbar-hamburger w-11 h-11 flex items-center justify-center rounded-xl active:scale-[0.98]"
              aria-label="Menú de navegación"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="topbar-greeting">Bienvenido 👋</h1>
          </div>

          <div className="topbar-right">
            <Campana />
            <div className="user-avatar">
              {rol.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="dashboard-main">
          {!tiendaActual ? (
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