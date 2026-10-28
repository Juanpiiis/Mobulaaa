'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import Link from 'next/link'
import { ShoppingBagIcon, CurrencyDollarIcon, ClockIcon, PlusIcon } from '@heroicons/react/24/outline'

// Componente KpiCard local (para no depender de la carpeta de estadísticas)
function KpiLocal({ label, value, color, icon }: any) {
  const map: any = { green: 'bg-green-50 text-green-700', blue: 'bg-blue-50 text-blue-700', yellow: 'bg-yellow-50 text-yellow-700' }
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
      <div className={`p-3 rounded-xl ${map[color]}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  )
}

export default function VendedorInicioPage() {
  const { tiendaActual } = useTienda()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ ventasMes: 0, pedidosMes: 0, pendientes: 0 })
  const [nombre, setNombre] = useState('')

  useEffect(() => {
    const cargar = async () => {
      if (!tiendaActual) return
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: perfil } = await supabase.from('usuarios').select('nombre').eq('id', user.id).single()
      if (perfil) setNombre(perfil.nombre)

      const inicioMes = new Date()
      inicioMes.setDate(1)
      inicioMes.setHours(0, 0, 0, 0)

      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('total, estado')
        .eq('vendedor_id', user.id)
        .eq('bodega_id', tiendaActual.id)
        .gte('fecha', inicioMes.toISOString())

      if (pedidos) {
        let ventasMes = 0, pedidosMes = 0, pendientes = 0
        pedidos.forEach(p => {
          if (['aprobado_cartera', 'en_preparacion', 'listo_para_despacho', 'despachado', 'entregado'].includes(p.estado)) {
            ventasMes += p.total || 0
            pedidosMes++
          }
          if (p.estado === 'pendiente') pendientes++
        })
        setStats({ ventasMes, pedidosMes, pendientes })
      }
      setLoading(false)
    }
    cargar()
  }, [tiendaActual, supabase])

  const formatCOP = (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)

  if (loading) return <div className="p-10 text-center text-gray-400">Cargando tu resumen...</div>

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#232323]">Hola, {nombre.split(' ')[0] || 'Vendedor'} 👋</h1>
        <p className="text-sm text-[#828282] mt-1">Este es tu resumen del mes en <strong className="text-[#1A0087]">{tiendaActual?.nombre}</strong></p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiLocal label="Ventas aprobadas" value={formatCOP(stats.ventasMes)} color="green" icon={<CurrencyDollarIcon className="w-6 h-6" />} />
        <KpiLocal label="Pedidos aprobados" value={stats.pedidosMes} color="blue" icon={<ShoppingBagIcon className="w-6 h-6" />} />
        <KpiLocal label="Pendientes de cartera" value={stats.pendientes} color="yellow" icon={<ClockIcon className="w-6 h-6" />} />
      </div>

      <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm text-center mt-8">
        <div className="w-16 h-16 bg-[#1A0087]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShoppingBagIcon className="w-8 h-8 text-[#1A0087]" />
        </div>
        <h2 className="text-lg font-bold text-[#232323] mb-2">¿Listo para vender?</h2>
        <p className="text-sm text-[#828282] mb-6">Crea un pedido nuevo o revisa el estado de los que ya enviaste.</p>
        <Link href="/vendedor/mis-pedidos" className="inline-flex items-center gap-2 bg-[#1A0087] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#130066] active:scale-[0.98] transition-all shadow-sm">
          <PlusIcon className="w-5 h-5" /> Ir a Mis Pedidos
        </Link>
      </div>
    </div>
  )
}