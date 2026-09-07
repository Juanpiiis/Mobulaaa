'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import { calcularDescuento } from '@/types/index'

interface DetallePedido {
  id: string
  cantidad_solicitada: number
  productos: { nombre: string; precio: number }
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
  usuarios: { nombre: string; email: string }
  bodegas: { nombre: string }
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
      <div className="my-2">
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
          {i < pasos.length - 1 && <div className={`h-1 w-10 mx-1 mb-4 ${i < pasoActual ? 'bg-green-500' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )
}

export default function CarteraPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)
  const { tiendaActual } = useTienda()
  const supabase = createClient()

  const fetchOrders = async () => {
    if (!tiendaActual) return
    setLoading(true)
    const { data } = await supabase
      .from('pedidos')
      .select('*, usuarios(nombre, email), bodegas(nombre), detalle_pedido(id, cantidad_solicitada, productos(nombre, precio))')
      .eq('bodega_id', tiendaActual.id)
      .order('fecha', { ascending: false })
    setPedidos(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchOrders() }, [tiendaActual])

  const calcularTotales = (detalles: DetallePedido[]) => {
    const subtotal = detalles.reduce((acc, d) => acc + (d.productos?.precio || 0) * d.cantidad_solicitada, 0)
    const porcentaje = calcularDescuento(subtotal)
    const descuento = subtotal * (porcentaje / 100)
    const total = subtotal - descuento
    return { subtotal, porcentaje, descuento, total }
  }

  const handleApprove = async (pedido: Pedido) => {
    setProcesando(pedido.id)
    const { subtotal, porcentaje, descuento, total } = calcularTotales(pedido.detalle_pedido)
    const numeroFactura = `FAC-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`

    await supabase.from('pedidos').update({
      estado: 'aprobado_cartera',
      subtotal,
      descuento_porcentaje: porcentaje,
      descuento_valor: descuento,
      total,
      numero_factura: numeroFactura
    }).eq('id', pedido.id)

    setProcesando(null)
    fetchOrders()
  }

  const handleReject = async (id: string) => {
    setProcesando(id)
    await supabase.from('pedidos').update({ estado: 'rechazado_cartera' }).eq('id', id)
    setProcesando(null)
    fetchOrders()
  }

  const formatCOP = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)

  const estadoColor: Record<string, string> = {
    pendiente: 'bg-yellow-100 text-yellow-700',
    aprobado_bodega: 'bg-blue-100 text-blue-700',
    rechazado_bodega: 'bg-red-100 text-red-700',
    aprobado_cartera: 'bg-green-100 text-green-700',
    rechazado_cartera: 'bg-red-100 text-red-700',
    despachado: 'bg-purple-100 text-purple-700',
    entregado: 'bg-gray-100 text-gray-700'
  }

  const estadoLabel: Record<string, string> = {
    pendiente: 'Pendiente bodega',
    aprobado_bodega: 'Aprobado bodega',
    rechazado_bodega: 'Rechazado bodega',
    aprobado_cartera: 'Aprobado',
    rechazado_cartera: 'Rechazado',
    despachado: 'Despachado',
    entregado: 'Entregado'
  }

  const porAprobar = pedidos.filter(p => p.estado === 'aprobado_bodega')
  const historial = pedidos.filter(p => p.estado !== 'aprobado_bodega')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Cartera</h1>
        <p className="text-gray-500 text-sm">{tiendaActual?.nombre}</p>
      </div>

      {loading ? <p>Cargando...</p> : (
        <>
          {porAprobar.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-3 text-blue-700">📋 Por aprobar ({porAprobar.length})</h2>
              <div className="flex flex-col gap-4">
                {porAprobar.map(p => {
                  const { subtotal, porcentaje, descuento, total } = calcularTotales(p.detalle_pedido)
                  return (
                    <div key={p.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-400">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-medium">Vendedor: {p.usuarios?.nombre}</p>
                          <p className="text-sm text-gray-500">{p.usuarios?.email}</p>
                          <p className="text-sm text-gray-500">{new Date(p.fecha).toLocaleDateString()}</p>
                          {p.observacion && <p className="text-sm italic mt-1">{p.observacion}</p>}
                        </div>
                        <span className={`px-3 py-1 rounded text-sm ${estadoColor[p.estado]}`}>{estadoLabel[p.estado]}</span>
                      </div>

                      <EstadoBarra estado={p.estado} />

                      <div className="border-t pt-3 mb-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="text-left pb-1">Producto</th>
                              <th className="text-right pb-1">Precio</th>
                              <th className="text-right pb-1">Cant.</th>
                              <th className="text-right pb-1">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.detalle_pedido.map((d, i) => (
                              <tr key={i} className="border-t">
                                <td className="py-1">{d.productos?.nombre}</td>
                                <td className="py-1 text-right">{formatCOP(d.productos?.precio || 0)}</td>
                                <td className="py-1 text-right">{d.cantidad_solicitada}</td>
                                <td className="py-1 text-right">{formatCOP((d.productos?.precio || 0) * d.cantidad_solicitada)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="border-t pt-3 text-sm mb-4">
                        <div className="flex justify-between text-gray-500">
                          <span>Subtotal</span>
                          <span>{formatCOP(subtotal)}</span>
                        </div>
                        {porcentaje > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Descuento ({porcentaje}%)</span>
                            <span>- {formatCOP(descuento)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-base mt-1">
                          <span>Total</span>
                          <span>{formatCOP(total)}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => handleApprove(p)} disabled={procesando === p.id} className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50">
                          {procesando === p.id ? 'Procesando...' : '✅ Aprobar y generar factura'}
                        </button>
                        <button onClick={() => handleReject(p.id)} disabled={procesando === p.id} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50">
                          ❌ Rechazar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold mb-3 text-gray-600">Historial</h2>
            <div className="flex flex-col gap-3">
              {historial.map(p => (
                <div key={p.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{p.usuarios?.nombre}</p>
                      <p className="text-sm text-gray-500">{new Date(p.fecha).toLocaleDateString()}</p>
                      {p.numero_factura && <p className="text-sm text-blue-600 font-medium">{p.numero_factura}</p>}
                      {p.detalle_pedido.map((d, i) => (
                        <p key={i} className="text-sm text-gray-600">• {d.productos?.nombre} x{d.cantidad_solicitada}</p>
                      ))}
                      {p.total > 0 && (
                        <div className="mt-1 text-sm">
                          {p.descuento_porcentaje > 0 && <p className="text-green-600">Descuento {p.descuento_porcentaje}%: -{formatCOP(p.descuento_valor)}</p>}
                          <p className="font-bold">Total: {formatCOP(p.total)}</p>
                        </div>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded text-sm ${estadoColor[p.estado]}`}>{estadoLabel[p.estado]}</span>
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