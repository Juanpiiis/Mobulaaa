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
  direccion: string | null
  tipo: 'principal' | 'secundaria'
  activo: boolean | null
  ciudad: string | null
  pais: string | null
}

const inputClass =
  'w-full border border-gray-200 px-3 py-2.5 rounded-xl text-base min-h-[44px] focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 transition-colors'

export default function BodegasPage() {
  const { recargarBodegas } = useTienda()

  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Bodega | null>(null)
  const [bodegaEliminar, setBodegaEliminar] = useState<Bodega | null>(null)
  const [form, setForm] = useState({
    nombre: '',
    direccion: '',
    tipo: 'secundaria' as 'principal' | 'secundaria',
    ciudad: '',
    pais: 'Colombia',
  })
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
    setForm({ nombre: '', direccion: '', tipo: 'secundaria', ciudad: '', pais: 'Colombia' })
    setNombreError('')
    setDireccionError('')
    setShowModal(true)
  }

  const handleEditar = (bodega: Bodega) => {
    setEditando(bodega)
    setForm({
      nombre: bodega.nombre || '',
      direccion: bodega.direccion || '',
      tipo: bodega.tipo || 'secundaria',
      ciudad: bodega.ciudad || '',
      pais: bodega.pais || 'Colombia',
    })
    setNombreError('')
    setDireccionError('')
    setShowModal(true)
  }

  const cerrarModal = () => {
    setShowModal(false)
    setEditando(null)
    setForm({ nombre: '', direccion: '', tipo: 'secundaria', ciudad: '', pais: 'Colombia' })
    setNombreError('')
    setDireccionError('')
  }

  const handleGuardar = async () => {
    if ((form.nombre || '').trim().length < 3) {
      setNombreError('El nombre debe tener al menos 3 caracteres')
      return
    }
    if ((form.direccion || '').trim().length < 5) {
      setDireccionError('La dirección debe tener al menos 5 caracteres')
      return
    }

    setSaving(true)
    try {
      const datos = {
        nombre: (form.nombre || '').trim(),
        direccion: (form.direccion || '').trim(),
        tipo: form.tipo,
        ciudad: (form.ciudad || '').trim() || null,
        pais: (form.pais || '').trim() || 'Colombia',
      }

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
      await cargarBodegas()
      await recargarBodegas() // ✅ Actualiza el contexto global
    } catch (e: any) {
      showToast('error', e?.message || 'No se pudo guardar la bodega')
    } finally {
      setSaving(false)
    }
  }

  const confirmarEliminar = async () => {
    if (!bodegaEliminar) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('bodegas')
        .update({ activo: false })
        .eq('id', bodegaEliminar.id)
      if (error) throw error

      showToast('success', 'Bodega eliminada')
      await cargarBodegas()
      await recargarBodegas() // ✅ Actualiza el contexto global
    } catch {
      showToast('error', 'No se pudo eliminar la bodega')
    } finally {
      setSaving(false)
      setBodegaEliminar(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 relative">
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] p-4 rounded-xl shadow-lg flex items-center gap-3 text-sm font-medium max-w-[90vw] ${toast.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
          {toast.type === 'success' ? <CheckCircleIcon className="w-5 h-5 shrink-0" /> : <XCircleIcon className="w-5 h-5 shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#232323]">Bodegas</h1>
          <p className="text-sm text-[#828282]">{bodegas.length} bodegas registradas</p>
        </div>
        <button
          onClick={handleNueva}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1A0087] text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-[#15006b] active:scale-[0.98] transition-all min-h-[44px]"
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Dirección</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ciudad</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {bodegas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
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
                      <td className="px-4 py-3 font-medium text-[#232323]">{b.nombre}</td>
                      <td className="px-4 py-3 text-[#828282] text-sm">{b.direccion || '—'}</td>
                      <td className="px-4 py-3 text-[#828282] text-sm">{b.ciudad || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold ${b.tipo === 'principal' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                          {b.tipo === 'principal' ? 'Principal' : 'Secundaria'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEditar(b)}
                            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                            title="Editar"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setBodegaEliminar(b)}
                            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-600 transition-colors"
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
        </div>
      )}

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
            <div className="shrink-0 flex justify-between items-center p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-[#232323]">
                {editando ? 'Editar Bodega' : 'Nueva Bodega'}
              </h2>
              <button
                onClick={cerrarModal}
                className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 active:bg-gray-200 transition-colors"
                aria-label="Cerrar"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#232323] mb-1.5">Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => { setForm({ ...form, nombre: e.target.value }); setNombreError('') }}
                  className={`${inputClass} ${nombreError ? 'border-red-300' : ''}`}
                  placeholder="Ej: Bodega Central Bogotá"
                  autoFocus
                />
                {nombreError && <p className="text-xs text-red-500 mt-1">{nombreError}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#232323] mb-1.5">Dirección *</label>
                <input
                  type="text"
                  value={form.direccion}
                  onChange={e => { setForm({ ...form, direccion: e.target.value }); setDireccionError('') }}
                  className={`${inputClass} ${direccionError ? 'border-red-300' : ''}`}
                  placeholder="Ej: Cra 15 #82-34"
                />
                {direccionError && <p className="text-xs text-red-500 mt-1">{direccionError}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#232323] mb-1.5">Ciudad</label>
                  <input
                    type="text"
                    value={form.ciudad}
                    onChange={e => setForm({ ...form, ciudad: e.target.value })}
                    className={inputClass}
                    placeholder="Ej: Bogotá"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#232323] mb-1.5">País</label>
                  <input
                    type="text"
                    value={form.pais}
                    onChange={e => setForm({ ...form, pais: e.target.value })}
                    className={inputClass}
                    placeholder="Ej: Colombia"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#232323] mb-1.5">Tipo *</label>
                <select
                  value={form.tipo}
                  onChange={e => setForm({ ...form, tipo: e.target.value as 'principal' | 'secundaria' })}
                  className={inputClass}
                >
                  <option value="secundaria">Secundaria</option>
                  <option value="principal">Principal</option>
                </select>
              </div>
            </div>

            <div className="shrink-0 flex gap-2 p-5 border-t border-gray-100 bg-gray-50">
              <button
                onClick={cerrarModal}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-gray-600 font-medium bg-white border border-gray-300 hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-50"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardar}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1A0087] text-white font-semibold hover:bg-[#15006b] active:scale-[0.98] transition-all disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-[#232323] mb-2">Eliminar bodega</h3>
            <p className="text-sm text-[#828282] mb-6">
              ¿Estás seguro de eliminar <strong>"{bodegaEliminar.nombre}"</strong>?
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setBodegaEliminar(null)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-gray-600 font-medium border border-gray-300 hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-50"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEliminar}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50"
                disabled={saving}
              >
                {saving ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}