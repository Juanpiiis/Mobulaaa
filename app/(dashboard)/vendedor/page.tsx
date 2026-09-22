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
      <div className="my-2">
        <span className="bg-red-100 text-red-700 px-3 py-1 rounded text-sm">
          ❌ {estado === 'rechazado_bodega' ? 'Rechazado por bodega' : 'Rechazado por cartera'}
        </span>
      </div>
    )
  }

  const pasoActual = pasos.findIndex((p) => p.key === estado)

  return (
    <div className="flex items-center my-3">
      {pasos.map((paso, i) => (
        <div key={paso.key} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i <= pasoActual ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                }`}
            >
              {i <= pasoActual ? '✓' : i + 1}
            </div>
            <span
              className={`text-xs mt-1 ${i <= pasoActual ? 'text-green-600 font-medium' : 'text-gray-400'
                }`}
            >
              {paso.label}
            </span>
          </div>
          {i < pasos.length - 1 && (
            <div
              className={`h-1 w-12 mx-1 mb-4 ${i < pasoActual ? 'bg-green-500' : 'bg-gray-200'
                }`}
            />
          )}
        </div>
      ))}
    </div>
  )
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
      .select('cantidad_disponible, productos(id, nombre, precio, categoria, sku)')
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
      return p ? p.stock_disponible >= STOCK_CONGELADO : false
    })
  }, [items, productos])

  const validarStock = (): string | null => {
    for (const item of items) {
      if (!item.producto_id) continue
      const cant = parseInt(item.cantidad || '0')
      if (cant <= 0) continue

      const prod = productos.find((pp) => pp.id === item.producto_id)
      if (!prod) continue

      if (prod.stock_disponible >= STOCK_CONGELADO) {
        return `"${prod.nombre}" está congelado en inventario (stock ≥ ${STOCK_CONGELADO}). Quítalo del pedido para continuar.`
      }

      if (cant > prod.stock_disponible) {
        return `"${prod.nombre}" solo tiene ${prod.stock_disponible} unidades disponibles`
      }
    }
    return null
  }

  const handleSave = async () => {
    if (!tiendaActual) return
    if (!clienteSeleccionado) return

    const err = validarStock()
    if (err) {
      setErrorStock(err)
      return
    }
    setErrorStock(null)

    const itemsValidos = items.filter(
      (i) => i.producto_id && i.cantidad && parseInt(i.cantidad) > 0
    )
    if (itemsValidos.length === 0) return
    if (isSaving) return
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
        console.error(errPedido)
        return
      }

      await supabase.from('detalle_pedido').insert(
        itemsValidos.map((item) => ({
          pedido_id: pedido.id,
          producto_id: item.producto_id,
          cantidad_solicitada: parseInt(item.cantidad),
        }))
      )

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
    setItems(items.map((it, idx) => (idx === index ? { ...it, producto_id: p.id } : it)))
    setErrorStock(null)
  }

  const handleCantidadChange = (index: number, cantidad: string) => {
    setItems(items.map((it, idx) => (idx === index ? { ...it, cantidad } : it)))
    setErrorStock(null)
  }

  const estadoLabel: Record<string, string> = {
    pendiente: 'En revisión bodega',
    aprobado_bodega: 'Aprobado bodega ✅',
    rechazado_bodega: 'Rechazado bodega ❌',
    aprobado_cartera: 'Aprobado cartera ✅',
    rechazado_cartera: 'Rechazado cartera ❌',
    despachado: 'Despachado 📦',
    entregado: 'Entregado 🎉',
  }

  const estadoColor: Record<string, string> = {
    pendiente: 'bg-yellow-100 text-yellow-700',
    aprobado_bodega: 'bg-blue-100 text-blue-700',
    rechazado_bodega: 'bg-red-100 text-red-700',
    aprobado_cartera: 'bg-green-100 text-green-700',
    rechazado_cartera: 'bg-red-100 text-red-700',
    despachado: 'bg-purple-100 text-purple-700',
    entregado: 'bg-gray-100 text-gray-700',
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mis Pedidos</h1>
          <p className="text-gray-500 text-sm">{tiendaActual?.nombre}</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#1A0087] text-white px-4 py-2 rounded hover:bg-[#130066]"
        >
          + Nuevo Pedido
        </button>
      </div>

      {isLoading ? (
        <p>Cargando...</p>
      ) : (
        <div className="flex flex-col gap-4">
          {pedidos.length === 0 && <p className="text-gray-500">No tienes pedidos aún.</p>}
          {pedidos.map((p) => (
            <div key={p.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{p.bodegas?.nombre}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(p.fecha).toLocaleDateString()}
                  </p>
                  {p.numero_factura && (
                    <p className="text-sm text-blue-600 font-medium">{p.numero_factura}</p>
                  )}
                  {p.observacion && <p className="text-sm italic mt-1">{p.observacion}</p>}
                </div>
                <span className={`px-3 py-1 rounded text-sm ${estadoColor[p.estado]}`}>
                  {estadoLabel[p.estado]}
                </span>
              </div>
              <EstadoBarra estado={p.estado} />
              <div className="border-t pt-3">
                {p.detalle_pedido?.map((d, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>
                      • {d.productos?.nombre} x{d.cantidad_solicitada}
                    </span>
                    <span className="text-gray-500">
                      {formatCOP((d.productos?.precio || 0) * d.cantidad_solicitada)}
                    </span>
                  </div>
                ))}
              </div>
              {p.total > 0 && (
                <div className="border-t pt-2 mt-2 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span>{formatCOP(p.subtotal)}</span>
                  </div>
                  {p.descuento_porcentaje > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Descuento ({p.descuento_porcentaje}%)</span>
                      <span>- {formatCOP(p.descuento_valor)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{formatCOP(p.total)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-screen overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                Nuevo Pedido — {tiendaActual?.nombre}
              </h2>

              {paso === 'cliente' && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="font-medium text-sm mb-1 text-[#232323]">
                    Paso 1 · Identifica al cliente
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    Busca por CC/NIT o registra un cliente nuevo
                  </p>
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
                </div>
              )}

              {paso === 'productos' && clienteSeleccionado && (
                <>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-[#232323]">
                        ✓ {clienteSeleccionado.nombre}
                      </p>
                      <p className="text-xs text-gray-500">
                        CC/NIT: {clienteSeleccionado.cc_nit}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPaso('cliente')
                        setClienteSeleccionado(null)
                      }}
                      className="text-xs text-[#1A0087] font-medium hover:underline"
                    >
                      Cambiar
                    </button>
                  </div>

                  <p className="font-medium text-sm mb-3">Productos:</p>
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

                  <button
                    onClick={() =>
                      setItems([...items, { producto_id: '', cantidad: '1' }])
                    }
                    className="text-[#1A0087] text-sm mb-4 hover:underline"
                  >
                    + Agregar producto
                  </button>

                  <div className="mb-4">
                    <label className="block text-xs text-gray-500 mb-1">
                      Observación (opcional)
                    </label>
                    <input
                      className="w-full border p-2 rounded text-sm"
                      placeholder="Ej: Entrega urgente"
                      value={observacion}
                      onChange={(e) => setObservacion(e.target.value)}
                    />
                  </div>

                  {errorStock && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-red-700 font-medium">⚠️ {errorStock}</p>
                    </div>
                  )}

                  {hayProductoCongelado && !errorStock && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-red-700 font-medium">
                        🔒 Hay productos congelados en el pedido. Quítalos para poder enviar.
                      </p>
                    </div>
                  )}

                  {preview.subtotal > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-4 border">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="font-medium">{formatCOP(preview.subtotal)}</span>
                      </div>
                      {preview.porcentaje > 0 ? (
                        <div className="flex justify-between text-sm mb-1 text-green-600">
                          <span>Descuento ({preview.porcentaje}%) ✅</span>
                          <span>- {formatCOP(preview.descuento)}</span>
                        </div>
                      ) : preview.faltaPara > 0 ? (
                        <div className="text-xs text-yellow-600 mb-1 bg-yellow-50 p-2 rounded">
                          ⚡ Agrega {formatCOP(preview.faltaPara)} más para obtener{' '}
                          {preview.siguienteDescuento?.porcentaje}% de descuento
                        </div>
                      ) : null}
                      <div className="flex justify-between font-bold border-t pt-2 mt-1">
                        <span>Total</span>
                        <span>{formatCOP(preview.total)}</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={resetModal}
                  disabled={isSaving}
                  className="bg-gray-300 px-4 py-2 rounded disabled:opacity-50"
                >
                  Cancelar
                </button>
                {paso === 'productos' && (
                  <button
                    onClick={handleSave}
                    disabled={
                      isSaving ||
                      preview.subtotal === 0 ||
                      !clienteSeleccionado ||
                      hayProductoCongelado
                    }
                    className="bg-[#1A0087] text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-[#130066]"
                    title={hayProductoCongelado ? 'Quita los productos congelados para continuar' : ''}
                  >
                    {isSaving
                      ? 'Enviando...'
                      : hayProductoCongelado
                        ? '🔒 Quita los congelados'
                        : 'Enviar pedido'}
                  </button>
                )}
              </div>
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