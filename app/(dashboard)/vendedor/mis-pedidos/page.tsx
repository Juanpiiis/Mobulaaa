'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Pedido {
  id: string
  estado: string
  fecha: string
  observacion: string
  bodegas: { nombre: string }
}

interface Producto { id: string; nombre: string }
interface Bodega { id: string; nombre: string }

const badgeEstado = (estado: string) => {
  if (estado.includes('pendiente')) return 'badge-estado-pendiente'
  if (estado.includes('rechazado')) return 'badge-estado-rechazado'
  if (estado.includes('aprobado')) return 'badge-estado-aprobado'
  if (estado.includes('despachado')) return 'badge-estado-despachado'
  if (estado.includes('entregado')) return 'badge-estado-entregado'
  return 'badge-estado-pendiente'
}

export default function MisPedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ bodega_id: '', observacion: '', items: [{ producto_id: '', cantidad: '' }] })
  const supabase = createClient()

  const cargarDatos = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('pedidos').select('*, bodegas(nombre)').eq('vendedor_id', user?.id).order('fecha', { ascending: false })
    const { data: prod } = await supabase.from('productos').select('id, nombre').eq('activo', true)
    const { data: b } = await supabase.from('bodegas').select('id, nombre').eq('activo', true)
    setPedidos(p || [])
    setProductos(prod || [])
    setBodegas(b || [])
    setLoading(false)
  }

  useEffect(() => { cargarDatos() }, [])

  const handleGuardar = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: pedido } = await supabase.from('pedidos').insert({
      vendedor_id: user?.id,
      bodega_id: form.bodega_id,
      observacion: form.observacion,
      estado: 'pendiente',
      fecha: new Date().toISOString()
    }).select().single()

    if (pedido) {
      await supabase.from('detalle_pedido').insert(
        form.items.map(item => ({
          pedido_id: pedido.id,
          producto_id: item.producto_id,
          cantidad_solicitada: parseInt(item.cantidad)
        }))
      )
    }

    setShowModal(false)
    setForm({ bodega_id: '', observacion: '', items: [{ producto_id: '', cantidad: '' }] })
    cargarDatos()
  }

  const agregarItem = () => setForm({...form, items: [...form.items, { producto_id: '', cantidad: '' }]})

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <h1>Mis Pedidos</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary-mobulaa">+ Nuevo Pedido</button>
      </div>

      {loading ? <p>Cargando...</p> : (
        <div className="flex flex-col gap-4">
          {pedidos.map(p => (
            <div key={p.id} className="card-pedido">
              <div className="flex justify-between items-center">
                <div>
                  <p className="vendedor">Bodega: {p.bodegas?.nombre}</p>
                  <p className="meta">{new Date(p.fecha).toLocaleDateString()}</p>
                  {p.observacion && <p className="detalle-item" style={{ marginTop: '4px' }}>{p.observacion}</p>}
                </div>
                <span className={badgeEstado(p.estado)}>{p.estado.replace('_', ' ')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-mobulaa" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h2>Nuevo Pedido</h2>
            <select className="select-mobulaa" value={form.bodega_id} onChange={e => setForm({...form, bodega_id: e.target.value})}>
              <option value="">Seleccionar bodega</option>
              {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
            <input className="input-mobulaa" placeholder="Observación" value={form.observacion} onChange={e => setForm({...form, observacion: e.target.value})} />

            <p style={{ fontWeight: 600, color: '#232323', marginBottom: '8px' }}>Productos:</p>

            {form.items.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select className="select-mobulaa" style={{ marginBottom: 0, flex: 1 }} value={item.producto_id} onChange={e => { const items = [...form.items]; items[i].producto_id = e.target.value; setForm({...form, items}) }}>
                  <option value="">Producto</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                <input className="input-mobulaa" style={{ marginBottom: 0, width: '80px' }} type="number" placeholder="Cant." value={item.cantidad} onChange={e => { const items = [...form.items]; items[i].cantidad = e.target.value; setForm({...form, items}) }} />
              </div>
            ))}

            <button onClick={agregarItem} className="btn-link-mobulaa">+ Agregar producto</button>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowModal(false)} className="btn-cancelar-mobulaa">Cancelar</button>
              <button onClick={handleGuardar} className="btn-primary-mobulaa">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}