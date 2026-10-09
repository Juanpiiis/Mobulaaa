'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import { calcularDescuento, DESCUENTOS } from '@/types/index'
import { ClienteSelector } from '@/components/pedidos/ClienteSelector'
import { HistorialClienteModal } from '@/components/pedidos/HistorialClienteModal'
import { ProductoSelector } from '@/components/pedidos/ProductoSelector'
import { ProductoBuscadorModal } from '@/components/pedidos/ProductoBuscadorModal'
import { PedidoDetalleModal, type PedidoCompleto } from '@/components/pedidos/PedidoDetalleModal'
import { PedidoCardCompacta } from '@/components/pedidos/PedidoCardCompacta'
import { CotizacionPreview } from '@/components/cotizaciones/CotizacionPreview'
import {
  FiltrosModal,
  FiltrosChips,
  FILTROS_INICIALES,
  type FiltrosValores,
} from '@/components/pedidos/FiltrosModal'
import type { Cliente } from '@/types/clientes'
import {
  esProductoCongelado,
  motivoCongelado,
  type ProductoBusqueda,
} from '@/lib/hooks/useBuscarProducto'
import {
  XMarkIcon,
  ShoppingBagIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  FunnelIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'

interface Pedido {
  id: string
  estado: string
  fecha: string
  observacion: string | null
  subtotal: number
  descuento_porcentaje: number
  descuento_valor: number
  total: number
  numero_factura: string | null
  numero_cotizacion: string | null
  revertido: boolean
  importante?: boolean
  bodegas: { id: string; nombre: string } | null
  clientes: { nombre: string; cc_nit: string } | null
  usuarios: { nombre: string } | null
  detalle_pedido: {
    id?: string
    producto_id?: string
    cantidad_solicitada: number
    cantidad_aprobada: number | null
    productos: { id?: string; nombre: string; precio: number; codigo: string | null }
  }[]
}

interface ItemPedido {
  producto_id: string
  cantidad: string
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function getMesKey(fechaISO: string) {
  const d = new Date(fechaISO)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getMesLabel(fechaISO: string) {
  const d = new Date(fechaISO)
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`
}

function estaEnRango(fechaISO: string, rango: 'hoy' | '7d' | '30d' | 'mes' | 'todo') {
  if (rango === 'todo') return true
  const fecha = new Date(fechaISO)
  const ahora = new Date()
  const ms = 1000 * 60 * 60 * 24

  if (rango === 'hoy') {
    return (
      fecha.getDate() === ahora.getDate() &&
      fecha.getMonth() === ahora.getMonth() &&
      fecha.getFullYear() === ahora.getFullYear()
    )
  }
  if (rango === '7d') return ahora.getTime() - fecha.getTime() <= 7 * ms
  if (rango === '30d') return ahora.getTime() - fecha.getTime() <= 30 * ms
  if (rango === 'mes') {
    return (
      fecha.getMonth() === ahora.getMonth() &&
      fecha.getFullYear() === ahora.getFullYear()
    )
  }
  return true
}

export default function MisPedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [productos, setProductos] = useState<ProductoBusqueda[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [observacion, setObservacion] = useState('')
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [paso, setPaso] = useState<'cliente' | 'productos'>('cliente')
  const [items, setItems] = useState<ItemPedido[]>([])
  const [errorStock, setErrorStock] = useState<string | null>(null)
  const [productoBuscadorAbierto, setProductoBuscadorAbierto] = useState(false)
  const [pedidoAbierto, setPedidoAbierto] = useState<string | null>(null)
  const [verCotizacion, setVerCotizacion] = useState<string | null>(null)
  const [mesesAbiertos, setMesesAbiertos] = useState<Record<string, boolean>>({})

  // Filtros
  const [filtros, setFiltros] = useState<FiltrosValores>(FILTROS_INICIALES)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)

  const { tiendaActual } = useTienda()
  const supabase = createClient()

  const formatCOP = (value: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value)

  // ─────────────────────────────────────────────
  // Cargar pedidos + productos
  // ─────────────────────────────────────────────
  const fetchOrders = async () => {
    if (!tiendaActual) return
    setIsLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { data: p } = await supabase
      .from('pedidos')
      .select(`
        id, estado, fecha, observacion, subtotal, descuento_porcentaje, descuento_valor, total,
        numero_factura, numero_cotizacion, revertido, importante,
        bodegas ( id, nombre ),
        clientes ( nombre, cc_nit ),
        usuarios ( nombre ),
        detalle_pedido (
          id, producto_id, cantidad_solicitada, cantidad_aprobada,
          productos ( id, nombre, precio, codigo )
        )
      `)
      .eq('vendedor_id', user?.id)
      .eq('bodega_id', tiendaActual.id)
      .order('fecha', { ascending: false })

    const { data: prod } = await supabase
      .from('inventario')
      .select(`
        cantidad_disponible,
        productos!inner(
          id, nombre, precio, categoria, sku,
          congelado_manual, limite_congelado
        )
      `)
      .eq('bodega_id', tiendaActual.id)
      .gt('cantidad_disponible', 0)

    setPedidos((p as unknown as Pedido[]) || [])
    setProductos(
      prod
        ?.map((i: any) => ({
          id: i.productos?.id,
          nombre: i.productos?.nombre,
          precio: i.productos?.precio,
          categoria: i.productos?.categoria,
          sku: i.productos?.sku,
          stock_disponible: i.cantidad_disponible || 0,
          congelado_manual: i.productos?.congelado_manual ?? false,
          limite_congelado: i.productos?.limite_congelado ?? null,
        }))
        .filter((p: any) => p.id) || []
    )
    setIsLoading(false)
  }

  useEffect(() => {
    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiendaActual])

  // ─────────────────────────────────────────────
  // Preview del pedido
  // ─────────────────────────────────────────────
  const preview = useMemo(() => {
    const subtotal = items.reduce((acc, item) => {
      const prod = productos.find((p) => p.id === item.producto_id)
      if (!prod || !item.cantidad) return acc
      return acc + prod.precio * parseInt(item.cantidad)
    }, 0)
    const porcentaje = calcularDescuento(subtotal)
    const descuento = subtotal * (porcentaje / 100)
    const total = subtotal - descuento
    const siguienteDescuento = DESCUENTOS.slice().reverse().find((d) => subtotal < d.minimo)
    const faltaPara = siguienteDescuento ? siguienteDescuento.minimo - subtotal : 0
    return { subtotal, porcentaje, descuento, total, faltaPara, siguienteDescuento }
  }, [items, productos])

  // ─────────────────────────────────────────────
  // Congelados
  // ─────────────────────────────────────────────
  const hayProductoCongelado = useMemo(() => {
    return items.some((it) => {
      if (!it.producto_id) return false
      const p = productos.find((pp) => pp.id === it.producto_id)
      return p ? esProductoCongelado(p) : false
    })
  }, [items, productos])

  const validarStock = (): string | null => {
    for (const item of items) {
      if (!item.producto_id) continue
      const cant = parseInt(item.cantidad || '0')
      if (cant <= 0) continue
      const prod = productos.find((pp) => pp.id === item.producto_id)
      if (!prod) continue
      if (esProductoCongelado(prod)) {
        return `"${prod.nombre}" ${motivoCongelado(prod)}. Quítalo del pedido para continuar.`
      }
      if (cant > prod.stock_disponible) {
        return `"${prod.nombre}" solo tiene ${prod.stock_disponible} unidades disponibles`
      }
    }
    return null
  }

  // ─────────────────────────────────────────────
  // Guardar pedido
  // ─────────────────────────────────────────────
  const handleSave = async () => {
    if (!tiendaActual || !clienteSeleccionado) return
    const err = validarStock()
    if (err) {
      setErrorStock(err)
      return
    }
    setErrorStock(null)

    const itemsValidos = items.filter(
      (i) => i.producto_id && i.cantidad && parseInt(i.cantidad) > 0
    )
    if (itemsValidos.length === 0 || isSaving) return
    setIsSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: pedido, error: errPedido } = await supabase
        .from('pedidos')
        .insert({
          vendedor_id: user?.id,
          bodega_id: tiendaActual.id,
          cliente_id: clienteSeleccionado.id,
          observacion: observacion || null,
          estado: 'pendiente',
          fecha: new Date().toISOString(),
          subtotal: preview.subtotal,
          descuento_porcentaje: preview.porcentaje,
          descuento_valor: preview.descuento,
          total: preview.total,
        })
        .select()
        .single()

      if (errPedido || !pedido) {
        console.error('ERROR AL CREAR PEDIDO:', errPedido)
        setErrorStock(`Error al crear el pedido: ${errPedido?.message || 'desconocido'}`)
        return
      }

      const { error: errDetalle } = await supabase.from('detalle_pedido').insert(
        itemsValidos.map((item) => ({
          pedido_id: pedido.id,
          producto_id: item.producto_id,
          cantidad_solicitada: parseInt(item.cantidad),
        }))
      )

      if (errDetalle) {
        console.error('ERROR AL CREAR DETALLE:', errDetalle)
        setErrorStock(`Pedido creado pero falló el detalle: ${errDetalle.message}`)
        return
      }

      resetModal()
      fetchOrders()
    } finally {
      setIsSaving(false)
    }
  }

  const resetModal = () => {
    setIsModalOpen(false)
    setItems([])
    setObservacion('')
    setClienteSeleccionado(null)
    setPaso('cliente')
    setErrorStock(null)
    setProductoBuscadorAbierto(false)
  }

  const handleAgregarProducto = (p: ProductoBusqueda) => {
    setItems([...items, { producto_id: p.id, cantidad: '1' }])
    setErrorStock(null)
  }

  const handleCantidadChange = (index: number, cantidad: string) => {
    setItems(items.map((it, idx) => (idx === index ? { ...it, cantidad } : it)))
    setErrorStock(null)
  }

  const handleEliminarItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index))
  }

  // ─────────────────────────────────────────────
  // Separación: En proceso vs Historial
  // ─────────────────────────────────────────────
  const enProceso = useMemo(() => {
    const arr = pedidos.filter(p =>
      ['pendiente', 'aprobado_bodega', 'aprobado_cartera', 'devuelto_por_cartera'].includes(p.estado)
    )
    return [...arr].sort((a, b) => {
      if (a.importante && !b.importante) return -1
      if (!a.importante && b.importante) return 1
      return new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    })
  }, [pedidos])

  const historialFiltrado = useMemo(() => {
    const q = filtros.busqueda.trim().toLowerCase()

    return pedidos.filter(p => {
      if (!['despachado', 'entregado', 'rechazado_bodega', 'rechazado_cartera', 'cancelado'].includes(p.estado)) {
        return false
      }

      if (filtros.estado === 'pendiente' && p.estado !== 'pendiente') return false
      if (filtros.estado === 'aprobado' && !['aprobado_bodega', 'aprobado_cartera'].includes(p.estado)) return false
      if (filtros.estado === 'despachado' && p.estado !== 'despachado') return false
      if (filtros.estado === 'entregado' && p.estado !== 'entregado') return false
      if (filtros.estado === 'rechazado' && !['rechazado_bodega', 'rechazado_cartera'].includes(p.estado)) return false
      if (filtros.estado === 'cancelado' && p.estado !== 'cancelado') return false

      if (!estaEnRango(p.fecha, filtros.fecha)) return false

      if (q) {
        const partes = [
          p.numero_cotizacion,
          p.numero_factura,
          p.id,
          String(p.id).slice(0, 8),
          p.clientes?.nombre,
          p.clientes?.cc_nit,
          p.observacion,
        ].filter(Boolean).map(s => String(s).toLowerCase())
        if (!partes.some(s => s.includes(q))) return false
      }

      return true
    })
  }, [pedidos, filtros])

  const historialPorMes = useMemo(() => {
    const grupos: Record<string, Pedido[]> = {}
    historialFiltrado.forEach(p => {
      const key = getMesKey(p.fecha)
      if (!grupos[key]) grupos[key] = []
      grupos[key].push(p)
    })
    return Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a))
  }, [historialFiltrado])

  useEffect(() => {
    if (historialPorMes.length > 0) {
      setMesesAbiertos(prev => {
        const nuevo = { ...prev }
        if (Object.keys(nuevo).length === 0) {
          nuevo[historialPorMes[0][0]] = true
        }
        return nuevo
      })
    }
  }, [historialPorMes.length])

  const toggleMes = (key: string) => {
    setMesesAbiertos(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const quitarFiltro = (campo: keyof FiltrosValores) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: campo === 'busqueda' ? '' : 'todos',
    }))
  }

  const pedidoActual = pedidos.find(p => p.id === pedidoAbierto) || null
  const productosExcluidos = items.map(i => i.producto_id).filter(Boolean)

  return (
    <div className="min-h-screen bg-[#F7F7FB] w-full">
      {/* HEADER */}
      <header className="sticky top-[calc(var(--main-padding)*-1)] -mx-[var(--main-padding)] -mt-[var(--main-padding)] z-20 bg-white border-b border-gray-100">
        <div className="w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#232323]">Mis Pedidos</h1>
            <p className="text-sm text-[#828282] truncate mt-0.5">{tiendaActual?.nombre}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setFiltrosAbiertos(true)}
              className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 text-[#232323] rounded-xl text-sm font-medium hover:bg-gray-50 active:scale-[0.98] transition-all min-h-[44px]"
            >
              <FunnelIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Filtros</span>
            </button>
            <button
              onClick={() => {
                setItems([])
                setIsModalOpen(true)
              }}
              className="bg-[#1A0087] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#130066] active:scale-[0.98] transition-transform shadow-sm min-h-[44px]"
            >
              + Nuevo
            </button>
          </div>
        </div>

        {(filtros.busqueda.trim() || filtros.fecha !== 'todo' || filtros.estado !== 'todos') && (
          <div className="border-t border-gray-100 bg-white">
            <div className="w-full px-4 sm:px-6 py-3">
              <FiltrosChips
                valores={filtros}
                onQuitar={quitarFiltro}
                onLimpiar={() => setFiltros(FILTROS_INICIALES)}
              />
            </div>
          </div>
        )}
      </header>

      {/* LISTA */}
      <main className="w-full px-4 sm:px-6 py-6">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pedidos.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
            <ShoppingBagIcon className="w-14 h-14 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-[#828282]">Aún no tienes pedidos</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 text-sm font-medium text-[#1A0087] hover:underline"
            >
              Crear el primero
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {enProceso.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-bold text-[#232323]">🔥 En proceso</h2>
                  <span className="text-sm font-semibold bg-yellow-100 text-yellow-800 px-3 py-0.5 rounded-full">
                    {enProceso.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {enProceso.map(p => (
                    <PedidoCardCompacta
                      key={p.id}
                      pedido={p as any}
                      onClick={() => setPedidoAbierto(p.id)}
                    />
                  ))}
                </div>
                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-[#828282] italic">
                    Para cancelar un pedido en proceso, contacta con bodega
                  </p>
                </div>
              </section>
            )}

            {historialFiltrado.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-bold text-[#232323]">📚 Historial</h2>
                  <span className="text-sm text-[#828282]">
                    {historialFiltrado.length} {historialFiltrado.length === 1 ? 'pedido' : 'pedidos'}
                  </span>
                </div>
                <div className="space-y-4">
                  {historialPorMes.map(([mesKey, itemsMes]) => {
                    const abierto = mesesAbiertos[mesKey] ?? false
                    return (
                      <div
                        key={mesKey}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                      >
                        <button
                          onClick={() => toggleMes(mesKey)}
                          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {abierto ? (
                              <ChevronDownIcon className="w-5 h-5 text-[#828282]" />
                            ) : (
                              <ChevronRightIcon className="w-5 h-5 text-[#828282]" />
                            )}
                            <span className="font-semibold text-base text-[#232323]">
                              📅 {getMesLabel(itemsMes[0].fecha)}
                            </span>
                            <span className="text-sm text-[#828282]">
                              ({itemsMes.length})
                            </span>
                          </div>
                        </button>

                        {abierto && (
                          <div className="p-4 pt-0 space-y-3">
                            {itemsMes.map(p => (
                              <PedidoCardCompacta
                                key={p.id}
                                pedido={p as any}
                                onClick={() => setPedidoAbierto(p.id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {historialFiltrado.length === 0 && (filtros.busqueda.trim() || filtros.fecha !== 'todo' || filtros.estado !== 'todos') && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-bold text-[#232323]">📚 Historial</h2>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <ClipboardDocumentListIcon className="w-14 h-14 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-[#828282]">
                    No hay pedidos que coincidan con los filtros
                  </p>
                  <button
                    onClick={() => setFiltros(FILTROS_INICIALES)}
                    className="mt-3 text-xs text-[#1A0087] font-medium hover:underline"
                  >
                    Limpiar filtros
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* MODAL FILTROS */}
      <FiltrosModal
        abierto={filtrosAbiertos}
        onClose={() => setFiltrosAbiertos(false)}
        valores={filtros}
        onAplicar={setFiltros}
        placeholderBusqueda="Buscar por COT, factura, cliente..."
      />

      {/* MODAL NUEVO PEDIDO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center sm:justify-center">
          <div className="w-full sm:max-w-lg bg-white sm:rounded-3xl rounded-t-3xl max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="shrink-0 bg-white border-b border-gray-100">
              <div className="flex items-center gap-3 px-4 py-3">
                {paso === 'productos' ? (
                  <button
                    onClick={() => setPaso('cliente')}
                    disabled={isSaving}
                    className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-50"
                    aria-label="Atrás"
                  >
                    <ChevronLeftIcon className="w-5 h-5 text-[#232323]" />
                  </button>
                ) : (
                  <div className="w-9 h-9 shrink-0" />
                )}
                <div className="flex-1 min-w-0 text-center">
                  <h2 className="text-base font-semibold text-[#232323] truncate">
                    Nuevo Pedido
                  </h2>
                  <p className="text-[11px] text-[#828282] truncate">
                    {tiendaActual?.nombre}
                  </p>
                </div>
                <button
                  onClick={resetModal}
                  disabled={isSaving}
                  className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-50"
                  aria-label="Cerrar"
                >
                  <XMarkIcon className="w-5 h-5 text-[#232323]" />
                </button>
              </div>

              <div className="px-4 pb-3">
                <div className="flex items-center gap-2 text-xs">
                  <div className={`flex items-center gap-1.5 font-medium ${paso === 'cliente' ? 'text-[#1A0087]' : 'text-green-600'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${paso === 'cliente' ? 'bg-[#1A0087] text-white' : 'bg-green-500 text-white'}`}>
                      {paso === 'cliente' ? '1' : <CheckIcon className="w-3 h-3" />}
                    </div>
                    Cliente
                  </div>
                  <div className={`flex-1 h-0.5 rounded transition-colors ${paso === 'productos' ? 'bg-[#1A0087]' : 'bg-gray-200'}`} />
                  <div className={`flex items-center gap-1.5 font-medium ${paso === 'productos' ? 'text-[#1A0087]' : 'text-[#828282]'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${paso === 'productos' ? 'bg-[#1A0087] text-white' : 'bg-gray-200 text-[#828282]'}`}>
                      2
                    </div>
                    Productos
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="p-4 space-y-4">
                {paso === 'cliente' && (
                  <>
                    <div>
                      <h3 className="text-base font-semibold text-[#232323]">
                        Identifica al cliente
                      </h3>
                      <p className="text-xs text-[#828282] mt-1">
                        Busca por CC/NIT o nombre, o registra uno nuevo
                      </p>
                    </div>
                    <ClienteSelector
                      clienteSeleccionado={clienteSeleccionado}
                      onClienteSeleccionado={(c) => {
                        setClienteSeleccionado(c)
                        setPaso('productos')
                      }}
                      onLimpiar={() => setClienteSeleccionado(null)}
                      onVerHistorial={(c) => {
                        setClienteSeleccionado(c)
                        setMostrarHistorial(true)
                      }}
                    />
                  </>
                )}

                {paso === 'productos' && clienteSeleccionado && (
                  <>
                    <ClienteSelector
                      clienteSeleccionado={clienteSeleccionado}
                      onClienteSeleccionado={() => { }}
                      onLimpiar={() => {
                        setClienteSeleccionado(null)
                        setPaso('cliente')
                      }}
                      onVerHistorial={() => setMostrarHistorial(true)}
                    />

                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-[#232323]">
                            Productos
                          </h3>
                          <p className="text-xs text-[#828282] mt-0.5">
                            {items.length} {items.length === 1 ? 'producto' : 'productos'} en el pedido
                          </p>
                        </div>
                      </div>

                      {items.length > 0 && (
                        <div className="space-y-3 mb-3">
                          {items.map((item, i) => {
                            const prod = productos.find(p => p.id === item.producto_id)
                            if (!prod) return null
                            return (
                              <ProductoSelector
                                key={`${item.producto_id}-${i}`}
                                index={i}
                                producto={prod}
                                cantidad={item.cantidad}
                                onCantidadChange={handleCantidadChange}
                                onEliminar={handleEliminarItem}
                                formatCOP={formatCOP}
                              />
                            )
                          })}
                        </div>
                      )}

                      <button
                        onClick={() => setProductoBuscadorAbierto(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#1A0087]/30 rounded-2xl text-sm font-medium text-[#1A0087] hover:bg-[#1A0087]/5 active:bg-[#1A0087]/10 transition-colors"
                      >
                        <PlusIcon className="w-4 h-4" />
                        Agregar producto
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#828282] mb-1.5">
                        Observación (opcional)
                      </label>
                      <textarea
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 resize-none"
                        rows={2}
                        placeholder="Ej: Entrega urgente..."
                        value={observacion}
                        onChange={(e) => setObservacion(e.target.value)}
                      />
                    </div>

                    {errorStock && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                        <p className="text-sm text-red-700 font-medium">⚠️ {errorStock}</p>
                      </div>
                    )}
                    {hayProductoCongelado && !errorStock && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                        <p className="text-sm text-red-700 font-medium">
                          🔒 Quita los productos congelados para continuar
                        </p>
                      </div>
                    )}

                    {preview.subtotal > 0 && (
                      <div className="bg-[#1A0087]/5 border border-[#1A0087]/20 rounded-2xl p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-[#828282]">Subtotal</span>
                          <span className="font-medium text-[#232323]">
                            {formatCOP(preview.subtotal)}
                          </span>
                        </div>
                        {preview.porcentaje > 0 ? (
                          <div className="flex justify-between text-sm text-green-600">
                            <span className="font-medium">
                              Descuento ({preview.porcentaje}%)
                            </span>
                            <span className="font-medium">
                              - {formatCOP(preview.descuento)}
                            </span>
                          </div>
                        ) : preview.faltaPara > 0 ? (
                          <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 p-2 rounded-lg">
                            ⚡ Agrega {formatCOP(preview.faltaPara)} más para{' '}
                            {preview.siguienteDescuento?.porcentaje}% de descuento
                          </p>
                        ) : null}
                        <div className="flex justify-between items-baseline pt-2 border-t border-[#1A0087]/20">
                          <span className="font-semibold text-[#232323]">Total</span>
                          <span className="text-xl font-bold text-[#1A0087]">
                            {formatCOP(preview.total)}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-100 bg-white p-4 flex gap-2">
              <button
                onClick={resetModal}
                disabled={isSaving}
                className="flex-1 sm:flex-initial sm:px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-[#232323] hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>

              {paso === 'productos' && (() => {
                const sinProductos = items.length === 0
                const disabled =
                  isSaving || hayProductoCongelado || sinProductos || !clienteSeleccionado
                const label = isSaving
                  ? 'Enviando...'
                  : hayProductoCongelado
                    ? 'Quita los congelados'
                    : sinProductos
                      ? 'Agrega un producto'
                      : 'Enviar pedido'

                return (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={disabled}
                    className={`flex-1 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all shadow-sm ${disabled
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-[#1A0087] hover:bg-[#130066] active:scale-[0.98]'
                      }`}
                  >
                    {label}
                  </button>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      <ProductoBuscadorModal
        abierto={productoBuscadorAbierto}
        onClose={() => setProductoBuscadorAbierto(false)}
        onSeleccionar={handleAgregarProducto}
        productosBase={productos}
        bodegaId={tiendaActual?.id}
        formatCOP={formatCOP}
        productosExcluidos={productosExcluidos}
      />

      {mostrarHistorial && clienteSeleccionado && (
        <HistorialClienteModal
          cliente={clienteSeleccionado}
          onClose={() => setMostrarHistorial(false)}
        />
      )}

      {pedidoActual && (
        <PedidoDetalleModal
          pedido={pedidoActual as unknown as PedidoCompleto}
          onClose={() => setPedidoAbierto(null)}
          onRefresh={fetchOrders}
          rolActual="vendedor"
          onVerCotizacion={(id) => {
            setPedidoAbierto(null)
            setVerCotizacion(id)
          }}
        />
      )}

      {verCotizacion && (
        <CotizacionPreview
          pedidoId={verCotizacion}
          onClose={() => setVerCotizacion(null)}
        />
      )}
    </div>
  )
}