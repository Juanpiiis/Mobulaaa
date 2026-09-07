'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import Link from 'next/link'

export default function AdminPage() {
  const [stats, setStats] = useState({ productos: 0, bodegas: 0, usuarios: 0, pedidosPendientes: 0, stockBajo: 0, movimientosHoy: 0 })
  const { tiendaActual } = useTienda()
  const supabase = createClient()

  useEffect(() => {
    const cargar = async () => {
      const { count: productos } = await supabase.from('productos').select('*', { count: 'exact', head: true }).eq('activo', true)
      const { count: bodegas } = await supabase.from('bodegas').select('*', { count: 'exact', head: true }).eq('activo', true)
      const { count: usuarios } = await supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('activo', true)

      let pendientes = 0
      let stockBajo = 0
      let movimientosHoy = 0

      if (tiendaActual) {
        const { count: ped } = await supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('bodega_id', tiendaActual.id).eq('estado', 'pendiente')
        const { data: inv } = await supabase.from('inventario').select('cantidad_disponible, cantidad_minima').eq('bodega_id', tiendaActual.id)
        const hoy = new Date().toISOString().split('T')[0]
        const { count: mov } = await supabase.from('movimientos').select('*', { count: 'exact', head: true }).gte('fecha', hoy)
        pendientes = ped || 0
        stockBajo = inv?.filter(i => i.cantidad_disponible <= i.cantidad_minima).length || 0
        movimientosHoy = mov || 0
      }

      setStats({ productos: productos || 0, bodegas: bodegas || 0, usuarios: usuarios || 0, pedidosPendientes: pendientes, stockBajo, movimientosHoy })
    }
    cargar()
  }, [tiendaActual])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard Admin</h1>
        <p className="text-gray-500 text-sm">{tiendaActual ? tiendaActual.nombre : 'Vista general del sistema'}</p>
      </div>

      {/* Stats globales */}
      <p className="text-sm font-medium text-gray-500 mb-3">SISTEMA</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/admin/productos" className="bg-white rounded-lg shadow p-4 hover:shadow-md">
          <p className="text-blue-700 font-bold text-3xl">{stats.productos}</p>
          <p className="text-gray-600">Productos registrados</p>
        </Link>
        <Link href="/admin/bodegas" className="bg-white rounded-lg shadow p-4 hover:shadow-md">
          <p className="text-blue-700 font-bold text-3xl">{stats.bodegas}</p>
          <p className="text-gray-600">Tiendas / Bodegas</p>
        </Link>
        <Link href="/admin/usuarios" className="bg-white rounded-lg shadow p-4 hover:shadow-md">
          <p className="text-blue-700 font-bold text-3xl">{stats.usuarios}</p>
          <p className="text-gray-600">Usuarios activos</p>
        </Link>
      </div>

      {/* Stats por tienda */}
      {tiendaActual && (
        <>
          <p className="text-sm font-medium text-gray-500 mb-3">{tiendaActual.nombre.toUpperCase()}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/bodeguero/pedidos" className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 hover:shadow">
              <p className="text-yellow-700 font-bold text-3xl">{stats.pedidosPendientes}</p>
              <p className="text-yellow-600">Pedidos pendientes</p>
            </Link>
            <Link href="/bodeguero/inventario" className="bg-red-50 border border-red-200 rounded-lg p-4 hover:shadow">
              <p className="text-red-700 font-bold text-3xl">{stats.stockBajo}</p>
              <p className="text-red-600">Productos stock bajo</p>
            </Link>
            <Link href="/bodeguero/movimientos" className="bg-green-50 border border-green-200 rounded-lg p-4 hover:shadow">
              <p className="text-green-700 font-bold text-3xl">{stats.movimientosHoy}</p>
              <p className="text-green-600">Movimientos hoy</p>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}