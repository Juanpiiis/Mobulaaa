'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const CATEGORIAS = ['AUDIFONO', 'CARGADOR', 'CABLES', 'RELOJ', 'PARLANTES', 'DIADEMAS', 'POWER BANK', 'CELULAR', 'TABLET', 'COMPUTADOR', 'VENTILADOR', 'OTROS']

interface Producto {
  id: string
  nombre: string
  descripcion: string
  categoria: string
  codigo: string
  activo: boolean
}

interface Bodega {
  id: string
  nombre: string
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [form, setForm] = useState({ nombre: '', color: '', categoria: '', codigo: '', bodega_id: '', cantidad: '0' })
  const supabase = createClient()

  const cargarDatos = async () => {
    const { data: p } = await supabase.from('productos').select('*').eq('activo', true)
    const { data: b } = await supabase.from('bodegas').select('*').eq('activo', true)
    setProductos(p || [])
    setBodegas(b || [])
    setLoading(false)
  }

  useEffect(() => { cargarDatos() }, [])

  const handleGuardar = async () => {
    const nombreCompleto = form.color ? `${form.nombre} ${form.color}`.toUpperCase() : form.nombre.toUpperCase()

    if (editando) {
      await supabase.from('productos').update({
        nombre: nombreCompleto,
        categoria: form.categoria,
        codigo: form.codigo,
        descripcion: form.color
      }).eq('id', editando.id)
    } else {
      const { data: producto } = await supabase.from('productos').insert({
        nombre: nombreCompleto,
        categoria: form.categoria,
        codigo: form.codigo,
        descripcion: form.color,
        activo: true
      }).select().single()

      if (producto && form.bodega_id) {
        await supabase.from('inventario').insert({
          producto_id: producto.id,
          bodega_id: form.bodega_id,
          cantidad_disponible: parseInt(form.cantidad),
          cantidad_minima: 0
        })
      }
    }

    setShowModal(false)
    setEditando(null)
    setForm({ nombre: '', color: '', categoria: '', codigo: '', bodega_id: '', cantidad: '0' })
    cargarDatos()
  }

  const handleEditar = (p: Producto) => {
    setEditando(p)
    setForm({ nombre: p.nombre, color: p.descripcion || '', categoria: p.categoria, codigo: p.codigo, bodega_id: '', cantidad: '0' })
    setShowModal(true)
  }

  const handleEliminar = async (id: string) => {
    await supabase.from('productos').update({ activo: false }).eq('id', id)
    cargarDatos()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Productos</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">+ Nuevo Producto</button>
      </div>

      {loading ? <p>Cargando...</p> : (
        <table className="w-full bg-white rounded-lg shadow">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Código</th>
              <th className="p-3 text-left">Nombre</th>
              <th className="p-3 text-left">Categoría</th>
              <th className="p-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.map(p => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{p.codigo}</td>
                <td className="p-3">{p.nombre}</td>
                <td className="p-3">{p.categoria}</td>
                <td className="p-3 flex gap-2">
                  <button onClick={() => handleEditar(p)} className="bg-yellow-400 text-white px-3 py-1 rounded hover:bg-yellow-500">Editar</button>
                  <button onClick={() => handleEliminar(p.id)} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">{editando ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            <input className="w-full border p-2 rounded mb-3" placeholder="Código (ej: S25-NEG)" value={form.codigo} onChange={e => setForm({...form, codigo: e.target.value.toUpperCase()})} />
            <input className="w-full border p-2 rounded mb-3" placeholder="Nombre (ej: S25 PRO)" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
            <input className="w-full border p-2 rounded mb-3" placeholder="Color (ej: NEGRO)" value={form.color} onChange={e => setForm({...form, color: e.target.value})} />
            <select className="w-full border p-2 rounded mb-3" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}>
              <option value="">Seleccionar categoría</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {!editando && (
              <>
                <select className="w-full border p-2 rounded mb-3" value={form.bodega_id} onChange={e => setForm({...form, bodega_id: e.target.value})}>
                  <option value="">Seleccionar tienda/bodega</option>
                  {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
                <input className="w-full border p-2 rounded mb-3" type="number" placeholder="Cantidad inicial" value={form.cantidad} onChange={e => setForm({...form, cantidad: e.target.value})} />
              </>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowModal(false); setEditando(null); setForm({ nombre: '', color: '', categoria: '', codigo: '', bodega_id: '', cantidad: '0' }) }} className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">Cancelar</button>
              <button onClick={handleGuardar} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}