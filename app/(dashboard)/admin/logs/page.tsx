'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    ArrowPathIcon,
    UserIcon,
    CubeIcon,
    ClipboardDocumentListIcon,
    BuildingStorefrontIcon,
    FunnelIcon,
    LockClosedIcon,
    XMarkIcon
} from '@heroicons/react/24/outline'

interface Log {
    id: string
    usuario_email: string | null
    accion: string
    tabla: string
    registro_id: string
    detalles: any
    created_at: string
}

export default function LogsPage() {
    const [logs, setLogs] = useState<Log[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [filtroTabla, setFiltroTabla] = useState('todas')

    // Estados para el modal de seguridad
    const [logAInstaurar, setLogAInstaurar] = useState<Log | null>(null)
    const [password, setPassword] = useState('')
    const [authError, setAuthError] = useState('')
    const [authLoading, setAuthLoading] = useState(false)

    const supabase = createClient()

    const cargarLogs = async () => {
        setLoading(true)
        setError('')

        let query = supabase
            .from('logs_sistema')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100)

        if (filtroTabla !== 'todas') {
            query = query.eq('tabla', filtroTabla)
        }

        const { data, error } = await query

        if (error) {
            setError('Error al cargar los logs: ' + error.message)
        } else {
            setLogs(data || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        cargarLogs()
    }, [filtroTabla])

    // ✅ Lógica para restaurar producto pidiendo contraseña
    const handleRestaurarProducto = async () => {
        if (!logAInstaurar || !logAInstaurar.detalles?.anterior) return
        setAuthError('')
        setAuthLoading(true)

        try {
            // 1. Obtener el correo del admin actual
            const { data: { session } } = await supabase.auth.getSession()
            if (!session || !session.user.email) {
                setAuthError('No hay sesión activa.')
                setAuthLoading(false)
                return
            }

            // 2. Re-autenticar con Supabase para validar la contraseña
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: session.user.email,
                password: password
            })

            if (signInError) {
                setAuthError('Contraseña incorrecta. Intenta de nuevo.')
                setAuthLoading(false)
                return
            }

            // 3. Si la contraseña es correcta, restauramos el producto
            const productoViejo = { ...logAInstaurar.detalles.anterior }

            // Limpiamos campos para que se genere un nuevo ID o se eviten conflictos
            delete productoViejo.id
            delete productoViejo.created_at
            delete productoViejo.updated_at

            // Lo insertamos forzando que esté activo y no eliminado
            productoViejo.eliminado = false
            productoViejo.activo = true

            const { error: insertError } = await supabase
                .from('productos')
                .insert([productoViejo])

            if (insertError) {
                setAuthError('Error al restaurar: ' + insertError.message)
            } else {
                // Éxito: cerramos modal y recargamos
                setLogAInstaurar(null)
                setPassword('')
                cargarLogs()
                alert('✅ Producto restaurado exitosamente. Revisa la lista de productos activos.')
            }

        } catch (err: any) {
            setAuthError('Error inesperado: ' + err.message)
        } finally {
            setAuthLoading(false)
        }
    }

    // ✅ Renderizado de detalles legibles
    const renderDetalles = (log: Log) => {
        if (!log.detalles) return 'Sin detalles'

        const { anterior, nuevo } = log.detalles

        // Identificar a quién se le hizo el cambio
        let nombreRegistro = ''
        const dataParaNombre = nuevo || anterior
        if (dataParaNombre) {
            if (dataParaNombre.nombre) nombreRegistro = `"${dataParaNombre.nombre}"`
            else if (dataParaNombre.email) nombreRegistro = `"${dataParaNombre.email}"`
            else if (dataParaNombre.referencia_excel) nombreRegistro = `"${dataParaNombre.referencia_excel}"`
            else if (dataParaNombre.id) nombreRegistro = `(ID: ${dataParaNombre.id.split('-')[0]}...)`
        }

        if (log.accion === 'INSERT') {
            return `Se creó el registro ${nombreRegistro} en ${log.tabla}.`
        }

        if (log.accion === 'DELETE') {
            return `Se eliminó permanentemente el registro ${nombreRegistro} de ${log.tabla}.`
        }

        if (log.accion === 'UPDATE' && anterior && nuevo) {
            const cambios = []

            for (const key in nuevo) {
                if (key === 'updated_at' || key === 'created_at') continue;

                const valAnt = anterior[key]
                const valNue = nuevo[key]

                if (JSON.stringify(valAnt) !== JSON.stringify(valNue)) {
                    let mensajeCambio = ''

                    if (key === 'activo') {
                        mensajeCambio = valNue === false ? 'fue desactivado' : 'fue reactivado'
                    }
                    else if (key === 'eliminado') {
                        mensajeCambio = valNue === true ? 'fue movido a la papelera' : 'fue restaurado de la papelera'
                    }
                    else if (key === 'rol') {
                        mensajeCambio = `cambió su rol de "${valAnt}" a "${valNue}"`
                    }
                    else if (key === 'precio') {
                        mensajeCambio = `cambió el precio de $${valAnt} a $${valNue}`
                    }
                    else if (key === 'cantidad_disponible') {
                        mensajeCambio = `ajustó el stock de ${valAnt} a ${valNue} unidades`
                    }
                    else if (key === 'estado') {
                        mensajeCambio = `cambió el estado de "${valAnt}" a "${valNue}"`
                    }
                    else {
                        const nombreCampo = key.replace(/_/g, ' ')
                        mensajeCambio = `actualizó ${nombreCampo} de "${valAnt || 'vacío'}" a "${valNue || 'vacío'}"`
                    }

                    cambios.push(mensajeCambio)
                }
            }

            if (cambios.length === 0) return `Se actualizó el registro ${nombreRegistro}.`
            return `Al registro ${nombreRegistro}: ${cambios.join('. ')}.`
        }

        return 'Cambio registrado.'
    }

    const getIconoTabla = (tabla: string) => {
        switch (tabla) {
            case 'usuarios': return <UserIcon className="w-4 h-4" />
            case 'productos': return <CubeIcon className="w-4 h-4" />
            case 'pedidos': return <ClipboardDocumentListIcon className="w-4 h-4" />
            case 'bodegas': return <BuildingStorefrontIcon className="w-4 h-4" />
            default: return <ArrowPathIcon className="w-4 h-4" />
        }
    }

    const getColorAccion = (accion: string) => {
        switch (accion) {
            case 'INSERT': return 'bg-green-100 text-green-700 border-green-200'
            case 'UPDATE': return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'DELETE': return 'bg-red-100 text-red-700 border-red-200'
            default: return 'bg-gray-100 text-gray-700 border-gray-200'
        }
    }

    return (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[#232323]">Historial del Sistema</h1>
                    <p className="text-sm text-[#828282]">Registro de auditoría de cambios</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-xl">
                        <FunnelIcon className="w-4 h-4 text-gray-400" />
                        <select
                            className="bg-transparent text-sm outline-none text-gray-700"
                            value={filtroTabla}
                            onChange={(e) => setFiltroTabla(e.target.value)}
                        >
                            <option value="todas">Todas las tablas</option>
                            <option value="usuarios">Usuarios</option>
                            <option value="productos">Productos</option>
                            <option value="pedidos">Pedidos</option>
                        </select>
                    </div>

                    <button
                        onClick={cargarLogs}
                        className="w-10 h-10 flex items-center justify-center bg-[#1A0087] text-white rounded-xl hover:bg-[#130066] transition-colors"
                        title="Actualizar"
                    >
                        <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                {loading && logs.length === 0 ? (
                    <div className="flex justify-center py-20">
                        <div className="w-10 h-10 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        No hay registros de cambios aún.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Fecha</th>
                                    <th className="px-4 py-3 font-semibold">Usuario</th>
                                    <th className="px-4 py-3 font-semibold">Módulo</th>
                                    <th className="px-4 py-3 font-semibold">Acción</th>
                                    <th className="px-4 py-3 font-semibold w-full">Detalles</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-medium text-gray-800">
                                                {log.usuario_email || 'Sistema'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 capitalize text-gray-700">
                                                {getIconoTabla(log.tabla)}
                                                {log.tabla}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-bold border ${getColorAccion(log.accion)}`}>
                                                {log.accion}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500 max-w-md break-words leading-relaxed">
                                            {renderDetalles(log)}

                                            {/* ✅ BOTÓN DE RESTAURAR CON CONTRASEÑA */}
                                            {log.accion === 'DELETE' && log.tabla === 'productos' && (
                                                <button
                                                    onClick={() => {
                                                        setLogAInstaurar(log)
                                                        setPassword('')
                                                        setAuthError('')
                                                    }}
                                                    className="mt-2 flex items-center gap-1 text-xs font-bold text-[#1A0087] hover:underline"
                                                >
                                                    <LockClosedIcon className="w-3 h-3" />
                                                    Restaurar producto (Requiere contraseña)
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL DE CONFIRMACIÓN DE CONTRASEÑA */}
            {logAInstaurar && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-[#232323]">Confirmar Restauración</h2>
                                <p className="text-sm text-[#828282] mt-1">
                                    Por seguridad, ingresa tu contraseña de administrador para restaurar este producto eliminado.
                                </p>
                            </div>
                            <button
                                onClick={() => setLogAInstaurar(null)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Contraseña
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#1A0087] focus:border-[#1A0087] outline-none"
                                placeholder="••••••••"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && password) handleRestaurarProducto()
                                }}
                            />
                            {authError && (
                                <p className="text-red-500 text-xs mt-2">{authError}</p>
                            )}
                        </div>

                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setLogAInstaurar(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRestaurarProducto}
                                disabled={authLoading || !password}
                                className="px-4 py-2 text-sm font-medium text-white bg-[#1A0087] rounded-xl hover:bg-[#130066] disabled:opacity-50 flex items-center gap-2"
                            >
                                {authLoading ? 'Verificando...' : 'Restaurar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}