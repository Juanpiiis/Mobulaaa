'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  BuildingStorefrontIcon, UsersIcon, CubeIcon, DocumentTextIcon,
  ChartBarIcon, ClipboardDocumentListIcon, CurrencyDollarIcon, ExclamationTriangleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'

export default function AdminInicioPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    bodegas: 0,
    usuarios: 0,
    productos: 0,
    pedidosMes: 0,
    ventasMes: 0,
    alertasStock: 0
  })

  useEffect(() => {
    const cargar = async () => {
      setLoading(true)

      // 1. Globales (Bodegas, usuarios, productos)
      const { count: b } = await supabase.from('bodegas').select('*', { count: 'exact', head: true }).eq('activo', true)
      const { count: u } = await supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('activo', true)
      const { count: p } = await supabase.from('productos').select('*', { count: 'exact', head: true }).eq('activo', true)

      // 2. Ventas y pedidos del mes actual
      const inicioMes = new Date()
      inicioMes.setDate(1)
      inicioMes.setHours(0, 0, 0, 0)

      const { data: pedidosMes } = await supabase
        .from('pedidos')
        .select('total')
        .in('estado', ['aprobado_cartera', 'en_preparacion', 'listo_para_despacho', 'despachado', 'entregado'])
        .gte('fecha', inicioMes.toISOString())

      let ventas = 0
      pedidosMes?.forEach(p => ventas += Number(p.total || 0))

      // 3. Alertas de stock (agotados o bajo mínimo en TODAS las bodegas)
      const { data: inventario } = await supabase
        .from('inventario')
        .select('cantidad_disponible, cantidad_minima')

      let alertas = 0
      inventario?.forEach(i => {
        if (i.cantidad_disponible <= 0 || (i.cantidad_minima && i.cantidad_disponible < i.cantidad_minima)) {
          alertas++
        }
      })

      setStats({
        bodegas: b || 0,
        usuarios: u || 0,
        productos: p || 0,
        pedidosMes: pedidosMes?.length || 0,
        ventasMes: ventas,
        alertasStock: alertas
      })
      setLoading(false)
    }
    cargar()
  }, [supabase])

  const formatCOP = (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)

  const ACCESOS = [
    { name: 'Estadísticas', href: '/admin/estadisticas', icon: ChartBarIcon, color: 'bg-purple-50 text-purple-700' },
    { name: 'Pedidos', href: '/admin/pedidos', icon: DocumentTextIcon, color: 'bg-blue-50 text-blue-700' },
    { name: 'Productos', href: '/admin/productos', icon: CubeIcon, color: 'bg-green-50 text-green-700' },
    { name: 'Bodegas', href: '/admin/bodegas', icon: BuildingStorefrontIcon, color: 'bg-orange-50 text-orange-700' },
    { name: 'Usuarios', href: '/admin/usuarios', icon: UsersIcon, color: 'bg-yellow-50 text-yellow-700' },
    { name: 'Cortes', href: '/admin/cortes', icon: ClipboardDocumentListIcon, color: 'bg-red-50 text-red-700' },
  ]

  if (loading) return <div className="p-10 text-center text-gray-400">Cargando centro de control...</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#232323]">Centro de Control 👑</h1>
        <p className="text-sm text-[#828282] mt-1">Bienvenido al panel global de Mobulaa</p>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-green-50 text-green-700"><CurrencyDollarIcon className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-gray-500">Ventas del Mes</p>
            <p className="text-xl font-bold text-gray-800">{formatCOP(stats.ventasMes)}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-700"><DocumentTextIcon className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-gray-500">Pedidos del Mes</p>
            <p className="text-xl font-bold text-gray-800">{stats.pedidosMes}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-yellow-50 text-yellow-700"><ExclamationTriangleIcon className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-gray-500">Alertas de Stock</p>
            <p className="text-xl font-bold text-gray-800">{stats.alertasStock}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gray-50 text-gray-700"><UsersIcon className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-gray-500">Equipo Activo</p>
            <p className="text-xl font-bold text-gray-800">{stats.usuarios}</p>
          </div>
        </div>
      </div>

      {/* Resumen de infraestructura */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1A0087] text-white p-5 rounded-xl shadow-sm flex justify-between items-center">
          <div>
            <p className="text-white/70 text-sm">Bodegas Activas</p>
            <p className="text-2xl font-bold">{stats.bodegas}</p>
          </div>
          <BuildingStorefrontIcon className="w-8 h-8 text-white/30" />
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-gray-500 text-sm">Productos en Catálogo</p>
            <p className="text-2xl font-bold text-gray-800">{stats.productos}</p>
          </div>
          <CubeIcon className="w-8 h-8 text-gray-200" />
        </div>
      </div>

      {/* Accesos Rápidos */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-[#232323] mb-4">Gestión Rápida</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {ACCESOS.map(acc => (
            <Link key={acc.name} href={acc.href} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all flex flex-col items-center text-center group">
              <div className={`p-3 rounded-full mb-3 ${acc.color} group-hover:scale-110 transition-transform`}>
                <acc.icon className="w-5 h-5" />
              </div>
              <p className="font-semibold text-[#232323] text-sm">{acc.name}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Banner de Estadísticas */}
      <Link href="/admin/estadisticas" className="block mt-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white shadow-md hover:shadow-lg transition-all">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold mb-1">Analiza el rendimiento del negocio</h2>
            <p className="text-sm text-white/80">Ve los márgenes, los productos más vendidos y las estadísticas en tiempo real.</p>
          </div>
          <ArrowRightIcon className="w-8 h-8 text-white/50" />
        </div>
      </Link>
    </div>
  )
}