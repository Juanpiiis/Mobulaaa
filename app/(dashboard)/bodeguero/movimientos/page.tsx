'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Producto { id: string; nombre: string; codigo: string }
interface Bodega { id: string; nombre: string }
interface Movimiento {
  id: string
  cantidad: number
  tipo: string
  fecha: string
  observacion: string
  productos: { nombre: string }
  bodegas_bodega_origen_id_fkey: { nombre: string }
}

const badgeMov = (tipo: string) => {
  if (tipo === 'entrada') return 'badge-mov-entrada'
  if (tipo === 'salida') return 'badge-mov-salida'
  return 'badge-mov-traslado'
}

export default function Movimientos() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ producto_id: '', bodega_origen_id: '', bodega_destino_id: '', cantidad: '', tipo: 'entrada', observacion: '' })
  const supabase = createClient()

  const cargarDatos = async () => {
    const { data: m } = await supabase.from('movimientos').select('*, productos(nombre), bodegas_bodega_origen_id_fkey:bodegas!bodega_origen_id(nombre)').order('fecha', { ascending: false })
    const { data: p } = await supabase.from('productos').select('id, nombre, codigo').eq('activo', true)
    const { data: b } = await supabase.from('bodegas').select('id, nombre').eq('activo', true)
    setMovimientos(m || [])
    setProductos(p || [])
    setBodegas(b || [])
    setLoading(false)
  }

  useEffect(() => { cargarDatos() }, [])

  const handleGuardar = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('movimientos').insert({
      ...form,
      cantidad: parseInt(form.cantidad),
      usuario_id: user?.id,
      fecha: new Date().toISOString()
    })
    setShowModal(false)
    setForm({ producto_id: '', bodega_origen_id: '', bodega_destino_id: '', cantidad: '', tipo: 'entrada', observacion: '' })
    cargarDatos()
  }

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <h1>Movimientos</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary-mobulaa">+ Nuevo Movimiento</button>
      </div>

      {loading ? <p>Cargando...</p> : (
        <table className="tabla-mobulaa">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Tipo</th>
              <th>Cantidad</th>
              <th>Bodega Origen</th>
              <th>Fecha</th>
              <th>Observación</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.map(m => (
              <tr key={m.id}>
                <td>{m.productos?.nombre}</td>
                <td>
                  <span className={badgeMov(m.tipo)}>{m.tipo}</span>
                </td>
                <td>{m.cantidad}</td>
                <td>{m.bodegas_bodega_origen_id_fkey?.nombre || '-'}</td>
                <td>{new Date(m.fecha).toLocaleDateString()}</td>
                <td>{m.observacion || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-mobulaa">
            <h2>Nuevo Movimiento</h2>
            <select className="select-mobulaa" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="traslado">Traslado</option>
            </select>
            <select className="select-mobulaa" value={form.producto_id} onChange={e => setForm({...form, producto_id: e.target.value})}>
              <option value="">Seleccionar producto</option>
              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <select className="select-mobulaa" value={form.bodega_origen_id} onChange={e => setForm({...form, bodega_origen_id: e.target.value})}>
              <option value="">Bodega origen</option>
              {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
            {form.tipo === 'traslado' && (
              <select className="select-mobulaa" value={form.bodega_destino_id} onChange={e => setForm({...form, bodega_destino_id: e.target.value})}>
                <option value="">Bodega destino</option>
                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            )}
            <input className="input-mobulaa" type="number" placeholder="Cantidad" value={form.cantidad} onChange={e => setForm({...form, cantidad: e.target.value})} />
            <input className="input-mobulaa" placeholder="Observación" value={form.observacion} onChange={e => setForm({...form, observacion: e.target.value})} />
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