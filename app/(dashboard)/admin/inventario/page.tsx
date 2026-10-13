'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import { formatNum, formatCOP } from '@/lib/utils/dataExcel'

interface InventarioItem {
  id: string
  cantidad_disponible: number
  cantidad_minima: number
  productos: {
    nombre: string
    codigo: string
    categoria: string
    precio: number
    precio_mayorista: number
    precio_tat: number
  } | null
}

const inputClass =
  'w-full border border-gray-200 px-3 py-2.5 rounded-xl text-base min-h-[44px] focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 transition-colors'

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
        .select('*, productos(nombre, codigo, categoria, precio, precio_mayorista, precio_tat)')
        .eq('bodega_id', tiendaActual.id)
        .order('id')
      setInventario(data || [])
      setLoading(false)
    }
    cargar()
  }, [tiendaActual])

  // ✅ Categorías dinámicas (solo las que existen en el inventario)
  const categoriasDisponibles = useMemo(() => {
    const cats = inventario
      .map((item) => item.productos?.categoria)
      .filter((c): c is string => !!c)
    return [...new Set(cats)].sort()
  }, [inventario])

  const filtrados = inventario.filter((item) => {
    const matchCategoria = filtroCategoria
      ? item.productos?.categoria === filtroCategoria
      : true
    const matchBusqueda = busqueda
      ? item.productos?.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      item.productos?.codigo?.toLowerCase().includes(busqueda.toLowerCase())
      : true
    return matchCategoria && matchBusqueda
  })

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[#232323]">Inventario</h1>
        <p className="text-sm text-[#828282]">{tiendaActual?.nombre}</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <input
          className={inputClass}
          placeholder="Buscar por producto o código..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select
          className={`${inputClass} sm:max-w-[250px]`}
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categoriasDisponibles.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {(busqueda || filtroCategoria) && (
          <button
            onClick={() => {
              setBusqueda('')
              setFiltroCategoria('')
            }}
            className="min-h-[44px] px-4 py-2.5 text-sm text-[#1A0087] font-medium border border-[#1A0087]/30 rounded-xl hover:bg-[#1A0087]/5 active:scale-[0.98] transition-all"
          >
            Limpiar
          </button>
        )}
      </div>

      <p className="text-sm text-[#828282] mb-3">
        {filtrados.length} {filtrados.length === 1 ? 'producto' : 'productos'}
      </p>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Código</th>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Producto</th>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Categoría</th>
                  <th className="p-3 text-right text-xs font-semibold text-gray-500 uppercase">Precio</th>
                  <th className="p-3 text-right text-xs font-semibold text-gray-500 uppercase">Stock</th>
                  <th className="p-3 text-right text-xs font-semibold text-gray-500 uppercase">Mín.</th>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <p className="text-[#828282]">No se encontraron productos</p>
                    </td>
                  </tr>
                ) : (
                  filtrados.map((item) => (
                    <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className="p-3 text-sm text-[#828282] font-mono">
                        {item.productos?.codigo || '—'}
                      </td>
                      <td className="p-3 text-sm text-[#232323] font-medium">
                        {item.productos?.nombre || '—'}
                      </td>
                      <td className="p-3 text-sm text-[#828282]">
                        {item.productos?.categoria || '—'}
                      </td>
                      <td className="p-3 text-sm text-right font-medium text-[#232323]">
                        {formatCOP(item.productos?.precio || 0)}
                      </td>
                      <td className="p-3 text-right font-bold text-[#232323]">
                        {formatNum(item.cantidad_disponible)}
                      </td>
                      <td className="p-3 text-right text-sm text-[#828282]">
                        {formatNum(item.cantidad_minima)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${item.cantidad_disponible <= item.cantidad_minima
                              ? 'bg-red-50 text-red-700'
                              : 'bg-green-50 text-green-700'
                            }`}
                        >
                          {item.cantidad_disponible <= item.cantidad_minima
                            ? 'Stock bajo'
                            : 'OK'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}