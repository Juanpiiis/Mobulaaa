'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import Link from 'next/link'

export default function BodegueroPage() {
  const [pendientes, setPendientes] = useState(0)
  const [stockBajo, setStockBajo] = useState(0)
  const [totalProductos, setTotalProductos] = useState(0)
  const { tiendaActual } = useTienda()
  const supabase = createClient()

  useEffect(() => {
    if (!tiendaActual) return
    const cargar = async () => {
      const { count: ped } = await supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('bodega_id', tiendaActual.id).eq('estado', 'pendiente')
      const { data: inv } = await supabase.from('inventario').select('cantidad_disponible, cantidad_minima').eq('bodega_id', tiendaActual.id)
      setPendientes(ped || 0)
      setTotalProductos(inv?.length || 0)
      setStockBajo(inv?.filter(i => i.cantidad_disponible <= i.cantidad_minima).length || 0)
    }
    cargar()
  }, [tiendaActual])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Inicio</h1>
        <p className="text-gray-500 text-sm">{tiendaActual?.nombre}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/bodeguero/pedidos" className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 hover:shadow">
          <p className="text-yellow-700 font-bold text-3xl">{pendientes}</p>
          <p className="text-yellow-600">Pedidos pendientes</p>
        </Link>
        <Link href="/bodeguero/inventario" className="bg-red-50 border border-red-200 rounded-lg p-4 hover:shadow">
          <p className="text-red-700 font-bold text-3xl">{stockBajo}</p>
          <p className="text-red-600">Productos stock bajo</p>
        </Link>
        <Link href="/bodeguero/inventario" className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:shadow">
          <p className="text-blue-700 font-bold text-3xl">{totalProductos}</p>
          <p className="text-blue-600">Total productos</p>
        </Link>
      </div>
    </div>
  )
}