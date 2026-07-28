'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface InventarioItem {
  id: string
  cantidad_disponible: number
  cantidad_minima: number
  productos: { nombre: string; codigo: string; categoria: string }
  bodegas: { nombre: string }
}

export default function InventarioPage() {
  const [inventario, setInventario] = useState<InventarioItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase
        .from('inventario')
        .select('*, productos(nombre, codigo, categoria), bodegas(nombre)')
      setInventario(data || [])
      setLoading(false)
    }
    cargar()
  }, [])

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <h1>Inventario</h1>
      </div>

      {loading ? <p>Cargando...</p> : (
        <table className="tabla-mobulaa">
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Bodega</th>
              <th>Stock</th>
              <th>Stock Mínimo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {inventario.map(item => (
              <tr key={item.id}>
                <td>{item.productos?.codigo}</td>
                <td>{item.productos?.nombre}</td>
                <td>
                  <span className="badge-categoria">{item.productos?.categoria}</span>
                </td>
                <td>{item.bodegas?.nombre}</td>
                <td>{item.cantidad_disponible}</td>
                <td>{item.cantidad_minima}</td>
                <td>
                  <span className={item.cantidad_disponible <= item.cantidad_minima ? 'badge-stock-bajo' : 'badge-stock-ok'}>
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