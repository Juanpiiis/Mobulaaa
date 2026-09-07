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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Usuarios</h1>
      </div>

      {loading ? <p>Cargando...</p> : (
        <table className="w-full bg-white rounded-lg shadow">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Nombre</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Rol</th>
              <th className="p-3 text-left">Bodega</th>
              <th className="p-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} className="border-t">
                <td className="p-3">{u.nombre}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3 capitalize">{u.rol}</td>
                <td className="p-3">{bodegas.find(b => b.id === u.bodega_id)?.nombre || '-'}</td>
                <td className="p-3 flex gap-2">
                  <button onClick={() => handleEditar(u)} className="bg-yellow-400 text-white px-3 py-1 rounded hover:bg-yellow-500">Editar</button>
                  <button onClick={() => handleDesactivar(u.id)} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">Desactivar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Editar Usuario</h2>
            <input className="w-full border p-2 rounded mb-3" placeholder="Nombre" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
            <select className="w-full border p-2 rounded mb-3" value={form.rol} onChange={e => setForm({...form, rol: e.target.value})}>
              <option value="admin">Admin</option>
              <option value="bodeguero">Bodeguero</option>
              <option value="vendedor">Vendedor</option>
            </select>
            <select className="w-full border p-2 rounded mb-3" value={form.bodega_id} onChange={e => setForm({...form, bodega_id: e.target.value})}>
              <option value="">Sin bodega</option>
              {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowModal(false); setEditando(null) }} className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">Cancelar</button>
              <button onClick={handleGuardar} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}