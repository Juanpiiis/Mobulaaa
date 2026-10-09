'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'

const CATEGORIAS = [
  'AUDIFONO',
  'CARGADOR',
  'CABLES',
  'RELOJ',
  'PARLANTES',
  'DIADEMAS',
  'POWER BANK',
  'CELULAR',
  'TABLET',
  'COMPUTADOR',
  'VENTILADOR',
  'OTROS',
]

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
  congelado_manual: boolean
  limite_congelado: number | null
}

interface Bodega {
  id: string
  nombre: string
}

// Helper: ¿está congelado?
function esProductoCongelado(p: Producto): boolean {
  if (p.congelado_manual) return true
  const limite = p.limite_congelado ?? 150
  if (limite === 0) return false
  // No tenemos el stock en esta vista, pero si congelado_manual es true o el producto está marcado,
  // lo mostramos como congelado. El stock real está en inventario.
  return false
}

// Helper: normalizar texto (mayúsculas, sin tildes, espacios colapsados)
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
  const [loading, setLoading] = useState(true)

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [mostrarSoloCongelados, setMostrarSoloCongelados] = useState(false)

  // Modal rápido (crear/editar básico)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [form, setForm] = useState({
    nombre: '',
    color: '',
    categoria: '',
    codigo: '',
    bodega_id: '',
    cantidad: '0',
  })

  // Modal de eliminar
  const [eliminando, setEliminando] = useState<Producto | null>(null)

  const supabase = createClient()
  const router = useRouter()

  const cargarDatos = async () => {
    setLoading(true)
    const { data: p } = await supabase
      .from('productos')
      .select('*')
      .order('nombre', { ascending: true })
    const { data: b } = await supabase
      .from('bodegas')
      .select('*')
      .eq('activo', true)
      .order('nombre')

    setProductos(p || [])
    setBodegas(b || [])
    setLoading(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  // ─────────────────────────────────────────────
  // Guardar (modal rápido)
  // ─────────────────────────────────────────────
  const handleGuardar = async () => {
    const nombreCompleto = form.color
      ? `${form.nombre} ${form.color}`.toUpperCase()
      : form.nombre.toUpperCase()

    if (editando) {
      await supabase
        .from('productos')
        .update({
          nombre: nombreCompleto,
          categoria: form.categoria,
          codigo: form.codigo,
          descripcion: form.color,
        })
        .eq('id', editando.id)
    } else {
      const { data: producto } = await supabase
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

      if (producto && form.bodega_id) {
        await supabase.from('inventario').insert({
          producto_id: producto.id,
          bodega_id: form.bodega_id,
          cantidad_disponible: parseInt(form.cantidad) || 0,
          cantidad_minima: 0,
        })
      }
    }

    cerrarModal()
    cargarDatos()
  }

  const cerrarModal = () => {
    setShowModal(false)
    setEditando(null)
    setForm({
      nombre: '',
      color: '',
      categoria: '',
      codigo: '',
      bodega_id: '',
      cantidad: '0',
    })
  }

  const handleEditarRapido = (p: Producto) => {
    setEditando(p)
    setForm({
      nombre: p.nombre,
      color: p.descripcion || '',
      categoria: p.categoria || '',
      codigo: p.codigo || '',
      bodega_id: '',
      cantidad: '0',
    })
    setShowModal(true)
  }

  const handleEditarCompleto = (p: Producto) => {
    router.push(`/admin/productos/${p.id}/editar`)
  }

  const handleToggleActivo = async (p: Producto) => {
    await supabase
      .from('productos')
      .update({ activo: !p.activo })
      .eq('id', p.id)
    cargarDatos()
  }

  const confirmarEliminar = async () => {
    if (!eliminando) return
    await supabase.from('productos').update({ activo: false }).eq('id', eliminando.id)
    setEliminando(null)
    cargarDatos()
  }

  // ─────────────────────────────────────────────
  // Filtrado UNIFICADO
  // ─────────────────────────────────────────────

  // Categorías únicas disponibles (combinadas de ambos campos, normalizadas)
  const categoriasDisponibles = useMemo(() => {
    const set = new Set<string>()
    productos.forEach((p) => {
      const ce = normalizar(p.categoria_excel)
      if (ce) set.add(ce)
      const c = normalizar(p.categoria)
      if (c) set.add(c)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [productos])

  const filtrados = productos.filter((p) => {
    // 1. Activo
    if (!mostrarInactivos && !p.activo) return false

    // 2. Solo congelados
    if (mostrarSoloCongelados && !esProductoCongelado(p)) return false

    // 3. Categoría (match flexible: normalizado)
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

  const formatPrecio = (n: number | null) => {
    if (n === null || n === undefined) return '—'
    return '$' + n.toLocaleString('es-CO')
  }

  // Mostrar categoría efectiva en la tarjeta
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

        {/* Filtros */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Buscador */}
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

            {/* Categoría */}
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 bg-white"
            >
              <option value="">Todas las categorías</option>
              {categoriasDisponibles.map((c) => (
                <option key={c} value={c}>
                  {c}
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

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Sin resultados */}
        {!loading && filtrados.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <p className="text-[#828282] text-sm">
              No se encontraron productos con estos filtros
            </p>
          </div>
        )}

        {/* Lista de productos (tarjetas) */}
        {!loading && filtrados.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtrados.map((p) => {
              const congelado = esProductoCongelado(p)
              const catMostrar = getCategoriaMostrar(p)
              return (
                <div
                  key={p.id}
                  className={`bg-white border border-gray-200 rounded-2xl p-4 hover:border-[#1A0087]/30 hover:shadow-md transition-all ${!p.activo ? 'opacity-60' : ''
                    }`}
                >
                  {/* Header tarjeta */}
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
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                            Inactivo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Info */}
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
                  </div>

                  {/* Precios */}
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

                  {/* Acciones */}
                  <div className="flex gap-1.5 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleEditarCompleto(p)}
                      className="flex-1 min-h-[36px] text-xs font-semibold text-[#1A0087] bg-[#1A0087]/5 hover:bg-[#1A0087]/10 rounded-lg transition-colors flex items-center justify-center gap-1"
                      title="Editar completo (precios, referencia, congelado)"
                    >
                      <PencilSquareIcon className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleEditarRapido(p)}
                      className="min-h-[36px] px-2 text-xs font-medium text-[#828282] bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edición rápida"
                    >
                      <ArrowPathIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleActivo(p)}
                      className={`min-h-[36px] px-2 text-xs font-medium rounded-lg transition-colors ${p.activo
                          ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                          : 'text-green-600 bg-green-50 hover:bg-green-100'
                        }`}
                      title={p.activo ? 'Desactivar' : 'Activar'}
                    >
                      {p.activo ? 'Off' : 'On'}
                    </button>
                    <button
                      onClick={() => setEliminando(p)}
                      className="min-h-[36px] px-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* MODAL: Crear / Editar rápido */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-[#232323]">
                {editando ? 'Editar Producto (rápido)' : 'Nuevo Producto'}
              </h2>
              <p className="text-xs text-[#828282] mt-0.5">
                {editando
                  ? 'Para editar precios, referencia y congelado, usá "Editar" (botón azul)'
                  : 'Para más campos, usá "Editar" después de crearlo'}
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
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {!editando && (
                <>
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
                </>
              )}
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
                className="min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white bg-[#1A0087] hover:bg-[#130066] rounded-xl transition-all"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar eliminar */}
      {eliminando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="p-5 text-center">
              <TrashIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-[#232323]">
                ¿Eliminar producto?
              </h2>
              <p className="text-sm text-[#828282] mt-1">
                {eliminando.nombre}
              </p>
              <p className="text-xs text-[#828282] mt-2">
                Se marcará como inactivo (no se borra de la BD)
              </p>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => setEliminando(null)}
                className="flex-1 min-h-[44px] py-2.5 text-sm font-medium text-[#232323] bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEliminar}
                className="flex-1 min-h-[44px] py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}