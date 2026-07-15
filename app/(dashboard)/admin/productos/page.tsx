'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Producto {
  id: string
  nombre: string
  descripcion: string
  categoria: string
  codigo: string
  activo: boolean
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [form, setForm] = useState({ nombre: '', descripcion: '', categoria: '', codigo: '' })
  const supabase = createClient()

  const cargarProductos = async () => {
    const { data } = await supabase.from('productos').select('*').eq('activo', true)
    setProductos(data || [])
    setLoading(false)
  }

  useEffect(() => { cargarProductos() }, [])

  const handleGuardar = async () => {
    if (editando) {
      await supabase.from('productos').update(form).eq('id', editando.id)
    } else {
      await supabase.from('productos').insert({ ...form, activo: true })
    }
    setShowModal(false)
    setEditando(null)
    setForm({ nombre: '', descripcion: '', categoria: '', codigo: '' })
    cargarProductos()
  }

  const handleEditar = (producto: Producto) => {
    setEditando(producto)
    setForm({ nombre: producto.nombre, descripcion: producto.descripcion, categoria: producto.categoria, codigo: producto.codigo })
    setShowModal(true)
  }

  const handleEliminar = async (id: string) => {
    await supabase.from('productos').update({ activo: false }).eq('id', id)
    cargarProductos()
  }

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <h1>Productos</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary-mobulaa">
          + Nuevo Producto
        </button>
      </div>

      {loading ? <p>Cargando...</p> : (
        <table className="tabla-mobulaa">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Descripción</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.map(p => (
              <tr key={p.id}>
                <td>{p.codigo}</td>
                <td>{p.nombre}</td>
                <td><span className="badge-categoria">{p.categoria}</span></td>
                <td>{p.descripcion}</td>
                <td className="flex gap-2">
                  <button onClick={() => handleEditar(p)} className="btn-edit-mobulaa">Editar</button>
                  <button onClick={() => handleEliminar(p.id)} className="btn-delete-mobulaa">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-mobulaa">
            <h2>{editando ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            <input className="input-mobulaa" placeholder="Código" value={form.codigo} onChange={e => setForm({...form, codigo: e.target.value})} />
            <input className="input-mobulaa" placeholder="Nombre" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
            <input className="input-mobulaa" placeholder="Categoría" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} />
            <input className="input-mobulaa" placeholder="Descripción" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowModal(false); setEditando(null); setForm({ nombre: '', descripcion: '', categoria: '', codigo: '' }) }} className="btn-cancelar-mobulaa">Cancelar</button>
              <button onClick={handleGuardar} className="btn-primary-mobulaa">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}