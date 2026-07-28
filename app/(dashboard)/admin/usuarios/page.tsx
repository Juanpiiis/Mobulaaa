'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Usuario {
  id: string
  nombre: string
  email: string
  rol: string
  bodega_id: string
  activo: boolean
}

interface Bodega {
  id: string
  nombre: string
}

const badgeRol = (rol: string) => {
  if (rol === 'admin') return 'badge-rol-admin'
  if (rol === 'bodeguero') return 'badge-rol-bodeguero'
  return 'badge-rol-vendedor'
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'vendedor', bodega_id: '' })
  const supabase = createClient()

  const cargarDatos = async () => {
    const { data: u } = await supabase.from('usuarios').select('*').eq('activo', true)
    const { data: b } = await supabase.from('bodegas').select('*').eq('activo', true)
    setUsuarios(u || [])
    setBodegas(b || [])
    setLoading(false)
  }

  useEffect(() => { cargarDatos() }, [])

  const handleGuardar = async () => {
    if (editando) {
      await supabase.from('usuarios').update(form).eq('id', editando.id)
    }
    setShowModal(false)
    setEditando(null)
    setForm({ nombre: '', email: '', rol: 'vendedor', bodega_id: '' })
    cargarDatos()
  }

  const handleEditar = (usuario: Usuario) => {
    setEditando(usuario)
    setForm({ nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, bodega_id: usuario.bodega_id || '' })
    setShowModal(true)
  }

  const handleDesactivar = async (id: string) => {
    await supabase.from('usuarios').update({ activo: false }).eq('id', id)
    cargarDatos()
  }

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <h1>Usuarios</h1>
      </div>

      {loading ? <p>Cargando...</p> : (
        <table className="tabla-mobulaa">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Bodega</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id}>
                <td>{u.nombre}</td>
                <td>{u.email}</td>
                <td>
                  <span className={badgeRol(u.rol)}>{u.rol}</span>
                </td>
                <td>{bodegas.find(b => b.id === u.bodega_id)?.nombre || '-'}</td>
                <td className="flex gap-2">
                  <button onClick={() => handleEditar(u)} className="btn-edit-mobulaa">Editar</button>
                  <button onClick={() => handleDesactivar(u.id)} className="btn-desactivar-mobulaa">Desactivar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-mobulaa">
            <h2>Editar Usuario</h2>
            <input className="input-mobulaa" placeholder="Nombre" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
            <select className="select-mobulaa" value={form.rol} onChange={e => setForm({...form, rol: e.target.value})}>
              <option value="admin">Admin</option>
              <option value="bodeguero">Bodeguero</option>
              <option value="vendedor">Vendedor</option>
            </select>
            <select className="select-mobulaa" value={form.bodega_id} onChange={e => setForm({...form, bodega_id: e.target.value})}>
              <option value="">Sin bodega</option>
              {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowModal(false); setEditando(null) }} className="btn-cancelar-mobulaa">Cancelar</button>
              <button onClick={handleGuardar} className="btn-primary-mobulaa">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}