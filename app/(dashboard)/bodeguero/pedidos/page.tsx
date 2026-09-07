'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'

interface DetallePedido {
  id: string
  cantidad_solicitada: number
  cantidad_aprobada: number | null
  productos: { id: string; nombre: string }
}

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
  usuarios: { nombre: string }
  bodegas: { id: string; nombre: string }
  detalle_pedido: DetallePedido[]
}

const EstadoBarra = ({ estado }: { estado: string }) => {
  const pasos = [
    { key: 'pendiente', label: 'Pedido' },
    { key: 'aprobado_bodega', label: 'Bodega' },
    { key: 'aprobado_cartera', label: 'Cartera' },
    { key: 'despachado', label: 'Despachado' },
    { key: 'entregado', label: 'Entregado' },
  ]

  const cancelado = estado === 'rechazado_bodega' || estado === 'rechazado_cartera'
  const pasoActual = pasos.findIndex(p => p.key === estado)

  if (cancelado) {
    return (
      <div className="flex items-center gap-2 my-3">
        <span className="bg-red-100 text-red-700 px-3 py-1 rounded text-sm">
          ❌ {estado === 'rechazado_bodega' ? 'Rechazado por bodega' : 'Rechazado por cartera'}
        </span>
      </div>
    )
  }

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
          {i < pasos.length - 1 && (
            <div className={`h-1 w-10 mx-1 mb-4 ${i < pasoActual ? 'bg-green-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function PedidosBodegueroPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [despachando, setDespachando] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [cantidadesEdit, setCantidadesEdit] = useState<Record<string, number>>({})
  const { tiendaActual } = useTienda()
  const supabase = createClient()

  const fetchOrders = async () => {
    if (!tiendaActual) return
    const { data } = await supabase
      .from('pedidos')
      .select('*, usuarios(nombre), bodegas(id, nombre), detalle_pedido(id, cantidad_solicitada, cantidad_aprobada, productos(id, nombre))')
      .eq('bodega_id', tiendaActual.id)
      .order('fecha', { ascending: false })
    setPedidos(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchOrders() }, [tiendaActual])

  const handleApproveBodega = async (id: string) => {
    setProcesando(id)
    await supabase.from('pedidos').update({ estado: 'aprobado_bodega' }).eq('id', id)
    setProcesando(null)
    fetchOrders()
  }

  const handleRejectBodega = async (id: string) => {
    setProcesando(id)
    await supabase.from('pedidos').update({ estado: 'rechazado_bodega' }).eq('id', id)
    setProcesando(null)
    fetchOrders()
  }

  const iniciarEdicion = (pedido: Pedido) => {
    const inicial: Record<string, number> = {}
    pedido.detalle_pedido.forEach(d => { inicial[d.id] = d.cantidad_solicitada })
    setCantidadesEdit(inicial)
    setEditando(pedido.id)
  }

  const guardarEdicion = async (pedido: Pedido) => {
    setProcesando(pedido.id)
    for (const d of pedido.detalle_pedido) {
      const nuevaCantidad = cantidadesEdit[d.id] ?? d.cantidad_solicitada
      await supabase.from('detalle_pedido').update({ cantidad_solicitada: nuevaCantidad }).eq('id', d.id)
    }
    setEditando(null)
    setCantidadesEdit({})
    setProcesando(null)
    fetchOrders()
  }

  const iniciarDespacho = (pedido: Pedido) => {
    const inicial: Record<string, number> = {}
    pedido.detalle_pedido.forEach(d => { inicial[d.id] = d.cantidad_solicitada })
    setCantidades(inicial)
    setDespachando(pedido.id)
  }

  const confirmarDespacho = async (pedido: Pedido) => {
    setProcesando(pedido.id)
    const { data: { user } } = await supabase.auth.getUser()

    for (const detalle of pedido.detalle_pedido) {
      const cantidad = cantidades[detalle.id] || 0
      await supabase.from('detalle_pedido').update({ cantidad_aprobada: cantidad }).eq('id', detalle.id)

      if (cantidad > 0) {
        await supabase.from('movimientos').insert({
          producto_id: detalle.productos.id,
          bodega_origen_id: pedido.bodegas.id,
          cantidad,
          tipo: 'salida',
          usuario_id: user?.id,
          fecha: new Date().toISOString(),
          observacion: `Despacho ${pedido.numero_factura || pedido.id.slice(0, 8)}`
        })

        const { data: inv } = await supabase
          .from('inventario')
          .select('id, cantidad_disponible')
          .eq('producto_id', detalle.productos.id)
          .eq('bodega_id', pedido.bodegas.id)
          .single()

        if (inv) {
          await supabase.from('inventario').update({
            cantidad_disponible: Math.max(0, inv.cantidad_disponible - cantidad)
          }).eq('id', inv.id)
        }
      }
    }

    await supabase.from('pedidos').update({ estado: 'despachado' }).eq('id', pedido.id)
    setDespachando(null)
    setProcesando(null)
    fetchOrders()
  }

  const formatCOP = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)

  const estadoLabel: Record<string, string> = {
    pendiente: 'Pendiente',
    aprobado_bodega: 'Aprobado bodega',
    rechazado_bodega: 'Rechazado bodega',
    aprobado_cartera: 'Aprobado cartera',
    rechazado_cartera: 'Rechazado cartera',
    despachado: 'Despachado',
    entregado: 'Entregado'
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

  const pendientes = pedidos.filter(p => p.estado === 'pendiente')
  const aprobadosBodega = pedidos.filter(p => p.estado === 'aprobado_bodega')
  const listos = pedidos.filter(p => p.estado === 'aprobado_cartera')
  const historial = pedidos.filter(p => ['rechazado_bodega', 'rechazado_cartera', 'despachado', 'entregado'].includes(p.estado))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <p className="text-gray-500 text-sm">{tiendaActual?.nombre}</p>
      </div>

      {loading ? <p>Cargando...</p> : (
        <>
          {/* Pendientes - bodeguero debe revisar */}
          {pendientes.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-3 text-yellow-700">⏳ Nuevos pedidos ({pendientes.length})</h2>
              <div className="flex flex-col gap-4">
                {pendientes.map(p => (
                  <div key={p.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-400">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">Vendedor: {p.usuarios?.nombre}</p>
                        <p className="text-sm text-gray-500">{new Date(p.fecha).toLocaleDateString()}</p>
                        {p.observacion && <p className="text-sm italic">{p.observacion}</p>}
                      </div>
                      <span className={`px-3 py-1 rounded text-sm ${estadoColor[p.estado]}`}>{estadoLabel[p.estado]}</span>
                    </div>

                    <EstadoBarra estado={p.estado} />

                    <div className="border-t pt-3">
                      {editando === p.id ? (
                        <>
                          <p className="text-sm font-medium mb-2">✏️ Editando cantidades:</p>
                          {p.detalle_pedido.map(d => (
                            <div key={d.id} className="flex items-center gap-3 mb-2">
                              <span className="flex-1 text-sm">{d.productos?.nombre}</span>
                              <span className="text-gray-400 text-sm">Original: {d.cantidad_solicitada}</span>
                              <input
                                type="number" min="0"
                                className="w-20 border p-1 rounded text-sm"
                                value={cantidadesEdit[d.id] ?? d.cantidad_solicitada}
                                onChange={e => setCantidadesEdit({ ...cantidadesEdit, [d.id]: parseInt(e.target.value) || 0 })}
                              />
                            </div>
                          ))}
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => { setEditando(null); setCantidadesEdit({}) }} className="bg-gray-300 px-3 py-1 rounded text-sm">Cancelar</button>
                            <button onClick={() => guardarEdicion(p)} disabled={procesando === p.id} className="bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50">
                              {procesando === p.id ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          {p.detalle_pedido.map((d, i) => (
                            <p key={i} className="text-sm">• {d.productos?.nombre} x{d.cantidad_solicitada}</p>
                          ))}
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => iniciarEdicion(p)} className="bg-yellow-400 text-white px-4 py-2 rounded text-sm hover:bg-yellow-500">
                              ✏️ Editar
                            </button>
                            <button onClick={() => handleApproveBodega(p.id)} disabled={procesando === p.id} className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 disabled:opacity-50">
                              ✅ Aprobar y enviar a cartera
                            </button>
                            <button onClick={() => handleRejectBodega(p.id)} disabled={procesando === p.id} className="bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600 disabled:opacity-50">
                              ❌ Rechazar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Aprobados bodega - esperando cartera */}
          {aprobadosBodega.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-3 text-blue-700">📋 En revisión de cartera ({aprobadosBodega.length})</h2>
              <div className="flex flex-col gap-3">
                {aprobadosBodega.map(p => (
                  <div key={p.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-400 opacity-80">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">Vendedor: {p.usuarios?.nombre}</p>
                        <p className="text-sm text-gray-500">{new Date(p.fecha).toLocaleDateString()}</p>
                      </div>
                      <span className={`px-3 py-1 rounded text-sm ${estadoColor[p.estado]}`}>{estadoLabel[p.estado]}</span>
                    </div>
                    <EstadoBarra estado={p.estado} />
                    <div className="border-t pt-3">
                      {p.detalle_pedido.map((d, i) => (
                        <p key={i} className="text-sm text-gray-500">• {d.productos?.nombre} x{d.cantidad_solicitada}</p>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2 italic">Esperando aprobación de cartera</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Listos para despachar */}
          {listos.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-3 text-green-700">✅ Listos para despachar ({listos.length})</h2>
              <div className="flex flex-col gap-4">
                {listos.map(p => (
                  <div key={p.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">Vendedor: {p.usuarios?.nombre}</p>
                        <p className="text-sm text-gray-500">{new Date(p.fecha).toLocaleDateString()}</p>
                        {p.numero_factura && <p className="text-sm text-blue-600 font-medium">{p.numero_factura}</p>}
                      </div>
                      <span className={`px-3 py-1 rounded text-sm ${estadoColor[p.estado]}`}>{estadoLabel[p.estado]}</span>
                    </div>
                    <EstadoBarra estado={p.estado} />
                    {p.total > 0 && (
                      <div className="text-sm mb-3">
                        {p.descuento_porcentaje > 0 && <p className="text-green-600">Descuento {p.descuento_porcentaje}%: -{formatCOP(p.descuento_valor)}</p>}
                        <p className="font-bold">Total: {formatCOP(p.total)}</p>
                      </div>
                    )}
                    {despachando === p.id ? (
                      <div className="border-t pt-3">
                        <p className="text-sm font-medium mb-2">Confirma cantidades a despachar:</p>
                        {p.detalle_pedido.map(d => (
                          <div key={d.id} className="flex items-center gap-3 mb-2">
                            <span className="flex-1 text-sm">{d.productos?.nombre}</span>
                            <span className="text-gray-400 text-sm">Solicitado: {d.cantidad_solicitada}</span>
                            <input type="number" min="0" max={d.cantidad_solicitada} className="w-20 border p-1 rounded text-sm" value={cantidades[d.id] || 0} onChange={e => setCantidades({ ...cantidades, [d.id]: parseInt(e.target.value) || 0 })} />
                          </div>
                        ))}
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => setDespachando(null)} className="bg-gray-300 px-3 py-1 rounded text-sm">Cancelar</button>
                          <button onClick={() => confirmarDespacho(p)} disabled={procesando === p.id} className="bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50">
                            {procesando === p.id ? 'Despachando...' : 'Confirmar despacho'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="border-t pt-3">
                        {p.detalle_pedido.map((d, i) => (
                          <p key={i} className="text-sm">• {d.productos?.nombre} x{d.cantidad_solicitada}</p>
                        ))}
                        <button onClick={() => iniciarDespacho(p)} className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Despachar pedido</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historial */}
          <div>
            <h2 className="text-lg font-semibold mb-3 text-gray-600">Historial</h2>
            <div className="flex flex-col gap-3">
              {historial.map(p => (
                <div key={p.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Vendedor: {p.usuarios?.nombre}</p>
                      <p className="text-sm text-gray-500">{new Date(p.fecha).toLocaleDateString()}</p>
                      {p.numero_factura && <p className="text-sm text-blue-600">{p.numero_factura}</p>}
                      {p.detalle_pedido.map((d, i) => (
                        <p key={i} className="text-sm text-gray-600">• {d.productos?.nombre} x{d.cantidad_solicitada}{d.cantidad_aprobada !== null && ` → despachado: ${d.cantidad_aprobada}`}</p>
                      ))}
                      {p.total > 0 && <p className="font-bold text-sm mt-1">Total: {formatCOP(p.total)}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded text-sm ${estadoColor[p.estado]}`}>{estadoLabel[p.estado]}</span>
                      {p.estado === 'despachado' && (
                        <button onClick={async () => { await supabase.from('pedidos').update({ estado: 'entregado' }).eq('id', p.id); fetchOrders() }} className="bg-gray-600 text-white px-3 py-1 rounded text-sm">Marcar entregado</button>
                      )}
                    </div>
                  </div>
                  <EstadoBarra estado={p.estado} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}