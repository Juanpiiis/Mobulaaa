'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import Link from 'next/link'
import { ClipboardDocumentListIcon, ExclamationTriangleIcon, CubeIcon, ArrowRightIcon } from '@heroicons/react/24/outline'

export default function BodegueroInicioPage() {
  const { tiendaActual } = useTienda()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ porAlistar: 0, agotados: 0, stockBajo: 0 })

  // 🔥 Estado para la lista rápida de pedidos
  const [pedidosPendientes, setPedidosPendientes] = useState<any[]>([])

  useEffect(() => {
    const cargar = async () => {
      if (!tiendaActual) return
      setLoading(true)

      // 1. Pedidos por alistar (conteo y lista)
      const { data: pedidos, count } = await supabase
        .from('pedidos')
        .select(`
          id, estado, fecha, total,
          clientes(nombre),
          detalle_pedido(cantidad_solicitada)
        `, { count: 'exact' })
        .eq('bodega_id', tiendaActual.id)
        .in('estado', ['aprobado_cartera', 'en_preparacion', 'listo_para_despacho'])
        .order('fecha', { ascending: true })
        .limit(5) // Solo traemos los 5 más recientes para el preview

      // 2. Stock bajo y agotados
      const { data: inventario } = await supabase
        .from('inventario')
        .select('cantidad_disponible, cantidad_minima')
        .eq('bodega_id', tiendaActual.id)

      let agotados = 0, stockBajo = 0
      inventario?.forEach(i => {
        if (i.cantidad_disponible <= 0) agotados++
        else if (i.cantidad_minima && i.cantidad_disponible < i.cantidad_minima) stockBajo++
      })

      setPedidosPendientes(pedidos || [])
      setStats({ porAlistar: count || 0, agotados, stockBajo })
      setLoading(false)
    }
    cargar()
  }, [tiendaActual, supabase])

  const formatCOP = (v: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)

  if (loading) return <div className="p-10 text-center text-gray-400">Cargando tu resumen...</div>

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#232323]">Panel de Bodega 🏭</h1>
        <p className="text-sm text-[#828282] mt-1">Resumen operativo de <strong className="text-[#1A0087]">{tiendaActual?.nombre}</strong></p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-700"><ClipboardDocumentListIcon className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-gray-500">Pedidos por alistar</p>
            <p className="text-xl font-bold text-gray-800">{stats.porAlistar}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-red-50 text-red-700"><ExclamationTriangleIcon className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-gray-500">Agotados</p>
            <p className="text-xl font-bold text-gray-800">{stats.agotados}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-yellow-50 text-yellow-700"><CubeIcon className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-gray-500">Stock bajo mínimo</p>
            <p className="text-xl font-bold text-gray-800">{stats.stockBajo}</p>
          </div>
        </div>
      </div>

      {/* 🔥 BOTÓN ÚNICO PARA GESTIONAR PEDIDOS */}
      <div className="mt-8">
        <Link href="/bodeguero/pedidos" className="block bg-[#1A0087] text-white p-6 rounded-xl shadow-sm hover:bg-[#130066] transition-colors group">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold mb-1">Gestionar Pedidos</h2>
              <p className="text-sm text-white/80">Alistar, despachar y entregar pedidos</p>
            </div>
            <ArrowRightIcon className="w-8 h-8 text-white/50 group-hover:text-white transition-colors" />
          </div>
        </Link>
      </div>

      {/* 🔥 LISTA RÁPIDA DE PEDIDOS PENDIENTES */}
      {pedidosPendientes.length > 0 && (
        <div className="mt-8 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-[#232323] text-sm">Pedidos pendientes recientes</h3>
            <Link href="/bodeguero/pedidos" className="text-xs font-semibold text-[#1A0087] hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {pedidosPendientes.map((p) => (
              <Link key={p.id} href="/bodeguero/pedidos" className="flex justify-between items-center p-4 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-[#232323]">{p.clientes?.nombre || 'Sin cliente'}</p>
                  <p className="text-[11px] text-[#828282] mt-0.5">
                    #{String(p.id).slice(0, 6)} · {new Date(p.fecha).toLocaleDateString('es-CO')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#1A0087]">{formatCOP(p.total)}</p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    {p.estado.replace('_', ' ')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}