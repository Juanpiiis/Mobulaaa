'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  CubeIcon,
} from '@heroicons/react/24/outline'

interface Producto {
  id: string
  nombre: string
  categoria: string | null
  codigo: string | null
  stock_disponible: number
}

interface Categoria {
  id: string
  nombre: string
}

const inputClass =
  'w-full border border-gray-200 px-3 py-2.5 rounded-xl text-base min-h-[44px] focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 transition-colors'

export default function EntradasPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [registrando, setRegistrando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [form, setForm] = useState({ producto_id: '', cantidad: '', observacion: '' })
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState('')
  const { tiendaActual } = useTienda()
  const supabase = createClient()

  // ─────────────────────────────────────────────
  // Cargar productos + categorías
  // ─────────────────────────────────────────────
  const cargarDatos = async () => {
    if (!tiendaActual) return
    setLoading(true)
    setError('')

    const { data: inv, error: errInv } = await supabase
      .from('inventario')
      .select(`
        cantidad_disponible,
        productos!inner(
          id, nombre, categoria, codigo
        )
      `)
      .eq('bodega_id', tiendaActual.id)
      .gt('cantidad_disponible', 0)

    if (errInv) {
      console.error('Error cargando inventario:', errInv)
      setError('No se pudieron cargar los productos: ' + errInv.message)
      setLoading(false)
      return
    }

    const items: Producto[] = (inv || [])
      .map((i: any) => ({
        id: i.productos?.id,
        nombre: i.productos?.nombre,
        categoria: i.productos?.categoria,
        codigo: i.productos?.codigo,
        stock_disponible: i.cantidad_disponible || 0,
      }))
      .filter((p: any) => p.id)

    setProductos(items)

    const { data: c, error: errC } = await supabase
      .from('categorias')
      .select('id, nombre')
      .order('nombre')

    if (errC) {
      console.error('Error cargando categorías:', errC)
    } else {
      setCategorias(c || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiendaActual?.id])

  // ─────────────────────────────────────────────
  // Filtrado
  // ─────────────────────────────────────────────
  const productosFiltrados = useMemo(() => {
    let filtrados = productos
    if (busqueda) {
      const q = busqueda.toLowerCase()
      filtrados = filtrados.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        (p.codigo || '').toLowerCase().includes(q)
      )
    }
    if (filtroCategoria) {
      filtrados = filtrados.filter(p => p.categoria === filtroCategoria)
    }
    return filtrados
  }, [busqueda, filtroCategoria, productos])

  const seleccionarProducto = (p: Producto) => {
    setProductoSeleccionado(p)
    setForm({ ...form, producto_id: p.id })
    setBusqueda(p.nombre)
    setError('')
    setExito(false)
  }

  const limpiarSeleccion = () => {
    setProductoSeleccionado(null)
    setForm({ producto_id: '', cantidad: '', observacion: '' })
    setBusqueda('')
    setError('')
  }

  const handleGuardar = async () => {
    setError('')
    setExito(false)

    if (!form.producto_id) { setError('Selecciona un producto'); return }
    if (!form.cantidad) { setError('Ingresa la cantidad'); return }
    if (!tiendaActual) { setError('No hay bodega seleccionada'); return }

    const cantidad = parseInt(form.cantidad)
    if (isNaN(cantidad) || cantidad <= 0) {
      setError('La cantidad debe ser un número mayor a 0')
      return
    }

    setRegistrando(true)

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
      setRegistrando(false)
      return
    }

    void data

    limpiarSeleccion()
    setRegistrando(false)
    setExito(true)
    setTimeout(() => setExito(false), 3000)

    // Recargar productos para actualizar stock
    cargarDatos()
  }

  const stockResultante = (() => {
    if (!productoSeleccionado || !form.cantidad) return null
    const cant = parseInt(form.cantidad)
    if (isNaN(cant) || cant <= 0) return null
    return productoSeleccionado.stock_disponible + cant
  })()

  return (
    <div className="min-h-screen bg-[#F7F7FB] w-full">
      {/* HEADER */}
      <header className="sticky top-[calc(var(--main-padding)*-1)] -mx-[var(--main-padding)] -mt-[var(--main-padding)] z-20 bg-white border-b border-gray-100">
        <div className="w-full px-4 sm:px-6 py-4">
          <h1 className="text-xl sm:text-2xl font-bold text-[#232323]">
            Entrada de Mercancía
          </h1>
          <p className="text-sm text-[#828282] mt-0.5">
            {tiendaActual?.nombre}
          </p>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 py-6 max-w-2xl mx-auto space-y-4">

        {/* Éxito */}
        {exito && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-sm flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Entrada registrada</p>
              <p className="text-xs mt-0.5">El stock se actualizó correctamente.</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-start gap-3">
            <XCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Error</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Card: datos */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">

          {/* Filtro categoría */}
          <div>
            <label className="block text-sm font-medium text-[#232323] mb-1.5">
              Categoría
            </label>
            <select
              className={`${inputClass} bg-white`}
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              disabled={loading}
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.nombre}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Buscador de producto */}
          <div>
            <label className="block text-sm font-medium text-[#232323] mb-1.5">
              Producto
            </label>

            {productoSeleccionado ? (
              <div className="flex items-center gap-3 bg-[#1A0087]/5 border border-[#1A0087]/20 rounded-xl p-3">
                <div className="w-10 h-10 rounded-lg bg-[#1A0087]/10 flex items-center justify-center shrink-0">
                  <CubeIcon className="w-5 h-5 text-[#1A0087]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#232323] truncate">
                    {productoSeleccionado.nombre}
                  </p>
                  <p className="text-xs text-[#828282] mt-0.5">
                    {productoSeleccionado.codigo || 'Sin código'} · Stock actual: {productoSeleccionado.stock_disponible}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={limpiarSeleccion}
                  className="shrink-0 min-h-[36px] px-3 text-xs font-medium text-[#828282] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  className={`${inputClass} pl-9`}
                  placeholder="Buscar por nombre o código..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  disabled={loading}
                />
                {busqueda && productosFiltrados.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                    {productosFiltrados.slice(0, 20).map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => seleccionarProducto(p)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 active:bg-gray-100 border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <p className="text-sm text-[#232323] truncate">
                          {p.nombre}
                        </p>
                        <p className="text-[11px] text-[#828282] mt-0.5 flex items-center gap-2">
                          {p.codigo && <span className="font-mono">{p.codigo}</span>}
                          {p.codigo && <span>·</span>}
                          <span>Stock: {p.stock_disponible}</span>
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {busqueda && productosFiltrados.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-center">
                    <p className="text-xs text-[#828282]">
                      No se encontraron productos con "{busqueda}"
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cantidad */}
          <div>
            <label className="block text-sm font-medium text-[#232323] mb-1.5">
              Cantidad que entra
            </label>
            <input
              className={inputClass}
              type="number"
              min="1"
              placeholder="0"
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
              disabled={registrando}
            />
            {stockResultante !== null && (
              <p className="text-xs text-green-700 mt-1.5">
                Quedará en stock: <span className="font-semibold">{stockResultante} unidades</span>
              </p>
            )}
          </div>

          {/* Observación */}
          <div>
            <label className="block text-sm font-medium text-[#232323] mb-1.5">
              Observación <span className="text-[#828282] font-normal">(opcional)</span>
            </label>
            <input
              className={inputClass}
              placeholder="Ej: Llegó proveedor, factura #123"
              value={form.observacion}
              onChange={(e) => setForm({ ...form, observacion: e.target.value })}
              disabled={registrando}
            />
          </div>

          {/* Botón */}
          <button
            onClick={handleGuardar}
            disabled={registrando || !form.producto_id || !form.cantidad}
            className="w-full min-h-[52px] py-3.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {registrando ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <ArrowDownTrayIcon className="w-5 h-5" />
                Registrar Entrada
              </>
            )}
          </button>
        </div>

        {/* Estado de carga inicial */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </main>
    </div>
  )
}