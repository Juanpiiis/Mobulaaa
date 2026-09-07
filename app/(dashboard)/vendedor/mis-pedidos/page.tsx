'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import { calcularDescuento, DESCUENTOS } from '@/types/index'

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
  detalle_pedido: { cantidad_solicitada: number; cantidad_aprobada: number | null; productos: { nombre: string; precio: number } }[]
}

interface Producto { id: string; nombre: string; precio: number; categoria: string }

interface ItemPedido { producto_id: string; cantidad: string }

const EstadoBarra = ({ estado }: { estado: string }) => {
  const pasos = [
    { key: 'pendiente', label: 'Enviado' },
    { key: 'aprobado_bodega', label: 'Bodega' },
    { key: 'aprobado_cartera', label: 'Cartera' },
    { key: 'despachado', label: 'Despachado' },
    { key: 'entregado', label: 'Entregado' },
  ]

  if (estado === 'rechazado_bodega' || estado === 'rechazado_cartera') {
    return <div className="my-2"><span className="bg-red-100 text-red-700 px-3 py-1 rounded text-sm">❌ {estado === 'rechazado_bodega' ? 'Rechazado por bodega' : 'Rechazado por cartera'}</span></div>
  }

  const pasoActual = pasos.findIndex(p => p.key === estado)

  return (
    <div className="flex items-center my-3">
      {pasos.map((paso, i) => (
        <div key={paso.key} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i <= pasoActual ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
              {i <= pasoActual ? '✓' : i + 1}
            </div>
            <span className={`text-xs mt-1 ${i <= pasoActual ? 'text-green-600 font-medium' : 'text-gray-400'}`}>{paso.label}</span>
          </div>
          {i < pasos.length - 1 && <div className={`h-1 w-12 mx-1 mb-4 ${i < pasoActual ? 'bg-green-500' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )
}

export default function MisPedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [observacion, setObservacion] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteCC, setClienteCC] = useState('')
  const [items, setItems] = useState<ItemPedido[]>([{ producto_id: '', cantidad: '1' }])
  const [busqueda, setBusqueda] = useState<Record<number, string>>({})
  const { tiendaActual } = useTienda()
  const supabase = createClient()

  const formatCOP = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)

  const fetchOrders = async () => {
    if (!tiendaActual) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase
      .from('pedidos')
      .select('*, bodegas(nombre), detalle_pedido(cantidad_solicitada, cantidad_aprobada, productos(nombre, precio))')
      .eq('vendedor_id', user?.id)
      .eq('bodega_id', tiendaActual.id)
      .order('fecha', { ascending: false })
    const { data: prod } = await supabase
      .from('inventario')
      .select('productos(id, nombre, precio, categoria)')
      .eq('bodega_id', tiendaActual.id)
      .gt('cantidad_disponible', 0)
    setPedidos(p || [])
    setProductos(prod?.map((i: any) => i.productos).filter(Boolean) || [])
    setIsLoading(false)
  }

  useEffect(() => { fetchOrders() }, [tiendaActual])

  // Calcular totales en tiempo real
  const preview = useMemo(() => {
    const subtotal = items.reduce((acc, item) => {
      const prod = productos.find(p => p.id === item.producto_id)
      if (!prod || !item.cantidad) return acc
      return acc + prod.precio * parseInt(item.cantidad)
    }, 0)
    const porcentaje = calcularDescuento(subtotal)
    const descuento = subtotal * (porcentaje / 100)
    const total = subtotal - descuento

    const siguienteDescuento = DESCUENTOS.slice().reverse().find(d => subtotal < d.minimo)
    const faltaPara = siguienteDescuento ? siguienteDescuento.minimo - subtotal : 0

    return { subtotal, porcentaje, descuento, total, faltaPara, siguienteDescuento }
  }, [items, productos])

  const handleSave = async () => {
    if (!tiendaActual) return
    const itemsValidos = items.filter(i => i.producto_id && i.cantidad && parseInt(i.cantidad) > 0)
    if (itemsValidos.length === 0) return
    setIsSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: pedido } = await supabase.from('pedidos').insert({
  vendedor_id: user?.id,
  bodega_id: tiendaActual.id,
  observacion: observacion || null,
  cliente_nombre: clienteNombre || null,
  cliente_cc: clienteCC || null,
  estado: 'pendiente',
  fecha: new Date().toISOString()
}).select().single()

    if (pedido) {
      await supabase.from('detalle_pedido').insert(
        itemsValidos.map(item => ({
          pedido_id: pedido.id,
          producto_id: item.producto_id,
          cantidad_solicitada: parseInt(item.cantidad)
        }))
      )
    }

    setIsModalOpen(false)
    setItems([{ producto_id: '', cantidad: '1' }])
    setObservacion('')
    setClienteNombre('')
    setClienteCC('')
    setBusqueda({})
    setIsSaving(false)
    fetchOrders()
  }

  const estadoLabel: Record<string, string> = {
    pendiente: 'En revisión bodega',
    aprobado_bodega: 'Aprobado bodega ✅',
    rechazado_bodega: 'Rechazado bodega ❌',
    aprobado_cartera: 'Aprobado cartera ✅',
    rechazado_cartera: 'Rechazado cartera ❌',
    despachado: 'Despachado 📦',
    entregado: 'Entregado 🎉'
  }

  const estadoColor: Record<string, string> = {
    pendiente: 'bg-yellow-100 text-yellow-700',
    aprobado_bodega: 'bg-blue-100 text-blue-700',
    rechazado_bodega: 'bg-red-100 text-red-700',
    aprobado_cartera: 'bg-green-100 text-green-700',
    rechazado_cartera: 'bg-red-100 text-red-700',
    despachado: 'bg-purple-100 text-purple-700',
    entregado: 'bg-gray-100 text-gray-700'
  }

  const productosFiltrados = (idx: number) => {
    const b = busqueda[idx] || ''
    if (!b) return productos.slice(0, 10)
    return productos.filter(p => p.nombre.toLowerCase().includes(b.toLowerCase())).slice(0, 10)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mis Pedidos</h1>
          <p className="text-gray-500 text-sm">{tiendaActual?.nombre}</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">+ Nuevo Pedido</button>
      </div>

      {isLoading ? <p>Cargando...</p> : (
        <div className="flex flex-col gap-4">
          {pedidos.length === 0 && <p className="text-gray-500">No tienes pedidos aún.</p>}
          {pedidos.map(p => (
            <div key={p.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{p.bodegas?.nombre}</p>
                  <p className="text-sm text-gray-500">{new Date(p.fecha).toLocaleDateString()}</p>
                  {p.numero_factura && <p className="text-sm text-blue-600 font-medium">{p.numero_factura}</p>}
                  {p.observacion && <p className="text-sm italic mt-1">{p.observacion}</p>}
                </div>
                <span className={`px-3 py-1 rounded text-sm ${estadoColor[p.estado]}`}>{estadoLabel[p.estado]}</span>
              </div>
              <EstadoBarra estado={p.estado} />
              <div className="border-t pt-3">
                {p.detalle_pedido?.map((d, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>• {d.productos?.nombre} x{d.cantidad_solicitada}</span>
                    <span className="text-gray-500">{formatCOP((d.productos?.precio || 0) * d.cantidad_solicitada)}</span>
                  </div>
                ))}
              </div>
              {p.total > 0 && (
                <div className="border-t pt-2 mt-2 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span><span>{formatCOP(p.subtotal)}</span>
                  </div>
                  {p.descuento_porcentaje > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Descuento ({p.descuento_porcentaje}%)</span>
                      <span>- {formatCOP(p.descuento_valor)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold">
                    <span>Total</span><span>{formatCOP(p.total)}</span>
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
              <h2 className="text-xl font-bold mb-4">Nuevo Pedido — {tiendaActual?.nombre}</h2>

              {/* Datos del cliente */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="font-medium text-sm mb-3">Datos del cliente</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nombre del cliente</label>
                    <input className="w-full border p-2 rounded text-sm" placeholder="Nombre completo" value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">CC / NIT</label>
                    <input className="w-full border p-2 rounded text-sm" placeholder="Cédula o NIT" value={clienteCC} onChange={e => setClienteCC(e.target.value)} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-gray-500 mb-1">Observación (opcional)</label>
                  <input className="w-full border p-2 rounded text-sm" placeholder="Ej: Entrega urgente" value={observacion} onChange={e => setObservacion(e.target.value)} />
                </div>
              </div>

              {/* Productos */}
              <p className="font-medium text-sm mb-3">Productos:</p>
              {items.map((item, i) => {
                const prod = productos.find(p => p.id === item.producto_id)
                return (
                  <div key={i} className="mb-3">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        <input
                          className="w-full border p-2 rounded text-sm"
                          placeholder="Buscar producto..."
                          value={busqueda[i] !== undefined ? busqueda[i] : prod?.nombre || ''}
                          onChange={e => {
                            setBusqueda({ ...busqueda, [i]: e.target.value })
                            setItems(items.map((it, idx) => idx === i ? { ...it, producto_id: '' } : it))
                          }}
                        />
                        {busqueda[i] && !item.producto_id && (
                          <div className="border rounded mt-1 max-h-36 overflow-y-auto shadow bg-white">
                            {productosFiltrados(i).map(p => (
                              <div key={p.id} className="p-2 hover:bg-blue-50 cursor-pointer text-sm border-b" onClick={() => {
                                setItems(items.map((it, idx) => idx === i ? { ...it, producto_id: p.id } : it))
                                setBusqueda({ ...busqueda, [i]: p.nombre })
                              }}>
                                <span className="font-medium">{p.nombre}</span>
                                <span className="text-gray-400 ml-2">{formatCOP(p.precio)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        className="w-20 border p-2 rounded text-sm"
                        type="number" min="1" placeholder="Cant."
                        value={item.cantidad}
                        onChange={e => setItems(items.map((it, idx) => idx === i ? { ...it, cantidad: e.target.value } : it))}
                      />
                      {items.length > 1 && (
                        <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 px-2 py-2">✕</button>
                      )}
                    </div>
                    {prod && item.cantidad && (
                      <p className="text-xs text-gray-400 mt-1 ml-1">
                        {formatCOP(prod.precio)} x {item.cantidad} = {formatCOP(prod.precio * parseInt(item.cantidad || '0'))}
                      </p>
                    )}
                  </div>
                )
              })}

              <button onClick={() => setItems([...items, { producto_id: '', cantidad: '1' }])} className="text-blue-600 text-sm mb-4 hover:underline">+ Agregar producto</button>

              {/* Preview de totales en tiempo real */}
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
                      ⚡ Agrega {formatCOP(preview.faltaPara)} más para obtener {preview.siguienteDescuento?.porcentaje}% de descuento
                    </div>
                  ) : null}
                  <div className="flex justify-between font-bold border-t pt-2 mt-1">
                    <span>Total</span>
                    <span>{formatCOP(preview.total)}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button onClick={() => { setIsModalOpen(false); setItems([{ producto_id: '', cantidad: '1' }]); setObservacion(''); setClienteNombre(''); setClienteCC(''); setBusqueda({}) }} className="bg-gray-300 px-4 py-2 rounded">Cancelar</button>
                <button onClick={handleSave} disabled={isSaving || preview.subtotal === 0} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
                  {isSaving ? 'Enviando...' : 'Enviar pedido'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
