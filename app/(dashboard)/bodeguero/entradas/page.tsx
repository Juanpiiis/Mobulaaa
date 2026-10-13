'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import { esProductoCongelado, motivoCongelado } from '@/lib/hooks/useBuscarProducto'
import {
  MagnifyingGlassIcon,
  XCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowUpTrayIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'

interface ProductoInventario {
  id: string
  nombre: string
  categoria: string | null
  sku: string | null
  stock_actual: number
  congelado_manual: boolean
  limite_congelado: number | null
}

export default function EntradasPage() {
  const [productos, setProductos] = useState<ProductoInventario[]>([])
  const [loadingProductos, setLoadingProductos] = useState(true)
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [form, setForm] = useState({ producto_id: '', cantidad: '', observacion: '' })
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoInventario | null>(null)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState('')
  const { tiendaActual } = useTienda()
  const supabase = createClient()

  // ─────────────────────────────────────────────
  // Cargar productos de esta bodega
  // ─────────────────────────────────────────────
  const cargarProductos = async () => {
    if (!tiendaActual) return
    setLoadingProductos(true)

    const { data, error: err } = await supabase
      .from('inventario')
      .select(`
        cantidad_disponible,
        congelado_manual,
        limite_congelado,
        productos!inner(id, nombre, categoria, sku, activo)
      `)
      .eq('bodega_id', tiendaActual.id)
      .eq('productos.activo', true)

    if (err) {
      console.error('Error cargando productos:', err)
      setError('No se pudieron cargar los productos: ' + err.message)
      setLoadingProductos(false)
      return
    }

    const items: ProductoInventario[] = (data || [])
      .map((i: any) => ({
        id: i.productos?.id,
        nombre: i.productos?.nombre,
        categoria: i.productos?.categoria,
        sku: i.productos?.sku,
        stock_actual: i.cantidad_disponible || 0,
        congelado_manual: i.congelado_manual ?? false,
        limite_congelado: i.limite_congelado ?? null,
      }))
      .filter((p: any) => p.id)

    setProductos(items)
    setLoadingProductos(false)
  }

  useEffect(() => {
    cargarProductos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiendaActual])

  // ─────────────────────────────────────────────
  // Categorías dinámicas de la BD
  // ─────────────────────────────────────────────
  const categoriasDisponibles = useMemo(() => {
    const set = new Set<string>()
    productos.forEach((p) => {
      const cat = (p.categoria || '').trim()
      if (cat) set.add(cat)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [productos])

  // ─────────────────────────────────────────────
  // Filtrado
  // ─────────────────────────────────────────────
  const productosFiltrados = useMemo(() => {
    let filtrados = productos
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      filtrados = filtrados.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q)
      )
    }
    if (filtroCategoria) {
      filtrados = filtrados.filter((p) => p.categoria === filtroCategoria)
    }
    return filtrados.slice(0, 20)
  }, [busqueda, filtroCategoria, productos])

  const seleccionarProducto = (p: ProductoInventario) => {
    setProductoSeleccionado(p)
    setForm({ ...form, producto_id: p.id })
    setBusqueda(p.nombre)
    setError('')
  }

  const limpiarSeleccion = () => {
    setProductoSeleccionado(null)
    setForm({ producto_id: '', cantidad: '', observacion: '' })
    setBusqueda('')
    setError('')
  }

  // ─────────────────────────────────────────────
  // Guardar entrada
  // ─────────────────────────────────────────────
  const handleGuardar = async () => {
    setError('')
    setExito(false)

    if (!form.producto_id) {
      setError('Selecciona un producto')
      return
    }
    if (!form.cantidad) {
      setError('Ingresa la cantidad')
      return
    }
    if (!tiendaActual) {
      setError('No hay bodega seleccionada')
      return
    }

    const cantidad = parseInt(form.cantidad)
    if (isNaN(cantidad) || cantidad <= 0) {
      setError('La cantidad debe ser un número mayor a 0')
      return
    }

    // Validar congelado
    if (productoSeleccionado && esProductoCongelado(productoSeleccionado as any)) {
      const confirmar = window.confirm(
        `⚠️ Este producto está congelado:\n\n${motivoCongelado(productoSeleccionado as any)}\n\n` +
        `¿Igual querés registrar la entrada?`
      )
      if (!confirmar) return
    }

    setLoading(true)

    const { data, error: errRpc } = await supabase.rpc('ajustar_stock', {
      p_producto: form.producto_id,
      p_bodega: tiendaActual.id,
      p_delta: cantidad,
      p_tipo: 'entrada',
      p_obs: form.observacion || null,
    })

    if (errRpc) {
      console.error('Error registrando entrada:', errRpc)
      setError('Error al registrar la entrada: ' + errRpc.message)
      setLoading(false)
      return
    }

    void data

    limpiarSeleccion()
    setLoading(false)
    setExito(true)

    cargarProductos()

    setTimeout(() => setExito(false), 3000)
  }

  const formatNum = (n: number) => n.toLocaleString('es-CO')

  return (
    <div className="min-h-screen bg-[#F7F7FB] w-full">
      {/* HEADER */}
      <header className="sticky top-[calc(var(--main-padding)*-1)] -mx-[var(--main-padding)] -mt-[var(--main-padding)] z-20 bg-white border-b border-gray-100">
        <div className="w-full px-4 sm:px-6 py-4">
          <h1 className="text-xl sm:text-2xl font-bold text-[#232323]">
            Entrada de Mercancía
          </h1>
          <p className="text-sm text-[#828282] mt-0.5">
            {tiendaActual?.nombre || 'Sin bodega'}
          </p>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 py-6 max-w-2xl mx-auto space-y-5">

        {exito && (
          <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl text-sm flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
            <div>Entrada registrada y stock actualizado</div>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-start gap-3">
            <XCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">

          {/* Selector de categoría (dinámico) */}
          <div>
            <label className="block text-sm font-medium text-[#232323] mb-1.5">
              Categoría
            </label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              disabled={loading || loadingProductos}
              className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 bg-white disabled:opacity-50"
            >
              <option value="">Todas las categorías</option>
              {categoriasDisponibles.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Buscador de producto */}
          <div>
            <label className="block text-sm font-medium text-[#232323] mb-1.5">
              Buscar producto
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value)
                  setProductoSeleccionado(null)
                  setForm({ ...form, producto_id: '' })
                }}
                disabled={loading || loadingProductos}
                placeholder="Nombre o SKU..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 disabled:opacity-50"
              />
              {loadingProductos && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {busqueda && !productoSeleccionado && productosFiltrados.length > 0 && (
              <div className="border border-gray-200 rounded-xl mt-2 max-h-64 overflow-y-auto bg-white shadow-sm">
                {productosFiltrados.map((p) => {
                  const congelado = esProductoCongelado(p as any)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => seleccionarProducto(p)}
                      disabled={loading}
                      className="w-full text-left px-3 py-2.5 hover:bg-[#1A0087]/5 active:bg-[#1A0087]/10 border-b border-gray-100 last:border-b-0 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#232323] truncate">
                            {p.nombre}
                          </p>
                          <p className="text-xs text-[#828282] mt-0.5">
                            {p.sku && <span className="font-mono">{p.sku}</span>}
                            {p.sku && p.categoria && ' · '}
                            {p.categoria}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-[#828282]">Stock</p>
                          <p className="text-sm font-semibold text-[#232323] tabular-nums">
                            {formatNum(p.stock_actual)}
                          </p>
                        </div>
                      </div>
                      {congelado && (
                        <p className="text-[10px] text-red-600 font-medium mt-1 flex items-center gap-1">
                          <LockClosedIcon className="w-3 h-3" />
                          Congelado
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {busqueda && !productoSeleccionado && !loadingProductos && productosFiltrados.length === 0 && (
              <div className="border border-gray-200 rounded-xl mt-2 p-4 text-center bg-white">
                <p className="text-sm text-[#828282]">Sin resultados</p>
              </div>
            )}
          </div>

          {/* Producto seleccionado */}
          {productoSeleccionado && (
            <div className="bg-[#1A0087]/5 border border-[#1A0087]/20 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#232323] truncate">
                    {productoSeleccionado.nombre}
                  </p>
                  <p className="text-xs text-[#828282] mt-0.5">
                    {productoSeleccionado.sku && <span className="font-mono">{productoSeleccionado.sku}</span>}
                    {productoSeleccionado.sku && productoSeleccionado.categoria && ' · '}
                    {productoSeleccionado.categoria}
                  </p>
                  <p className="text-xs text-[#828282] mt-1">
                    Stock actual:{' '}
                    <span className="font-semibold text-[#232323] tabular-nums">
                      {formatNum(productoSeleccionado.stock_actual)}
                    </span>
                    {form.cantidad && !isNaN(parseInt(form.cantidad)) && parseInt(form.cantidad) > 0 && (
                      <>
                        {' → '}
                        <span className="font-semibold text-green-600 tabular-nums">
                          {formatNum(productoSeleccionado.stock_actual + parseInt(form.cantidad))}
                        </span>
                      </>
                    )}
                  </p>
                  {esProductoCongelado(productoSeleccionado as any) && (
                    <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                      <LockClosedIcon className="w-3 h-3" />
                      {motivoCongelado(productoSeleccionado as any)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={limpiarSeleccion}
                  disabled={loading}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-red-500 transition-colors disabled:opacity-50"
                  aria-label="Quitar selección"
                >
                  <XCircleIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Cantidad */}
          <div>
            <label className="block text-sm font-medium text-[#232323] mb-1.5">
              Cantidad que entra
            </label>
            <input
              type="number"
              min="1"
              placeholder="0"
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
              disabled={loading}
              className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 disabled:opacity-50"
            />
          </div>

          {/* Observación */}
          <div>
            <label className="block text-sm font-medium text-[#232323] mb-1.5">
              Observación (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Llegó proveedor, factura #123"
              value={form.observacion}
              onChange={(e) => setForm({ ...form, observacion: e.target.value })}
              disabled={loading}
              className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 disabled:opacity-50"
            />
          </div>

          {/* Advertencia congelado */}
          {productoSeleccionado && esProductoCongelado(productoSeleccionado as any) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Este producto está congelado. Igual podés registrar la entrada, pero el admin debería revisar el congelado.
              </p>
            </div>
          )}

          {/* Botón */}
          <button
            onClick={handleGuardar}
            disabled={loading || !form.producto_id || !form.cantidad || loadingProductos}
            className="w-full min-h-[48px] py-3 bg-[#1A0087] text-white rounded-xl text-sm font-semibold hover:bg-[#130066] active:scale-[0.98] disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <ArrowUpTrayIcon className="w-5 h-5" />
                Registrar Entrada
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  )
}