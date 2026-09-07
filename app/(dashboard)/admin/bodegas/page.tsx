'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import {
  PlusIcon, PencilIcon, TrashIcon, XMarkIcon, BuildingStorefrontIcon,
  CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

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
  const [bodegaEliminar, setBodegaEliminar] = useState<Bodega | null>(null)
  const [form, setForm] = useState({ nombre: '', direccion: '', tipo: 'secundaria' as 'principal' | 'secundaria' })
  const [nombreError, setNombreError] = useState('')
  const [direccionError, setDireccionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  const supabase = createClient()

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  const cargarBodegas = async () => {
    try {
      const { data, error } = await supabase
        .from('bodegas')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true })

      if (error) throw error
      setBodegas(data || [])
    } catch {
      showToast('error', 'No se pudieron obtener las bodegas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarBodegas() }, [])

  const handleNueva = () => {
    setEditando(null)
    setForm({ nombre: '', direccion: '', tipo: 'secundaria' })
    setNombreError('')
    setDireccionError('')
    setShowModal(true)
  }

  const handleEditar = (bodega: Bodega) => {
    setEditando(bodega)
    setForm({ nombre: bodega.nombre, direccion: bodega.direccion, tipo: bodega.tipo })
    setNombreError('')
    setDireccionError('')
    setShowModal(true)
  }

  const cerrarModal = () => {
    setShowModal(false)
    setEditando(null)
    setForm({ nombre: '', direccion: '', tipo: 'secundaria' })
    setNombreError('')
    setDireccionError('')
  }

  const handleGuardar = async () => {
    // Validaciones
    if (form.nombre.trim().length < 3) {
      setNombreError('El nombre debe tener al menos 3 caracteres')
      return
    }
    if (form.direccion.trim().length < 5) {
      setDireccionError('La dirección debe tener al menos 5 caracteres')
      return
    }

    setSaving(true)
    try {
      const datos = { ...form, nombre: form.nombre.trim(), direccion: form.direccion.trim() }

      if (editando) {
        const { error } = await supabase.from('bodegas').update(datos).eq('id', editando.id)
        if (error) throw error
        showToast('success', 'Bodega actualizada correctamente')
      } else {
        const { error } = await supabase.from('bodegas').insert({ ...datos, activo: true })
        if (error) throw error
        showToast('success', 'Bodega creada correctamente')
      }

      cerrarModal()
      cargarBodegas()
    } catch {
      showToast('error', 'No se pudo guardar la bodega')
    } finally {
      setSaving(false)
    }
  }

  const confirmarEliminar = async () => {
    if (!bodegaEliminar) return
    setSaving(true)
    try {
      const { error } = await supabase.from('bodegas').update({ activo: false }).eq('id', bodegaEliminar.id)
      if (error) throw error
      showToast('success', 'Bodega eliminada')
      cargarBodegas()
    } catch {
      showToast('error', 'No se pudo eliminar la bodega')
    } finally {
      setSaving(false)
      setBodegaEliminar(null)
    }
  }

  return (
    <div className="p-6 relative">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 p-4 rounded-xl shadow-lg flex items-center gap-3 text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {toast.type === 'success' ? <CheckCircleIcon className="w-5 h-5" /> : <XCircleIcon className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Bodegas</h1>
          <p className="text-sm text-gray-500">{bodegas.length} bodegas registradas</p>
        </div>
        <button
          onClick={handleNueva}
          className="flex items-center gap-2 bg-[#1A0087] text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-[#15006b] transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          Nueva Bodega
        </button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Dirección</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {bodegas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <BuildingStorefrontIcon className="w-12 h-12 text-gray-300 mb-3" />
                      <p className="text-gray-500 font-medium">No hay bodegas registradas</p>
                      <p className="text-gray-400 text-sm">Crea una nueva bodega para comenzar</p>
                    </div>
                  </td>
                </tr>
              ) : (
                bodegas.map(b => (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-800">{b.nombre}</td>
                    <td className="px-6 py-4 text-gray-600">{b.direccion}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        b.tipo === 'principal' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {b.tipo === 'principal' ? 'Principal' : 'Secundaria'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEditar(b)}
                          className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                          title="Editar"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setBodegaEliminar(b)}
                          className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                          title="Eliminar"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">
                {editando ? 'Editar Bodega' : 'Nueva Bodega'}
              </h2>
              <button onClick={cerrarModal} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => { setForm({ ...form, nombre: e.target.value }); setNombreError('') }}
                  className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-[#1A0087]/20 ${
                    nombreError ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Ej: Bodega Central Bogotá"
                />
                {nombreError && <p className="text-xs text-red-500 mt-1">{nombreError}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección *</label>
                <input
                  type="text"
                  value={form.direccion}
                  onChange={e => { setForm({ ...form, direccion: e.target.value }); setDireccionError('') }}
                  className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-[#1A0087]/20 ${
                    direccionError ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Ej: Cra 15 #82-34"
                />
                {direccionError && <p className="text-xs text-red-500 mt-1">{direccionError}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select
                  value={form.tipo}
                  onChange={e => setForm({ ...form, tipo: e.target.value as 'principal' | 'secundaria' })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-[#1A0087]/20"
                >
                  <option value="secundaria">Secundaria</option>
                  <option value="principal">Principal</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button
                onClick={cerrarModal}
                className="px-4 py-2.5 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition-colors"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardar}
                className="px-4 py-2.5 rounded-xl bg-[#1A0087] text-white font-semibold hover:bg-[#15006b] transition-colors disabled:opacity-50"
                disabled={saving}
              >
                {saving ? 'Guardando...' : editando ? 'Guardar Cambios' : 'Crear Bodega'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminar */}
      {bodegaEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Eliminar bodega</h3>
            <p className="text-sm text-gray-500 mb-6">
              ¿Estás seguro de eliminar <strong>"{bodegaEliminar.nombre}"</strong>?
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setBodegaEliminar(null)}
                className="px-4 py-2.5 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition-colors"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEliminar}
                className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={saving}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}