'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'

interface InventarioItem {
  id: string
  cantidad_disponible: number
  cantidad_minima: number
  productos: { nombre: string; codigo: string; categoria: string }
}

const CATEGORIAS = ['AUDIFONO', 'CARGADOR', 'CABLES', 'RELOJ', 'PARLANTES', 'DIADEMAS', 'POWER BANK', 'CELULAR', 'TABLET', 'COMPUTADOR', 'VENTILADOR', 'OTROS']

export default function InventarioPage() {
  const [inventario, setInventario] = useState<InventarioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const { tiendaActual } = useTienda()
  const supabase = createClient()

  useEffect(() => {
    if (!tiendaActual) return
    const cargar = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('inventario')
        .select('*, productos(nombre, codigo, categoria)')
        .eq('bodega_id', tiendaActual.id)
      setInventario(data || [])
      setLoading(false)
    }
    cargar()
  }, [tiendaActual])

  const filtrados = inventario.filter(item => {
    const matchCategoria = filtroCategoria ? item.productos?.categoria === filtroCategoria : true
    const matchBusqueda = busqueda ? item.productos?.nombre.toLowerCase().includes(busqueda.toLowerCase()) : true
    return matchCategoria && matchBusqueda
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inventario</h1>
          <p className="text-gray-500 text-sm">{tiendaActual?.nombre}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-3">
        <input
          className="flex-1 border p-2 rounded"
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <select className="border p-2 rounded" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => { setBusqueda(''); setFiltroCategoria('') }} className="text-sm text-blue-600 hover:underline">Limpiar</button>
      </div>

      <p className="text-sm text-gray-500 mb-3">{filtrados.length} productos</p>

      {loading ? <p>Cargando...</p> : (
        <table className="w-full bg-white rounded-lg shadow">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Código</th>
              <th className="p-3 text-left">Producto</th>
              <th className="p-3 text-left">Categoría</th>
              <th className="p-3 text-left">Stock</th>
              <th className="p-3 text-left">Stock Mínimo</th>
              <th className="p-3 text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(item => (
              <tr key={item.id} className="border-t hover:bg-gray-50">
                <td className="p-3 text-sm">{item.productos?.codigo}</td>
                <td className="p-3 text-sm">{item.productos?.nombre}</td>
                <td className="p-3 text-sm">{item.productos?.categoria}</td>
                <td className="p-3 font-medium">{item.cantidad_disponible}</td>
                <td className="p-3">{item.cantidad_minima}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${item.cantidad_disponible <= item.cantidad_minima ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {item.cantidad_disponible <= item.cantidad_minima ? 'Stock bajo' : 'OK'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}