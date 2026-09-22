'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import { calcularDescuento, DESCUENTOS } from '@/types/index'
import { ClienteSelector } from '@/components/pedidos/ClienteSelector'
import { HistorialClienteModal } from '@/components/pedidos/HistorialClienteModal'
import { ProductoSelector } from '@/components/pedidos/ProductoSelector'
import type { Cliente } from '@/types/clientes'
import type { ProductoBusqueda } from '@/lib/hooks/useBuscarProducto'
import {
  XMarkIcon,
  UserIcon,
  ShoppingBagIcon,
  CheckIcon,
  ChevronLeftIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'

const STOCK_CONGELADO = 150

interface Pedido {
  id: string
  estado: string
  fecha: string
  observacion: string
  subtotal: number
  descuento_porcentaje: number
  descuento_valor: number
  total: number
  numero_factura: string
  bodegas: { nombre: string }
  detalle_pedido: {
    cantidad_solicitada: number
    cantidad_aprobada: number | null
    productos: { nombre: string; precio: number }
  }[]
}

interface ItemPedido {
  producto_id: string
  cantidad: string
}

/* ────────────────────────────────────────── */
const EstadoBarra = ({ estado }: { estado: string }) => {
  const pasos = [
    { key: 'pendiente', label: 'Enviado' },
    { key: 'aprobado_bodega', label: 'Bodega' },
    { key: 'aprobado_cartera', label: 'Cartera' },
    { key: 'despachado', label: 'Despachado' },
    { key: 'entregado', label: 'Entregado' },
  ]

  if (estado === 'rechazado_bodega' || estado === 'rechazado_cartera') {
    return (
      <div className="my-3">
        <span className="inline-block bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-medium">
          ❌ {estado === 'rechazado_bodega' ? 'Rechazado por bodega' : 'Rechazado por cartera'}
        </span>
      </div>
    )
  }

  const pasoActual = pasos.findIndex((p) => p.key === estado)

  return (
    <div className="flex items-center my-4 overflow-x-auto pb-1 -mx-1 px-1">
      {pasos.map((paso, i) => (
        <div key={paso.key} className="flex items-center shrink-0">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i <= pasoActual ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'
                }`}
            >
              {i <= pasoActual ? '✓' : i + 1}
            </div>
            <span
              className={`text-[10px] mt-1.5 whitespace-nowrap font-medium ${i <= pasoActual ? 'text-green-600' : 'text-gray-400'
                }`}
            >
              {paso.label}
            </span>
          </div>
          {i < pasos.length - 1 && (
            <div
              className={`h-0.5 w-6 sm:w-10 mx-1.5 mb-5 rounded ${i < pasoActual ? 'bg-green-500' : 'bg-gray-200'
                }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

/* ────────────────────────────────────────── */
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
  const [items, setItems] = useState<ItemPedido[]>([{ producto_id: '', cantidad: '1' }])
  const [errorStock, setErrorStock] = useState<string | null>(null)
  const { tiendaActual } = useTienda()
  const supabase = createClient()

  const formatCOP = (value: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value)

  const fetchOrders = async () => {
    if (!tiendaActual) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase
      .from('pedidos')
      .select(
        '*, bodegas(nombre), detalle_pedido(cantidad_solicitada, cantidad_aprobada, productos(nombre, precio))'
      )
      .eq('vendedor_id', user?.id)
      .eq('bodega_id', tiendaActual.id)
      .order('fecha', { ascending: false })
    const { data: prod } = await supabase
      .from('inventario')
      .select(`
        cantidad_disponible,
        productos!inner(id, nombre, precio, categoria, sku)
      `)
      .eq('bodega_id', tiendaActual.id)
      .gt('cantidad_disponible', 0)

    setPedidos(p || [])
    setProductos(
      prod
        ?.map((i: any) => ({
          id: i.productos?.id,
          nombre: i.productos?.nombre,
          precio: i.productos?.precio,
          categoria: i.productos?.categoria,
          sku: i.productos?.sku,
          stock_disponible: i.cantidad_disponible || 0,
        }))
        .filter((p: any) => p.id) || []
    )
    setIsLoading(false)
  }

  useEffect(() => {
    fetchOrders()
  }, [tiendaActual])

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

  const hayProductoCongelado = useMemo(() => {
    return items.some((it) => {
      if (!it.producto_id) return false
      const p = productos.find((pp) => pp.id === it.producto_id)
      return p ? p.stock_disponible <= STOCK_CONGELADO : false
    })
  }, [items, productos])

  const validarStock = (): string | null => {
    for (const item of items) {
      if (!item.producto_id) continue
      const cant = parseInt(item.cantidad || '0')
      if (cant <= 0) continue
      const prod = productos.find((pp) => pp.id === item.producto_id)
      if (!prod) continue
      if (prod.stock_disponible <= STOCK_CONGELADO) {
        return `"${prod.nombre}" está congelado (stock ${prod.stock_disponible} ≤ ${STOCK_CONGELADO}). Quítalo del pedido para continuar.`
      }
      if (cant > prod.stock_disponible) {
        return `"${prod.nombre}" solo tiene ${prod.stock_disponible} unidades disponibles`
      }
    }
    return null
  }

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
    setItems([{ producto_id: '', cantidad: '1' }])
    setObservacion('')
    setClienteSeleccionado(null)
    setPaso('cliente')
    setErrorStock(null)
  }

  const handleSelectProducto = (index: number, p: ProductoBusqueda) => {
    setItems(items.map((it, idx) => (idx === index ? { ...it, producto_id: p.id, cantidad: '1' } : it)))
    setErrorStock(null)
  }

  const handleCantidadChange = (index: number, cantidad: string) => {
    setItems(items.map((it, idx) => (idx === index ? { ...it, cantidad } : it)))
    setErrorStock(null)
  }

  const estadoLabel: Record<string, string> = {
    pendiente: 'En revisión',
    aprobado_bodega: 'Aprobado bodega',
    rechazado_bodega: 'Rechazado bodega',
    aprobado_cartera: 'Aprobado cartera',
    rechazado_cartera: 'Rechazado cartera',
    despachado: 'Despachado',
    entregado: 'Entregado',
  }

  const estadoColor: Record<string, string> = {
    pendiente: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    aprobado_bodega: 'bg-blue-50 text-blue-700 border-blue-200',
    rechazado_bodega: 'bg-red-50 text-red-700 border-red-200',
    aprobado_cartera: 'bg-green-50 text-green-700 border-green-200',
    rechazado_cartera: 'bg-red-50 text-red-700 border-red-200',
    despachado: 'bg-purple-50 text-purple-700 border-purple-200',
    entregado: 'bg-gray-100 text-gray-700 border-gray-200',
  }

  /* ────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#F7F7F9]">
      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#232323] leading-tight">Mis Pedidos</h1>
            <p className="text-xs text-[#828282] truncate">{tiendaActual?.nombre}</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="shrink-0 bg-[#1A0087] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#130066] active:scale-[0.98] transition-transform shadow-sm"
          >
            + Nuevo
          </button>
        </div>
      </header>

      {/* LISTA */}
      <main className="max-w-3xl mx-auto px-4 py-5">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
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
          <div className="space-y-3">
            {pedidos.map((p) => (
              <article
                key={p.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#232323] truncate">
                        {p.bodegas?.nombre}
                      </p>
                      <p className="text-xs text-[#828282] mt-0.5">
                        {new Date(p.fecha).toLocaleDateString('es-CO', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${estadoColor[p.estado] || 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                    >
                      {estadoLabel[p.estado] || p.estado}
                    </span>
                  </div>

                  {p.numero_factura && (
                    <p className="text-xs text-[#1A0087] font-medium mt-1">
                      {p.numero_factura}
                    </p>
                  )}
                  {p.observacion && (
                    <p className="text-xs italic text-gray-500 mt-1">"{p.observacion}"</p>
                  )}

                  <EstadoBarra estado={p.estado} />

                  <div className="border-t border-gray-100 pt-3 space-y-1.5">
                    {p.detalle_pedido?.map((d, i) => (
                      <div key={i} className="flex justify-between gap-3 text-sm">
                        <span className="text-[#232323] min-w-0 truncate">
                          {d.productos?.nombre}
                          <span className="text-[#828282] ml-1.5">×{d.cantidad_solicitada}</span>
                        </span>
                        <span className="text-[#828282] shrink-0 text-xs font-medium">
                          {formatCOP((d.productos?.precio || 0) * d.cantidad_solicitada)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {p.total > 0 && (
                    <div className="border-t border-gray-100 pt-3 mt-3 space-y-1">
                      <div className="flex justify-between text-xs text-[#828282]">
                        <span>Subtotal</span>
                        <span>{formatCOP(p.subtotal)}</span>
                      </div>
                      {p.descuento_porcentaje > 0 && (
                        <div className="flex justify-between text-xs text-green-600">
                          <span>Descuento ({p.descuento_porcentaje}%)</span>
                          <span>- {formatCOP(p.descuento_valor)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-baseline pt-1.5">
                        <span className="text-sm font-semibold text-[#232323]">Total</span>
                        <span className="text-base font-bold text-[#1A0087]">
                          {formatCOP(p.total)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* MODAL NUEVO PEDIDO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center sm:justify-center">
          <div className="w-full sm:max-w-lg bg-white sm:rounded-3xl rounded-t-3xl max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header sticky */}
            <div className="shrink-0 bg-white border-b border-gray-100">
              <div className="flex items-center gap-3 px-4 py-3">
                {paso === 'productos' ? (
                  <button
                    onClick={() => {
                      setPaso('cliente')
                      setClienteSeleccionado(null)
                    }}
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

              {/* Barra de progreso */}
              <div className="px-4 pb-3">
                <div className="flex items-center gap-2 text-xs">
                  <div
                    className={`flex items-center gap-1.5 font-medium ${paso === 'cliente' ? 'text-[#1A0087]' : 'text-green-600'
                      }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${paso === 'cliente'
                        ? 'bg-[#1A0087] text-white'
                        : 'bg-green-500 text-white'
                        }`}
                    >
                      {paso === 'cliente' ? '1' : <CheckIcon className="w-3 h-3" />}
                    </div>
                    Cliente
                  </div>
                  <div
                    className={`flex-1 h-0.5 rounded transition-colors ${paso === 'productos' ? 'bg-[#1A0087]' : 'bg-gray-200'
                      }`}
                  />
                  <div
                    className={`flex items-center gap-1.5 font-medium ${paso === 'productos' ? 'text-[#1A0087]' : 'text-[#828282]'
                      }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${paso === 'productos'
                        ? 'bg-[#1A0087] text-white'
                        : 'bg-gray-200 text-[#828282]'
                        }`}
                    >
                      2
                    </div>
                    Productos
                  </div>
                </div>
              </div>
            </div>

            {/* Contenido scrollable */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="p-4 space-y-4">
                {paso === 'cliente' && (
                  <>
                    <div>
                      <h3 className="text-base font-semibold text-[#232323]">
                        Identifica al cliente
                      </h3>
                      <p className="text-xs text-[#828282] mt-1">
                        Busca por CC/NIT o registra uno nuevo
                      </p>
                    </div>
                    <ClienteSelector
                      onClienteSeleccionado={(c) => {
                        setClienteSeleccionado(c)
                        setPaso('productos')
                      }}
                      onVerHistorial={(c) => {
                        setClienteSeleccionado(c)
                        setMostrarHistorial(true)
                      }}
                    />
                  </>
                )}

                {paso === 'productos' && clienteSeleccionado && (
                  <>
                    {/* Cliente seleccionado */}
                    <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl p-3">
                      <div className="w-10 h-10 shrink-0 rounded-full bg-green-500 flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#232323] truncate">
                          {clienteSeleccionado.nombre}
                        </p>
                        <p className="text-xs text-[#828282] truncate">
                          CC/NIT: {clienteSeleccionado.cc_nit}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setPaso('cliente')
                          setClienteSeleccionado(null)
                        }}
                        className="shrink-0 text-xs text-[#1A0087] font-medium hover:underline"
                      >
                        Cambiar
                      </button>
                    </div>

                    {/* Productos */}
                    <div>
                      <div className="mb-3">
                        <h3 className="text-sm font-semibold text-[#232323]">
                          Productos
                        </h3>
                        <p className="text-xs text-[#828282] mt-0.5">
                          {items.length} {items.length === 1 ? 'producto' : 'productos'} en el pedido
                        </p>
                      </div>

                      <div className="space-y-3">
                        {items.map((item, i) => (
                          <ProductoSelector
                            key={i}
                            index={i}
                            item={item}
                            productosBase={productos}
                            bodegaId={tiendaActual?.id}
                            onSelectProducto={handleSelectProducto}
                            onCantidadChange={handleCantidadChange}
                            onEliminar={(idx) => setItems(items.filter((_, k) => k !== idx))}
                            mostrarEliminar={items.length > 1}
                            formatCOP={formatCOP}
                          />
                        ))}
                      </div>

                      <button
                        onClick={() => setItems([...items, { producto_id: '', cantidad: '1' }])}
                        className="mt-3 w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#1A0087]/30 rounded-2xl text-sm font-medium text-[#1A0087] hover:bg-[#1A0087]/5 active:bg-[#1A0087]/10 transition-colors"
                      >
                        <PlusIcon className="w-4 h-4" />
                        Agregar otro producto
                      </button>
                    </div>

                    {/* Observación */}
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

                    {/* Errores */}
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

                    {/* Resumen */}
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

            {/* Footer sticky */}
            <div className="shrink-0 border-t border-gray-100 bg-white p-4 flex gap-2">
              <button
                onClick={resetModal}
                disabled={isSaving}
                className="flex-1 sm:flex-initial sm:px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-[#232323] hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>

              {paso === 'productos' && (() => {
                const sinProductos = items.every(
                  (it) => !it.producto_id || !it.cantidad || parseInt(it.cantidad) <= 0
                )
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

      {mostrarHistorial && clienteSeleccionado && (
        <HistorialClienteModal
          cliente={clienteSeleccionado}
          onClose={() => setMostrarHistorial(false)}
        />
      )}
    </div>
  )
}