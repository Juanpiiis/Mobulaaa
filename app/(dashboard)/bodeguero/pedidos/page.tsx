'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Pedido {
  id: string
  estado: string
  fecha: string
  observacion: string
  usuarios: { nombre: string }
  bodegas: { nombre: string }
  detalle_pedido: { cantidad_solicitada: number; productos: { nombre: string } }[]
}

const badgeEstado = (estado: string) => {
  if (estado.includes('pendiente')) return 'badge-estado-pendiente'
  if (estado.includes('rechazado')) return 'badge-estado-rechazado'
  if (estado.includes('aprobado')) return 'badge-estado-aprobado'
  if (estado.includes('despachado')) return 'badge-estado-despachado'
  if (estado.includes('entregado')) return 'badge-estado-entregado'
  return 'badge-estado-pendiente'
}

export default function PedidosBodegueroPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const cargarPedidos = async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('*, usuarios(nombre), bodegas(nombre), detalle_pedido(cantidad_solicitada, productos(nombre))')
      .order('fecha', { ascending: false })
    setPedidos(data || [])
    setLoading(false)
  }

  useEffect(() => { cargarPedidos() }, [])

  const cambiarEstado = async (id: string, estado: string) => {
    await supabase.from('pedidos').update({ estado }).eq('id', id)
    cargarPedidos()
  }

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <h1>Gestión de Pedidos</h1>
      </div>

      {loading ? <p>Cargando...</p> : (
        <div className="flex flex-col gap-4">
          {pedidos.map(p => (
            <div key={p.id} className="card-pedido">
              <div className="flex justify-between items-start">
                <div>
                  <p className="vendedor">Vendedor: {p.usuarios?.nombre}</p>
                  <p className="meta">Bodega: {p.bodegas?.nombre}</p>
                  <p className="meta">{new Date(p.fecha).toLocaleDateString()}</p>
                  <div className="mt-2">
                    {p.detalle_pedido?.map((d, i) => (
                      <p key={i} className="detalle-item">• {d.productos?.nombre} x{d.cantidad_solicitada}</p>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <span className={badgeEstado(p.estado)}>{p.estado.replace('_', ' ')}</span>

                  {p.estado.includes('pendiente') && (
                    <div className="flex gap-2">
                      <button onClick={() => cambiarEstado(p.id, 'aprobado_bodega')} className="btn-aprobar-mobulaa">Aprobar</button>
                      <button onClick={() => cambiarEstado(p.id, 'rechazado_bodega')} className="btn-rechazar-mobulaa">Rechazar</button>
                    </div>
                  )}

                  {p.estado.includes('aprobado') && (
                    <button onClick={() => cambiarEstado(p.id, 'despachado')} className="btn-entregado-mobulaa">Marcar despachado</button>
                  )}

                  {p.estado.includes('despachado') && (
                    <button onClick={() => cambiarEstado(p.id, 'entregado')} className="btn-entregado-mobulaa">Marcar entregado</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}