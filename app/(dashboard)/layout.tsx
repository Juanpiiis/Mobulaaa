'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const links = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/productos', label: 'Productos' },
    { href: '/admin/bodegas', label: 'Bodegas' },
    { href: '/admin/usuarios', label: 'Usuarios' },
    { href: '/bodeguero/inventario', label: 'Inventario' },
    { href: '/bodeguero/movimientos', label: 'Movimientos' },
    { href: '/bodeguero/pedidos', label: 'Pedidos' },
    { href: '/admin/reportes', label: 'Reportes' },
  ]

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
      <div className="logo">
  <img src="/logo-mobulaa-blanco.png" alt="Logo Mobulaa" style={{ width: '260px' }} />
</div>
        <nav>
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? 'active' : ''}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="dashboard-content">
        {children}
      </main>
    </div>
  )
}