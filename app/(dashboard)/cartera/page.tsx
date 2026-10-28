'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { BanknotesIcon, ClockIcon, CheckCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline'

export default function CarteraInicioPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ pendientes: 0, facturadosMes: 0, montoFacturado: 0 })

  // 🔥 Estado para la lista rápida
  const [pedidosPendientes, setPedidosPendientes] = useState<any[]>([])

  useEffect(() => {
    const cargar = async () => {
      setLoading(true)

      // 1. Pendientes de aprobar (conteo y lista rápida de 5)
      const { data: pendientesData, count: countPendientes } = await supabase
        .from('pedidos')
        .select(`
          id, fecha, total,
          clientes(nombre),
          bodegas(nombre)
        `, { count: 'exact' })
        .eq('estado', 'pendiente')
        .order('fecha', { ascending: true }) // Los más viejos primero
        .limit(5)

      // 2. Facturados este mes
      const inicioMes = new Date()
      inicioMes.setDate(1)
      inicioMes.setHours(0, 0, 0, 0)

      const { data: pedidosMes } = await supabase
        .from('pedidos')
        .select('total')
        .in('estado', ['aprobado_cartera', 'en_preparacion', 'listo_para_despacho', 'despachado', 'entregado'])
        .gte('fecha', inicioMes.toISOString())

      let monto = 0
      pedidosMes?.forEach(p => monto += Number(p.total || 0))

      setPedidosPendientes(pendientesData || [])
      setStats({
        pendientes: countPendientes || 0,
        facturadosMes: pedidosMes?.length || 0,
        montoFacturado: monto
      })
      setLoading(false)
    }
    cargar()
  }, [supabase])

  const formatCOP = (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)

  if (loading) return <div className="p-10 text-center text-gray-400">Cargando tu resumen...</div>

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#232323]">Panel de Cartera 💰</h1>
        <p className="text-sm text-[#828282] mt-1">Resumen financiero y cola de aprobación</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-yellow-50 text-yellow-700"><ClockIcon className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-gray-500">Pedidos por aprobar</p>
            <p className="text-xl font-bold text-gray-800">{stats.pendientes}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-green-50 text-green-700"><CheckCircleIcon className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-gray-500">Pedidos facturados (mes)</p>
            <p className="text-xl font-bold text-gray-800">{stats.facturadosMes}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-700"><BanknotesIcon className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-gray-500">Monto facturado (mes)</p>
            <p className="text-xl font-bold text-gray-800">{formatCOP(stats.montoFacturado)}</p>
          </div>
        </div>
      </div>

      {/* 🔥 BOTÓN ÚNICO PARA GESTIONAR PEDIDOS */}
      <div className="mt-8">
        <Link href="/cartera/pedidos" className="block bg-[#1A0087] text-white p-6 rounded-xl shadow-sm hover:bg-[#130066] transition-colors group">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold mb-1">Ir a la Cola de Aprobación</h2>
              <p className="text-sm text-white/80">Revisar, aprobar y generar cotizaciones de nuevos pedidos</p>
            </div>
            <ArrowRightIcon className="w-8 h-8 text-white/50 group-hover:text-white transition-colors" />
          </div>
        </Link>
      </div>

      {/* 🔥 LISTA RÁPIDA DE PEDIDOS POR APROBAR */}
      {pedidosPendientes.length > 0 && (
        <div className="mt-8 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-[#232323] text-sm">Esperando aprobación</h3>
            <Link href="/cartera/pedidos" className="text-xs font-semibold text-[#1A0087] hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {pedidosPendientes.map((p) => (
              <Link key={p.id} href="/cartera/pedidos" className="flex justify-between items-center p-4 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-[#232323]">{p.clientes?.nombre || 'Sin cliente'}</p>
                  <p className="text-[11px] text-[#828282] mt-0.5">
                    #{String(p.id).slice(0, 6)} · {p.bodegas?.nombre || 'Bodega'} · {new Date(p.fecha).toLocaleDateString('es-CO')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#1A0087]">{formatCOP(p.total)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {pedidosPendientes.length === 0 && (
        <div className="mt-8 bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <CheckCircleIcon className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-green-800">¡Todo al día!</p>
          <p className="text-xs text-green-600 mt-1">No hay pedidos pendientes de aprobación.</p>
        </div>
      )}
    </div>
  )
}