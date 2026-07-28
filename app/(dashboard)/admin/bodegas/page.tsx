'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Bodega {
  id: string
  nombre: string
  direccion: string
  tipo: 'principal' | 'secundaria'
  activo: boolean
}

export default function BodegasPage() {
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Bodega | null>(null)
  const [form, setForm] = useState({ nombre: '', direccion: '', tipo: 'secundaria' })
  const supabase = createClient()

  const cargarBodegas = async () => {
    const { data } = await supabase.from('bodegas').select('*').eq('activo', true)
    setBodegas(data || [])
    setLoading(false)
  }

  useEffect(() => { cargarBodegas() }, [])

  const handleGuardar = async () => {
    if (editando) {
      await supabase.from('bodegas').update(form).eq('id', editando.id)
    } else {
      await supabase.from('bodegas').insert({ ...form, activo: true })
    }
    setShowModal(false)
    setEditando(null)
    setForm({ nombre: '', direccion: '', tipo: 'secundaria' })
    cargarBodegas()
  }

  const handleEditar = (bodega: Bodega) => {
    setEditando(bodega)
    setForm({ nombre: bodega.nombre, direccion: bodega.direccion, tipo: bodega.tipo })
    setShowModal(true)
  }

  const handleEliminar = async (id: string) => {
    await supabase.from('bodegas').update({ activo: false }).eq('id', id)
    cargarBodegas()
  }

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <h1>Bodegas</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary-mobulaa">
          + Nueva Bodega
        </button>
      </div>

      {loading ? <p>Cargando...</p> : (
        <table className="tabla-mobulaa">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Dirección</th>
              <th>Tipo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {bodegas.map(b => (
              <tr key={b.id}>
                <td>{b.nombre}</td>
                <td>{b.direccion}</td>
                <td>
                  <span className={b.tipo === 'principal' ? 'badge-tipo-principal' : 'badge-tipo-secundaria'}>
                    {b.tipo}
                  </span>
                </td>
                <td className="flex gap-2">
                  <button onClick={() => handleEditar(b)} className="btn-edit-mobulaa">Editar</button>
                  <button onClick={() => handleEliminar(b.id)} className="btn-delete-mobulaa">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-mobulaa">
            <h2>{editando ? 'Editar Bodega' : 'Nueva Bodega'}</h2>
            <input className="input-mobulaa" placeholder="Nombre" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
            <input className="input-mobulaa" placeholder="Dirección" value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})} />
            <select className="select-mobulaa" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
              <option value="principal">Principal</option>
              <option value="secundaria">Secundaria</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowModal(false); setEditando(null); setForm({ nombre: '', direccion: '', tipo: 'secundaria' }) }} className="btn-cancelar-mobulaa">Cancelar</button>
              <button onClick={handleGuardar} className="btn-primary-mobulaa">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}