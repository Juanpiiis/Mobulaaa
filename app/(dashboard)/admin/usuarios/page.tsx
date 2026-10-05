'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  UserPlusIcon,
  PencilIcon,
  XMarkIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckIcon,
  UserCircleIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline'

interface Usuario {
  id: string
  nombre: string
  email: string
  rol: string
  bodega_id: string | null
  activo: boolean
  requiere_cambio_password?: boolean
  bodegas_asignadas?: string[]  // ✅ NUEVO: array de IDs
}

interface Bodega {
  id: string
  nombre: string
}

const inputClass =
  'w-full border border-gray-200 px-3 py-2.5 rounded-xl text-base min-h-[44px] focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 transition-colors'

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // ✅ NUEVO: form con bodegas_ids (array)
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'vendedor',
    bodegas_ids: [] as string[],
  })

  const supabase = createClient()

  // ─────────────────────────────────────
  // CARGAR DATOS
  // ─────────────────────────────────────
  const cargarDatos = async () => {
    setLoading(true)

    // 1. Cargar usuarios
    const { data: u } = await supabase
      .from('usuarios')
      .select('*')
      .order('nombre')

    // 2. Cargar bodegas activas
    const { data: b } = await supabase
      .from('bodegas')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')

    // 3. Cargar asignaciones (usuario_bodegas)
    const { data: asignaciones } = await supabase
      .from('usuario_bodegas')
      .select('usuario_id, bodega_id')

    // 4. Agrupar asignaciones por usuario
    const asignacionesMap: Record<string, string[]> = {}
      ; (asignaciones || []).forEach((a: any) => {
        if (!asignacionesMap[a.usuario_id]) asignacionesMap[a.usuario_id] = []
        asignacionesMap[a.usuario_id].push(a.bodega_id)
      })

    // 5. Combinar
    const usuariosConBodegas = (u || []).map((user: any) => ({
      ...user,
      bodegas_asignadas: asignacionesMap[user.id] || [],
    }))

    setUsuarios(usuariosConBodegas)
    setBodegas(b || [])
    setLoading(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  // ─────────────────────────────────────
  // GENERAR CONTRASEÑA ALEATORIA
  // ─────────────────────────────────────
  const generarPassword = () => {
    const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const minusculas = 'abcdefghijkmnopqrstuvwxyz'
    const numeros = '23456789'
    const simbolos = '!@#$%&*'
    const todos = mayusculas + minusculas + numeros + simbolos

    let pass = ''
    pass += mayusculas[Math.floor(Math.random() * mayusculas.length)]
    pass += minusculas[Math.floor(Math.random() * minusculas.length)]
    pass += numeros[Math.floor(Math.random() * numeros.length)]
    pass += simbolos[Math.floor(Math.random() * simbolos.length)]

    for (let i = 4; i < 10; i++) {
      pass += todos[Math.floor(Math.random() * todos.length)]
    }

    pass = pass.split('').sort(() => Math.random() - 0.5).join('')

    setForm((f) => ({ ...f, password: pass }))
    setShowPassword(true)
  }

  // ─────────────────────────────────────
  // ABRIR MODAL NUEVO
  // ─────────────────────────────────────
  const abrirNuevo = () => {
    setEditando(null)
    setForm({ nombre: '', email: '', password: '', rol: 'vendedor', bodegas_ids: [] })
    setError('')
    setSuccess('')
    setShowPassword(false)
    setShowModal(true)
  }

  // ─────────────────────────────────────
  // ABRIR MODAL EDITAR
  // ─────────────────────────────────────
  const abrirEditar = (usuario: Usuario) => {
    setEditando(usuario)
    setForm({
      nombre: usuario.nombre,
      email: usuario.email,
      password: '',
      rol: usuario.rol,
      bodegas_ids: usuario.bodegas_asignadas || [],
    })
    setError('')
    setSuccess('')
    setShowPassword(false)
    setShowModal(true)
  }

  // ─────────────────────────────────────
  // TOGGLE BODEGA
  // ─────────────────────────────────────
  const toggleBodega = (bodegaId: string) => {
    setForm((f) => ({
      ...f,
      bodegas_ids: f.bodegas_ids.includes(bodegaId)
        ? f.bodegas_ids.filter((id) => id !== bodegaId)
        : [...f.bodegas_ids, bodegaId],
    }))
  }

  // ─────────────────────────────────────
  // GUARDAR (crear o editar)
  // ─────────────────────────────────────
  const handleGuardar = async () => {
    setError('')
    setSuccess('')

    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    if (!form.email.trim()) {
      setError('El email es obligatorio')
      return
    }

    if (!editando) {
      if (!form.password.trim()) {
        setError('La contraseña es obligatoria')
        return
      }
      if (form.password.length < 8) {
        setError('La contraseña debe tener al menos 8 caracteres')
        return
      }
    }

    setGuardando(true)

    try {
      // ─── NUEVO USUARIO ───
      if (!editando) {
        const response = await fetch('/api/admin/crear-usuario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email.trim(),
            nombre: form.nombre.trim(),
            password: form.password,
            rol: form.rol,
            bodegas_ids: form.bodegas_ids,  // ✅ array
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Error al crear usuario')
          setGuardando(false)
          return
        }

        setSuccess(`✅ Usuario ${form.nombre} creado correctamente`)
        setTimeout(() => {
          setShowModal(false)
          cargarDatos()
        }, 1500)
      }
      // ─── EDITAR USUARIO ───
      else {
        // 1. Actualizar datos básicos
        const { error: err } = await supabase
          .from('usuarios')
          .update({
            nombre: form.nombre.trim(),
            rol: form.rol,
            bodega_id: form.bodegas_ids[0] || null,  // compatibilidad
          })
          .eq('id', editando.id)

        if (err) {
          setError(err.message)
          setGuardando(false)
          return
        }

        // 2. Borrar asignaciones viejas
        await supabase
          .from('usuario_bodegas')
          .delete()
          .eq('usuario_id', editando.id)

        // 3. Insertar asignaciones nuevas
        if (form.bodegas_ids.length > 0) {
          const { error: errAsig } = await supabase
            .from('usuario_bodegas')
            .insert(
              form.bodegas_ids.map((bodega_id) => ({
                usuario_id: editando.id,
                bodega_id,
              }))
            )

          if (errAsig) {
            setError('Error asignando bodegas: ' + errAsig.message)
            setGuardando(false)
            return
          }
        }

        setSuccess('✅ Usuario actualizado')
        setTimeout(() => {
          setShowModal(false)
          cargarDatos()
        }, 1000)
      }
    } catch (e: any) {
      setError(e.message || 'Error inesperado')
    } finally {
      setGuardando(false)
    }
  }

  // ─────────────────────────────────────
  // DESACTIVAR USUARIO
  // ─────────────────────────────────────
  const handleDesactivar = async (usuario: Usuario) => {
    if (!confirm(`¿Desactivar a ${usuario.nombre}? No podrá iniciar sesión.`)) return

    const { error: err } = await supabase
      .from('usuarios')
      .update({ activo: false })
      .eq('id', usuario.id)

    if (err) {
      alert('Error al desactivar: ' + err.message)
      return
    }

    cargarDatos()
  }

  // ─────────────────────────────────────
  // REACTIVAR
  // ─────────────────────────────────────
  const handleReactivar = async (usuario: Usuario) => {
    const { error: err } = await supabase
      .from('usuarios')
      .update({ activo: true })
      .eq('id', usuario.id)

    if (err) {
      alert('Error: ' + err.message)
      return
    }

    cargarDatos()
  }

  // ─────────────────────────────────────
  // COLORES POR ROL
  // ─────────────────────────────────────
  const rolColor: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700 border-purple-200',
    bodeguero: 'bg-blue-100 text-blue-700 border-blue-200',
    vendedor: 'bg-green-100 text-green-700 border-green-200',
    cartera: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  }

  // ─────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#232323]">Usuarios</h1>
          <p className="text-sm text-[#828282]">Gestiona el equipo de Mobulaa</p>
        </div>
        <button
          onClick={abrirNuevo}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1A0087] text-white px-4 py-2.5 rounded-xl font-medium hover:bg-[#130066] active:scale-[0.98] transition-all min-h-[44px]"
        >
          <UserPlusIcon className="w-5 h-5" />
          Nuevo Usuario
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : usuarios.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <UserCircleIcon className="w-16 h-16 text-gray-200 mx-auto mb-3" />
          <p className="text-[#828282]">No hay usuarios registrados</p>
          <button
            onClick={abrirNuevo}
            className="mt-4 text-sm font-medium text-[#1A0087] hover:underline"
          >
            Crear el primero
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Rol</th>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Bodegas</th>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="p-3 text-right text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="p-3">
                      <p className="font-medium text-[#232323]">{u.nombre}</p>
                      {u.requiere_cambio_password && (
                        <p className="text-xs text-yellow-600 mt-0.5 flex items-center gap-1">
                          <KeyIcon className="w-3 h-3" />
                          Debe cambiar contraseña
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-sm text-[#828282]">{u.email}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold border ${rolColor[u.rol] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="p-3">
                      {u.rol === 'admin' ? (
                        <span className="text-xs text-purple-600 font-medium">Todas</span>
                      ) : u.bodegas_asignadas && u.bodegas_asignadas.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.bodegas_asignadas.slice(0, 2).map((bid) => {
                            const bod = bodegas.find((b) => b.id === bid)
                            return bod ? (
                              <span key={bid} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                                {bod.nombre}
                              </span>
                            ) : null
                          })}
                          {u.bodegas_asignadas.length > 2 && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                              +{u.bodegas_asignadas.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Sin bodegas</span>
                      )}
                    </td>
                    <td className="p-3">
                      {u.activo ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                          <CheckIcon className="w-4 h-4" /> Activo
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium">Inactivo</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => abrirEditar(u)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-[#1A0087]/10 hover:text-[#1A0087] transition-colors"
                          title="Editar"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        {u.activo ? (
                          <button
                            onClick={() => handleDesactivar(u)}
                            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
                            title="Desactivar"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivar(u)}
                            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-green-50 hover:text-green-500 transition-colors"
                            title="Reactivar"
                          >
                            <CheckIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────── */}
      {/* MODAL CREAR / EDITAR */}
      {/* ───────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-[#232323]">
                  {editando ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h2>
                <p className="text-xs text-[#828282]">
                  {editando ? 'Modifica los datos del usuario' : 'Crea una cuenta nueva'}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-11 h-11 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                aria-label="Cerrar"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#232323] mb-1.5">
                  Nombre completo *
                </label>
                <input
                  className={inputClass}
                  placeholder="Ej: Juan Pérez"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#232323] mb-1.5">
                  Email *
                </label>
                <input
                  className={inputClass}
                  type="email"
                  placeholder="usuario@mobulaa.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={!!editando}
                  inputMode="email"
                />
                {editando && (
                  <p className="text-xs text-gray-400 mt-1">
                    El email no se puede cambiar
                  </p>
                )}
              </div>

              {/* Contraseña - solo al crear */}
              {!editando && (
                <div>
                  <label className="block text-sm font-medium text-[#232323] mb-1.5">
                    Contraseña temporal *
                  </label>
                  <div className="relative">
                    <input
                      className={`${inputClass} pr-11`}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 8 caracteres"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 active:bg-gray-100 transition-colors"
                    >
                      {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={generarPassword}
                    className="mt-2 text-xs text-[#1A0087] font-medium hover:underline flex items-center gap-1"
                  >
                    <KeyIcon className="w-3 h-3" />
                    Generar contraseña segura
                  </button>
                  <p className="text-xs text-gray-400 mt-1">
                    El usuario deberá cambiarla al primer login
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#232323] mb-1.5">
                  Rol *
                </label>
                <select
                  className={inputClass}
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value })}
                >
                  <option value="vendedor">Vendedor</option>
                  <option value="bodeguero">Bodeguero</option>
                  <option value="cartera">Cartera</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              {/* ✅ CHECKBOXES DE BODEGAS */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-[#232323]">
                    Bodegas asignadas
                  </label>
                  <span className="text-xs text-[#828282]">
                    {form.bodegas_ids.length} seleccionada{form.bodegas_ids.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {form.rol === 'admin' && (
                  <p className="text-xs text-purple-600 bg-purple-50 border border-purple-200 p-2 rounded-lg mb-2">
                    Los admins tienen acceso a todas las bodegas automáticamente.
                  </p>
                )}

                <div className="border border-gray-200 rounded-xl p-2 max-h-56 overflow-y-auto space-y-1">
                  {bodegas.length === 0 ? (
                    <div className="flex flex-col items-center py-6 text-center">
                      <BuildingStorefrontIcon className="w-8 h-8 text-gray-300 mb-2" />
                      <p className="text-xs text-gray-400">No hay bodegas disponibles</p>
                      <p className="text-xs text-gray-400">Crea una primero</p>
                    </div>
                  ) : (
                    bodegas.map((b) => {
                      const checked = form.bodegas_ids.includes(b.id)
                      return (
                        <label
                          key={b.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors min-h-[44px] ${checked ? 'bg-[#1A0087]/5' : 'hover:bg-gray-50 active:bg-gray-100'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleBodega(b.id)}
                            className="w-5 h-5 text-[#1A0087] border-gray-300 rounded focus:ring-[#1A0087] focus:ring-offset-0"
                          />
                          <span className="text-sm text-[#232323] flex-1">{b.nombre}</span>
                          {checked && (
                            <CheckIcon className="w-4 h-4 text-[#1A0087]" />
                          )}
                        </label>
                      )
                    })
                  )}
                </div>

                {form.bodegas_ids.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, bodegas_ids: [] })}
                    className="mt-2 text-xs text-gray-500 hover:text-red-500 transition-colors"
                  >
                    Limpiar selección
                  </button>
                )}
              </div>

              {/* Mensajes */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2.5 rounded-xl text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2.5 rounded-xl text-sm font-medium">
                  {success}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-gray-100 p-4 flex gap-2 bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                disabled={guardando}
                className="flex-1 min-h-[44px] px-4 py-2.5 border border-gray-300 rounded-xl text-[#232323] bg-white hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50 font-medium transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardar}
                disabled={guardando}
                className="flex-1 min-h-[44px] px-4 py-2.5 bg-[#1A0087] text-white rounded-xl hover:bg-[#130066] active:scale-[0.98] disabled:opacity-50 font-medium transition-all"
              >
                {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}