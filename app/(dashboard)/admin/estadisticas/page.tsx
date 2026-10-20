'use client'
import { useMemo, useState } from 'react'
import { useTienda } from '@/lib/context/TiendaContext'
import { FiltrosGlobales } from './_components/FiltrosGlobales'
import { VentasTab } from './_components/tabs/VentasTab'
import { ProductosTab } from './_components/tabs/ProductosTab'
import { VendedoresTab } from './_components/tabs/VendedoresTab'
import { ClientesTab } from './_components/tabs/ClientesTab'
import { PedidosTab } from './_components/tabs/PedidosTab'
import { BodegaTab } from './_components/tabs/BodegaTab'
import { MargenTab } from './_components/tabs/MargenTab'
import { FiltrosStats } from './_components/queries/types'

const TABS = [
  { id: 'ventas', label: '📈 Ventas' },
  { id: 'productos', label: '📦 Productos' },
  { id: 'vendedores', label: '🧑‍💼 Vendedores' },
  { id: 'clientes', label: '👥 Clientes' },
  { id: 'pedidos', label: '📋 Pedidos' },
  { id: 'bodega', label: '🏭 Bodega' },
  { id: 'margen', label: '💰 Margen' },
] as const

type TabId = typeof TABS[number]['id']

export default function EstadisticasPage() {
  const { tiendaActual, bodegas } = useTienda()
  const [tab, setTab] = useState<TabId>('ventas')

  const hoy = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)

  const [filtros, setFiltros] = useState<FiltrosStats>({
    tipo: 'mes',
    desde: inicioMes.toISOString().slice(0, 10),
    hasta: hoy.toISOString().slice(0, 10),
    bodegaId: tiendaActual?.id || null,
    comparar: true,
  })

  const contenido = useMemo(() => {
    switch (tab) {
      case 'ventas': return <VentasTab filtros={filtros} />
      case 'productos': return <ProductosTab filtros={filtros} />
      case 'vendedores': return <VendedoresTab filtros={filtros} />
      case 'clientes': return <ClientesTab filtros={filtros} />
      case 'pedidos': return <PedidosTab filtros={filtros} />
      case 'bodega': return <BodegaTab filtros={filtros} />
      case 'margen': return <MargenTab />
    }
  }, [tab, filtros])

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Estadísticas</h1>
        <p className="text-sm text-gray-500">{tiendaActual?.nombre || 'Todas las bodegas'}</p>
      </div>

      <FiltrosGlobales
        filtros={filtros}
        onChange={setFiltros}
        bodegas={bodegas.map((b) => ({ id: b.id, nombre: b.nombre }))}
        tiendaActualId={tiendaActual?.id}
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? 'bg-[#1A0087] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {contenido}
    </div>
  )
}