'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'

interface InventarioItem {
  id: string
  cantidad_disponible: number
  productos: { nombre: string; codigo: string; categoria: string; descripcion: string }
}

const CATEGORIAS = ['AUDIFONO', 'CARGADOR', 'CABLES', 'RELOJ', 'PARLANTES', 'DIADEMAS', 'POWER BANK', 'CELULAR', 'TABLET', 'COMPUTADOR', 'VENTILADOR', 'OTROS']

export default function CatalogoPage() {
  const [inventario, setInventario] = useState<InventarioItem[]>([])
  const [filtrados, setFiltrados] = useState<InventarioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const { tiendaActual } = useTienda()
  const supabase = createClient()

  useEffect(() => {
    if (!tiendaActual) return
    const cargar = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('inventario')
        .select('*, productos(nombre, codigo, categoria, descripcion)')
        .eq('bodega_id', tiendaActual.id)
        .gt('cantidad_disponible', 0)
      setInventario(data || [])
      setFiltrados(data || [])
      setLoading(false)
    }
    cargar()
  }, [tiendaActual])

  useEffect(() => {
    let result = inventario
    if (busqueda) result = result.filter(i => i.productos?.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    if (filtroCategoria) result = result.filter(i => i.productos?.categoria === filtroCategoria)
    setFiltrados(result)
  }, [busqueda, filtroCategoria, inventario])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Catálogo</h1>
        <p className="text-gray-500 text-sm">{tiendaActual?.nombre}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-3">
        <input className="flex-1 border p-2 rounded" placeholder="Buscar producto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select className="border p-2 rounded" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => { setBusqueda(''); setFiltroCategoria('') }} className="text-sm text-blue-600 hover:underline">Limpiar</button>
      </div>

      <p className="text-sm text-gray-500 mb-3">{filtrados.length} productos disponibles</p>

      {loading ? <p>Cargando...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map(item => (
            <div key={item.id} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition">
              <h3 className="font-bold">{item.productos?.nombre}</h3>
              <p className="text-gray-400 text-xs mb-2">{item.productos?.codigo}</p>
              <p className="text-sm mb-1"><span className="font-medium">Categoría:</span> {item.productos?.categoria}</p>
              <p className="text-sm"><span className="font-medium">Stock:</span> {item.cantidad_disponible}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}