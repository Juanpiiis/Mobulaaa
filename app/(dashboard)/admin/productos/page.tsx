'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTienda } from '@/lib/context/TiendaContext'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'

interface Producto {
  id: string
  nombre: string
  descripcion: string | null
  categoria: string | null
  categoria_excel: string | null
  codigo: string | null
  referencia_excel: string | null
  marca: string | null
  precio: number | null
  precio_mayorista: number | null
  precio_tat: number | null
  activo: boolean
  congelado_manual: boolean | null
  limite_congelado: number | null
}

interface CongeladoInfo {
  congelado_manual: boolean
  limite_congelado: number | null
  stock_disponible: number
  bodega_id: string
}

interface Bodega {
  id: string
  nombre: string
}

interface Categoria {
  id: string
  nombre: string
}

const LIMITE_DEFAULT = 150

function esProductoCongelado(info: CongeladoInfo | undefined): boolean {
  if (!info) return false
  if (info.congelado_manual) return true
  const limite = info.limite_congelado ?? LIMITE_DEFAULT
  if (limite === 0) return false
  return info.stock_disponible <= limite
}

function normalizar(s: string | null | undefined): string {
  return (s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [stockPorProducto, setStockPorProducto] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [mostrarSoloCongelados, setMostrarSoloCongelados] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    nombre: '',
    color: '',
    categoria: '',
    codigo: '',
    bodega_id: '',
    cantidad: '0',
  })
  const [guardando, setGuardando] = useState(false)

  const supabase = createClient()
  const router = useRouter()
  const { tiendaActual } = useTienda()

  const cargarDatos = async () => {
    setLoading(true)
    setErrorCarga('')

    const { data: p, error: errP } = await supabase
      .from('productos')
      .select('id, nombre, descripcion, categoria, categoria_excel, codigo, referencia_excel, marca, precio, precio_mayorista, precio_tat, activo, congelado_manual, limite_congelado')
      .order('nombre', { ascending: true })

    if (errP) {
      console.error('Error cargando productos:', errP)
      setErrorCarga('No se pudieron cargar los productos: ' + errP.message)
      setLoading(false)
      return
    }

    const { data: b, error: errB } = await supabase
      .from('bodegas')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')

    if (errB) {
      console.error('Error cargando bodegas:', errB)
    }

    const { data: c, error: errC } = await supabase
      .from('categorias')
      .select('id, nombre')
      .order('nombre')

    if (errC) {
      console.error('Error cargando categorías:', errC)
      setErrorCarga('No se pudieron cargar las categorías: ' + errC.message)
    }

    setProductos((p as Producto[]) || [])
    setBodegas(b || [])
    setCategorias(c || [])

    if (tiendaActual) {
      const { data: inv, error: errInv } = await supabase
        .from('inventario')
        .select('producto_id, cantidad_disponible')
        .eq('bodega_id', tiendaActual.id)

      if (errInv) {
        console.error('Error cargando inventario:', errInv)
        setErrorCarga('No se pudo cargar el stock de la bodega: ' + errInv.message)
        setStockPorProducto(new Map())
      } else {
        const map = new Map<string, number>()
        for (const i of inv || []) {
          map.set(i.producto_id, i.cantidad_disponible ?? 0)
        }
        setStockPorProducto(map)
      }
    } else {
      setStockPorProducto(new Map())
    }

    setLoading(false)
  }

  useEffect(() => {
    cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiendaActual?.id])

  const getCongeladoInfo = (p: Producto): CongeladoInfo | undefined => {
    if (!tiendaActual) return undefined
    return {
      congelado_manual: p.congelado_manual ?? false,
      limite_congelado: p.limite_congelado ?? null,
      stock_disponible: stockPorProducto.get(p.id) ?? 0,
      bodega_id: tiendaActual.id,
    }
  }

  // ─────────────────────────────────────
  // CREAR PRODUCTO
  // ─────────────────────────────────────
  const handleGuardar = async () => {
    setGuardando(true)
    const nombreCompleto = form.color
      ? `${form.nombre} ${form.color}`.toUpperCase()
      : form.nombre.toUpperCase()

    const { data: producto, error: errIns } = await supabase
      .from('productos')
      .insert({
        nombre: nombreCompleto,
        categoria: form.categoria,
        codigo: form.codigo,
        descripcion: form.color,
        activo: true,
      })
      .select()
      .single()

    if (errIns || !producto) {
      console.error('Error creando producto:', errIns)
      setErrorCarga('No se pudo crear el producto: ' + (errIns?.message || 'Error desconocido'))
      setGuardando(false)
      return
    }

    if (form.bodega_id) {
      const cantidad = parseInt(form.cantidad) || 0
      if (cantidad > 0) {
        const { error: errInv } = await supabase.rpc('ajustar_stock', {
          p_producto: producto.id,
          p_bodega: form.bodega_id,
          p_delta: cantidad,
          p_tipo: 'entrada',
          p_obs: 'Carga inicial al crear producto',
        })
        if (errInv) {
          console.error('Error creando inventario inicial:', errInv)
          setErrorCarga('Producto creado, pero falló el inventario inicial: ' + errInv.message)
        }
      }
    }

    cerrarModal()
    cargarDatos()
    setGuardando(false)
  }

  const cerrarModal = () => {
    setShowModal(false)
    setForm({
      nombre: '',
      color: '',
      categoria: '',
      codigo: '',
      bodega_id: '',
      cantidad: '0',
    })
  }

  const handleEditarCompleto = (p: Producto) => {
    router.push(`/admin/productos/${p.id}/editar`)
  }

  // ✅ Única acción de estado: Activar / Desactivar
  const handleToggleActivo = async (p: Producto) => {
    const { error } = await supabase
      .from('productos')
      .update({ activo: !p.activo })
      .eq('id', p.id)

    if (error) {
      console.error('Error cambiando activo:', error)
      setErrorCarga('No se pudo cambiar el estado: ' + error.message)
      return
    }
    cargarDatos()
  }

  const filtrados = useMemo(() => {
    return productos.filter((p) => {
      // 1. Filtro de inactivos
      if (!mostrarInactivos && !p.activo) return false

      // 2. Filtro de congelados
      const congelado = esProductoCongelado(getCongeladoInfo(p))
      if (mostrarSoloCongelados && !congelado) return false

      // 3. Filtro de categoría
      if (categoriaFiltro) {
        const ce = normalizar(p.categoria_excel)
        const c = normalizar(p.categoria)
        const filtro = normalizar(categoriaFiltro)
        const match = ce === filtro || c === filtro
        if (!match) return false
      }

      // 4. Búsqueda
      if (busqueda.trim()) {
        const q = normalizar(busqueda).toLowerCase()
        const hayMatch =
          normalizar(p.nombre).toLowerCase().includes(q) ||
          normalizar(p.codigo).toLowerCase().includes(q) ||
          normalizar(p.referencia_excel).toLowerCase().includes(q) ||
          normalizar(p.marca).toLowerCase().includes(q) ||
          normalizar(p.categoria_excel).toLowerCase().includes(q) ||
          normalizar(p.categoria).toLowerCase().includes(q)
        if (!hayMatch) return false
      }

      return true
    })
  }, [productos, busqueda, categoriaFiltro, mostrarInactivos, mostrarSoloCongelados, stockPorProducto, tiendaActual])

  const formatPrecio = (n: number | null) => {
    if (n === null || n === undefined) return '—'
    return '$' + n.toLocaleString('es-CO')
  }

  const getCategoriaMostrar = (p: Producto): string | null => {
    const ce = (p.categoria_excel || '').trim()
    const c = (p.categoria || '').trim()
    return ce || c || null
  }

  return (
    <div className="min-h-screen bg-[#F7F7FB] w-full">
      {/* HEADER */}
      <header className="sticky top-[calc(var(--main-padding)*-1)] -mx-[var(--main-padding)] -mt-[var(--main-padding)] z-20 bg-white border-b border-gray-100">
        <div className="w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#232323]">
              Productos
            </h1>
            <p className="text-sm text-[#828282] mt-0.5">
              {filtrados.length} de {productos.length} productos
            </p>
            {tiendaActual && (
              <p className="text-xs text-[#828282] mt-0.5">
                Bodega: <span className="font-medium text-[#232323]">{tiendaActual.nombre}</span>
              </p>
            )}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="shrink-0 min-h-[44px] px-4 py-2.5 bg-[#1A0087] text-white text-sm font-semibold rounded-xl hover:bg-[#130066] active:scale-[0.98] transition-all flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Nuevo Producto
          </button>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 py-6 space-y-4">

        {errorCarga && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-start justify-between gap-3">
            <span>❌ {errorCarga}</span>
            <button onClick={() => setErrorCarga('')} className="text-xs font-medium">
              Cerrar
            </button>
          </div>
        )}

        {/* FILTROS */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, código, referencia..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
              />
            </div>

            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 bg-white"
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.nombre}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[#828282]">
              <input
                type="checkbox"
                checked={mostrarInactivos}
                onChange={(e) => setMostrarInactivos(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#1A0087] focus:ring-[#1A0087]"
              />
              Mostrar inactivos
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[#828282]">
              <input
                type="checkbox"
                checked={mostrarSoloCongelados}
                onChange={(e) => setMostrarSoloCongelados(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#1A0087] focus:ring-[#1A0087]"
              />
              Solo congelados
            </label>
          </div>
        </div>

        {/* LISTA DE PRODUCTOS */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && filtrados.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <p className="text-[#828282] text-sm">
              No se encontraron productos con estos filtros
            </p>
          </div>
        )}

        {!loading && filtrados.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtrados.map((p) => {
              const infoCong = getCongeladoInfo(p)
              const congelado = esProductoCongelado(infoCong)
              const catMostrar = getCategoriaMostrar(p)
              const stock = infoCong?.stock_disponible
              return (
                <div
                  key={p.id}
                  className={`bg-white border border-gray-200 rounded-2xl p-4 hover:border-[#1A0087]/30 hover:shadow-md transition-all ${!p.activo ? 'opacity-60' : ''
                    }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-[#232323] text-sm leading-tight line-clamp-2">
                        {p.nombre}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {p.marca && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#1A0087]/10 text-[#1A0087]">
                            {p.marca}
                          </span>
                        )}
                        {catMostrar && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-[#828282]">
                            {catMostrar}
                          </span>
                        )}
                        {congelado && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-1">
                            <LockClosedIcon className="w-3 h-3" />
                            Congelado
                          </span>
                        )}
                        {!p.activo && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                            Inactivo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-[#828282] mb-3">
                    {p.codigo && (
                      <p>
                        <span className="font-medium text-[#232323]">Código:</span>{' '}
                        {p.codigo}
                      </p>
                    )}
                    {p.referencia_excel ? (
                      <p className="truncate">
                        <span className="font-medium text-[#232323]">Ref:</span>{' '}
                        <span className="font-mono">{p.referencia_excel}</span>
                      </p>
                    ) : (
                      <p className="text-amber-600 font-medium">
                        ⚠️ Sin referencia de Excel
                      </p>
                    )}
                    {stock !== undefined && (
                      <p>
                        <span className="font-medium text-[#232323]">Stock:</span>{' '}
                        {stock}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 mb-3 text-center">
                    <div className="bg-gray-50 rounded-lg py-1.5">
                      <p className="text-[9px] text-[#828282] uppercase">Mayor.</p>
                      <p className="text-xs font-bold text-[#232323]">
                        {formatPrecio(p.precio_mayorista)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg py-1.5">
                      <p className="text-[9px] text-[#828282] uppercase">TAT</p>
                      <p className="text-xs font-bold text-[#232323]">
                        {formatPrecio(p.precio_tat)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg py-1.5">
                      <p className="text-[9px] text-[#828282] uppercase">Unidad</p>
                      <p className="text-xs font-bold text-[#1A0087]">
                        {formatPrecio(p.precio)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-1.5 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleEditarCompleto(p)}
                      className="flex-1 min-h-[36px] text-xs font-semibold text-[#1A0087] bg-[#1A0087]/5 hover:bg-[#1A0087]/10 rounded-lg transition-colors flex items-center justify-center gap-1"
                      title="Editar completo"
                    >
                      <PencilSquareIcon className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleActivo(p)}
                      className={`min-h-[36px] px-4 text-xs font-medium rounded-lg transition-colors ${p.activo
                          ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                          : 'text-green-600 bg-green-50 hover:bg-green-100'
                        }`}
                      title={p.activo ? 'Desactivar' : 'Activar'}
                    >
                      {p.activo ? 'Off' : 'On'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* MODAL: Crear Producto */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-[#232323]">
                Nuevo Producto
              </h2>
              <p className="text-xs text-[#828282] mt-0.5">
                Para precios, referencia y congelado, usá "Editar" después de crearlo
              </p>
            </div>

            <div className="p-5 space-y-3">
              <input
                className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
                placeholder="Código (ej: S25-NEG)"
                value={form.codigo}
                onChange={(e) =>
                  setForm({ ...form, codigo: e.target.value.toUpperCase() })
                }
              />
              <input
                className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
                placeholder="Nombre (ej: S25 PRO)"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
              <input
                className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
                placeholder="Color (ej: NEGRO)"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
              <select
                className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 bg-white"
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              >
                <option value="">Seleccionar categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>

              <select
                className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 bg-white"
                value={form.bodega_id}
                onChange={(e) =>
                  setForm({ ...form, bodega_id: e.target.value })
                }
              >
                <option value="">Seleccionar tienda/bodega</option>
                {bodegas.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
              <input
                className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
                type="number"
                placeholder="Cantidad inicial"
                value={form.cantidad}
                onChange={(e) =>
                  setForm({ ...form, cantidad: e.target.value })
                }
              />
            </div>

            <div className="p-5 border-t border-gray-100 flex gap-2 justify-end">
              <button
                onClick={cerrarModal}
                className="min-h-[44px] px-5 py-2.5 text-sm font-medium text-[#232323] bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardar}
                disabled={guardando}
                className="min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white bg-[#1A0087] hover:bg-[#130066] rounded-xl transition-all disabled:opacity-50"
              >
                {guardando ? 'Creando...' : 'Crear Producto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}