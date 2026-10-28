'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import { formatNum, formatCOP } from '@/lib/utils/dataExcel'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  CubeIcon,
  PencilSquareIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

interface InventarioItem {
  id: string
  producto_id: string
  cantidad_disponible: number
  cantidad_minima: number
  productos: {
    nombre: string
    codigo: string
    categoria: string
    categoria_excel: string | null
    precio: number
    activo: boolean
  } | null
}

const inputClass =
  'w-full border border-gray-200 px-3 py-2.5 rounded-xl text-base min-h-[44px] focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 transition-colors bg-white'

export default function InventarioPage() {
  const [inventario, setInventario] = useState<InventarioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [soloAlertas, setSoloAlertas] = useState(false)

  // Estados para el Modal
  const [itemEditando, setItemEditando] = useState<InventarioItem | null>(null)
  const [nuevoMinimo, setNuevoMinimo] = useState('')
  const [guardando, setGuardando] = useState(false)

  const { tiendaActual } = useTienda()
  const supabase = createClient()

  // 1. Cargar datos de Supabase
  const cargarDatos = async () => {
    if (!tiendaActual) return
    setLoading(true)
    const { data } = await supabase
      .from('inventario')
      .select(`
        id, 
        producto_id,
        cantidad_disponible, 
        cantidad_minima,
        productos(
          nombre, 
          codigo, 
          categoria, 
          categoria_excel, 
          precio, 
          activo
        )
      `)
      .eq('bodega_id', tiendaActual.id)

    const items = (data || []).map((item: any) => {
      const prod = Array.isArray(item.productos) ? item.productos[0] : item.productos
      return {
        ...item,
        productos: prod || null,
      }
    })

    const activos = items.filter((item: any) => item.productos?.activo !== false)
    setInventario(activos as InventarioItem[])
    setLoading(false)
  }

  // 2. Efecto para cargar al entrar
  useEffect(() => {
    cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiendaActual])

  // 3. Categorías dinámicas
  const categoriasDisponibles = useMemo(() => {
    const cats = inventario
      .map((item) => item.productos?.categoria_excel || item.productos?.categoria)
      .filter((c): c is string => !!c)
    return [...new Set(cats)].sort()
  }, [inventario])

  // 4. KPIs
  const kpis = useMemo(() => {
    let total = inventario.length
    let bajoMinimo = 0
    let agotados = 0
    inventario.forEach(i => {
      if (i.cantidad_disponible <= 0) agotados++
      else if (i.cantidad_disponible <= i.cantidad_minima) bajoMinimo++
    })
    return { total, bajoMinimo, agotados }
  }, [inventario])

  // 5. Filtros aplicados
  const filtrados = inventario.filter((item) => {
    const catProducto = item.productos?.categoria_excel || item.productos?.categoria
    const matchCategoria = filtroCategoria ? catProducto === filtroCategoria : true

    const q = busqueda.toLowerCase()
    const matchBusqueda = busqueda
      ? item.productos?.nombre.toLowerCase().includes(q) ||
      item.productos?.codigo?.toLowerCase().includes(q)
      : true

    const matchAlerta = soloAlertas
      ? item.cantidad_disponible <= item.cantidad_minima
      : true

    return matchCategoria && matchBusqueda && matchAlerta
  })

  // 6. Guardar el nuevo mínimo
  const handleGuardarMinimo = async () => {
    if (!itemEditando) return
    setGuardando(true)
    const valorMinimo = parseInt(nuevoMinimo) || 0

    const { error } = await supabase
      .from('inventario')
      .update({ cantidad_minima: valorMinimo })
      .eq('id', itemEditando.id)

    if (!error) {
      setInventario(prev => prev.map(item =>
        item.id === itemEditando.id ? { ...item, cantidad_minima: valorMinimo } : item
      ))
      setItemEditando(null)
    } else {
      alert('Error al guardar: ' + error.message)
    }
    setGuardando(false)
  }

  // 7. Calcular el ancho de la barra
  const getBarWidth = (stock: number, minima: number) => {
    if (stock <= 0) return 0
    const maxRef = Math.max(minima * 3, 50)
    const pct = (stock / maxRef) * 100
    return Math.min(Math.max(pct, 5), 100)
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#232323]">Inventario</h1>
        <p className="text-sm text-[#828282]">{tiendaActual?.nombre}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg"><CubeIcon className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Productos</p>
            <p className="text-lg font-bold text-gray-800">{kpis.total}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-yellow-50 text-yellow-600 rounded-lg"><ExclamationTriangleIcon className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Bajo Mínimo</p>
            <p className="text-lg font-bold text-yellow-600">{kpis.bajoMinimo}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-red-50 text-red-600 rounded-lg"><ExclamationTriangleIcon className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Agotados</p>
            <p className="text-lg font-bold text-red-600">{kpis.agotados}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className={`${inputClass} pl-10`}
              placeholder="Buscar por producto o código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="relative sm:w-[250px]">
            <FunnelIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              className={`${inputClass} pl-10 appearance-none`}
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categoriasDisponibles.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input
              type="checkbox"
              checked={soloAlertas}
              onChange={(e) => setSoloAlertas(e.target.checked)}
              className="w-4 h-4 text-[#1A0087] rounded border-gray-300 focus:ring-[#1A0087]"
            />
            Mostrar solo alertas (Bajo mínimo / Agotados)
          </label>

          {(busqueda || filtroCategoria || soloAlertas) && (
            <button
              onClick={() => {
                setBusqueda('')
                setFiltroCategoria('')
                setSoloAlertas(false)
              }}
              className="text-xs text-[#1A0087] font-semibold hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-[#828282] px-1">
        Mostrando <span className="font-bold text-[#232323]">{filtrados.length}</span> productos
      </p>

      {/* Tabla de Inventario */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Producto</th>
                  <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Categoría</th>
                  <th className="p-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="p-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-1/3">Nivel (Clic para ajustar Mín.)</th>
                  <th className="p-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <CubeIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">No se encontraron productos con estos filtros.</p>
                    </td>
                  </tr>
                ) : (
                  filtrados.map((item) => {
                    const stock = item.cantidad_disponible
                    const minima = item.cantidad_minima
                    const isAgotado = stock <= 0
                    const isBajo = stock > 0 && stock <= minima
                    const width = getBarWidth(stock, minima)

                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4">
                          <p className="text-sm font-semibold text-[#232323]">{item.productos?.nombre || '—'}</p>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5">{item.productos?.codigo || 'Sin código'}</p>
                        </td>

                        <td className="p-4 text-sm text-gray-600">
                          <span className="bg-gray-100 px-2 py-1 rounded-md text-xs font-medium">
                            {item.productos?.categoria_excel || item.productos?.categoria || '—'}
                          </span>
                        </td>

                        <td className="p-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-lg text-base font-bold tabular-nums min-w-[60px] ${isAgotado ? 'bg-red-50 text-red-700' :
                            isBajo ? 'bg-yellow-50 text-yellow-700' :
                              'text-[#232323]'
                            }`}>
                            {formatNum(stock)}
                          </span>
                        </td>

                        {/* BARRA INTERACTIVA */}
                        <td className="p-4">
                          <div
                            className="flex items-center gap-3 cursor-pointer group"
                            onClick={() => {
                              setItemEditando(item)
                              setNuevoMinimo(String(minima))
                            }}
                            title="Haz clic para cambiar el stock mínimo"
                          >
                            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden relative group-hover:ring-2 ring-[#1A0087]/20 transition-all">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${isAgotado ? 'bg-red-500' :
                                  isBajo ? 'bg-yellow-400' :
                                    'bg-green-500'
                                  }`}
                                style={{ width: `${width}%` }}
                              />
                              {minima > 0 && (
                                <div
                                  className="absolute top-0 bottom-0 w-0.5 bg-gray-800 opacity-40 z-10"
                                  style={{ left: `${(minima / Math.max(minima * 3, 50)) * 100}%` }}
                                />
                              )}
                            </div>

                            <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 group-hover:text-[#1A0087] transition-colors w-16 justify-end">
                              <span>Mín: {minima}</span>
                              <PencilSquareIcon className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </td>

                        <td className="p-4 text-center">
                          {isAgotado ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-700">Agotado</span>
                          ) : isBajo ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-yellow-100 text-yellow-700">Bajo Mín.</span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-green-50 text-green-700">OK</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL */}
      {itemEditando && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-[#232323]">Ajustar Nivel Mínimo</h3>
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{itemEditando.productos?.nombre}</p>
              </div>
              <button onClick={() => setItemEditando(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg flex gap-2 items-start">
                <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                <p>La <strong>línea oscura</strong> en la barra te indica dónde está el mínimo actual. Al cambiarlo, la alerta se activará cuando el stock baje de ese nivel.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nuevo límite de alerta
                </label>
                <input
                  type="number"
                  value={nuevoMinimo}
                  onChange={(e) => setNuevoMinimo(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center text-2xl font-bold text-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/30 focus:border-[#1A0087]"
                  placeholder="0"
                  autoFocus
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2">
              <button
                onClick={() => setItemEditando(null)}
                disabled={guardando}
                className="flex-1 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarMinimo}
                disabled={guardando}
                className="flex-1 py-3 bg-[#1A0087] text-white rounded-xl text-sm font-semibold hover:bg-[#130066] transition-colors flex items-center justify-center gap-2"
              >
                {guardando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}