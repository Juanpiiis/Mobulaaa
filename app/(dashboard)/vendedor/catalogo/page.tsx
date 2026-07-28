'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface InventarioItem {
  id: string
  cantidad_disponible: number
  productos: { nombre: string; codigo: string; categoria: string; descripcion: string }
  bodegas: { nombre: string }
}

export default function CatalogoPage() {
  const [inventario, setInventario] = useState<InventarioItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase
        .from('inventario')
        .select('*, productos(nombre, codigo, categoria, descripcion), bodegas(nombre)')
        .gt('cantidad_disponible', 0)
      setInventario(data || [])
      setLoading(false)
    }
    cargar()
  }, [])

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <h1>Catálogo de Productos</h1>
      </div>

      {loading ? <p>Cargando...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {inventario.map(item => (
            <div key={item.id} className="card-catalogo">
              <h3>{item.productos?.nombre}</h3>
              <p className="codigo">{item.productos?.codigo}</p>
              <p className="descripcion">{item.productos?.descripcion}</p>
              <p className="info-line"><strong>Categoría:</strong> {item.productos?.categoria}</p>
              <p className="info-line"><strong>Bodega:</strong> {item.bodegas?.nombre}</p>
              <p className="stock-line">Stock: {item.cantidad_disponible}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}