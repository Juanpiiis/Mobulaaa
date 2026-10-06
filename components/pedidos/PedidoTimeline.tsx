'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    CheckCircleIcon,
    XCircleIcon,
    PencilIcon,
    DocumentTextIcon,
    TruckIcon,
    ArchiveBoxIcon,
    ArrowPathIcon,
    ClockIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import {
    ACCION_LABELS,
    ACCION_COLORES,
    formatearFechaHistorial,
    revertirCambio,
    type AccionHistorial,
} from '@/lib/utils/historial'

interface HistorialItem {
    id: string
    pedido_id: string
    usuario_id: string | null
    usuario_nombre: string | null
    accion: string
    estado_anterior: string | null
    estado_nuevo: string | null
    cambios: any | null
    observacion: string | null
    fecha: string
    revertido: boolean | null
    revertido_en: string | null
    revertido_por: string | null
    motivo_reversion: string | null
}

interface Props {
    pedidoId: string
    estadoPedido?: string | null
}

const ACCION_ICONS: Record<string, any> = {
    creado: DocumentTextIcon,
    editado: PencilIcon,
    aprobado_bodega: CheckCircleIcon,
    rechazado_bodega: XCircleIcon,
    aprobado_cartera: CheckCircleIcon,
    rechazado_cartera: XCircleIcon,
    despachado: TruckIcon,
    entregado: ArchiveBoxIcon,
    revertido: ArrowPathIcon,
    cotizacion_generada: DocumentTextIcon,
}

export function PedidoTimeline({ pedidoId, estadoPedido }: Props) {
    const [historial, setHistorial] = useState<HistorialItem[]>([])
    const [loading, setLoading] = useState(true)
    const [rolUsuario, setRolUsuario] = useState<string | null>(null)
    const [modalAbierto, setModalAbierto] = useState(false)
    const [historialSeleccionado, setHistorialSeleccionado] = useState<HistorialItem | null>(null)
    const [motivo, setMotivo] = useState('')
    const [confirmado, setConfirmado] = useState(false)
    const [procesando, setProcesando] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const supabase = createClient()

    const cargarHistorial = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('pedidos_historial')
            .select('*')
            .eq('pedido_id', pedidoId)
            .order('fecha', { ascending: true })

        if (error) {
            console.error('Error cargando historial:', error)
        } else {
            setHistorial(data || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        cargarHistorial()

        const cargarRol = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data: perfil } = await supabase
                .from('usuarios')
                .select('rol')
                .eq('id', user.id)
                .single()
            setRolUsuario(perfil?.rol || null)
        }
        cargarRol()
    }, [pedidoId, supabase])

    const abrirModal = (item: HistorialItem) => {
        setHistorialSeleccionado(item)
        setMotivo('')
        setConfirmado(false)
        setErrorMsg('')
        setModalAbierto(true)
    }

    const cerrarModal = () => {
        setModalAbierto(false)
        setHistorialSeleccionado(null)
        setMotivo('')
        setConfirmado(false)
        setErrorMsg('')
    }

    const handleRevertir = async () => {
        if (!historialSeleccionado) return

        setErrorMsg('')

        if (motivo.trim().length < 10) {
            setErrorMsg('El motivo debe tener al menos 10 caracteres.')
            return
        }
        if (!confirmado) {
            setErrorMsg('Debes marcar la casilla de confirmación.')
            return
        }

        setProcesando(true)

        const res = await revertirCambio({
            pedidoId,
            historialId: historialSeleccionado.id,
            motivo,
        })

        setProcesando(false)

        if (!res.ok) {
            setErrorMsg(res.error || 'Error al revertir')
            return
        }

        cerrarModal()
        await cargarHistorial()
    }

    if (loading) {
        return (
            <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (historial.length === 0) {
        return (
            <div className="text-center py-6">
                <ClockIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-[#828282]">Sin cambios registrados</p>
            </div>
        )
    }

    const puedeRevertir = rolUsuario === 'admin' && estadoPedido === 'despachado'

    return (
        <>
            <div className="relative">
                <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200" />

                <div className="space-y-4">
                    {historial.map((item) => {
                        const accion = item.accion as AccionHistorial
                        const Icon = ACCION_ICONS[accion] || ClockIcon
                        const colorClass = ACCION_COLORES[accion] || 'bg-gray-100 text-gray-700 border-gray-200'
                        const label = ACCION_LABELS[accion] || accion
                        const esRevertible =
                            puedeRevertir &&
                            item.accion === 'despachado' &&
                            !item.revertido

                        return (
                            <div key={item.id} className="relative flex gap-3">
                                <div
                                    className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white flex-shrink-0 ${colorClass}`}
                                >
                                    <Icon className="w-4 h-4" />
                                </div>

                                <div className="flex-1 min-w-0 pt-1">
                                    <div className="flex items-start justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <p className={`text-sm font-semibold ${item.revertido ? 'line-through text-gray-400' : 'text-[#232323]'}`}>
                                                {label}
                                            </p>
                                            {item.revertido && (
                                                <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                                                    REVERTIDO
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-[#828282]">
                                            {formatearFechaHistorial(item.fecha)}
                                        </p>
                                    </div>

                                    <p className="text-xs text-[#828282] mt-0.5">
                                        Por: <span className="font-medium">{item.usuario_nombre || 'Sistema'}</span>
                                    </p>

                                    {item.estado_anterior && item.estado_nuevo && (
                                        <p className="text-xs text-[#828282] mt-1">
                                            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                                                {item.estado_anterior}
                                            </span>
                                            {' → '}
                                            <span className="bg-[#1A0087]/10 text-[#1A0087] px-1.5 py-0.5 rounded text-[10px] font-medium">
                                                {item.estado_nuevo}
                                            </span>
                                        </p>
                                    )}

                                    {item.observacion && (
                                        <p className="text-xs text-[#232323] mt-1.5 bg-gray-50 rounded-lg p-2">
                                            {item.observacion}
                                        </p>
                                    )}

                                    {item.revertido && item.motivo_reversion && (
                                        <div className="mt-1.5 text-[11px] bg-orange-50 border border-orange-200 rounded-lg p-2 text-orange-800">
                                            <p className="font-semibold">Motivo de reversión:</p>
                                            <p>{item.motivo_reversion}</p>
                                            {item.revertido_en && (
                                                <p className="text-[10px] text-orange-600 mt-1">
                                                    Revertido el {formatearFechaHistorial(item.revertido_en)}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {item.cambios && typeof item.cambios === 'object' && (
                                        <div className="mt-1.5 text-[11px] text-[#828282] bg-blue-50 border border-blue-100 rounded-lg p-2">
                                            {item.cambios.productos_modificados && (
                                                <p>
                                                    <span className="font-medium">Productos modificados:</span>{' '}
                                                    {item.cambios.productos_modificados.length}
                                                </p>
                                            )}
                                            {item.cambios.motivo && (
                                                <p>
                                                    <span className="font-medium">Motivo:</span> {item.cambios.motivo}
                                                </p>
                                            )}
                                            {item.cambios.numero_cotizacion && (
                                                <p>
                                                    <span className="font-medium">Cotización:</span>{' '}
                                                    {item.cambios.numero_cotizacion}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {esRevertible && (
                                        <button
                                            onClick={() => abrirModal(item)}
                                            className="mt-2 flex items-center gap-1.5 text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-1.5 rounded-lg font-medium transition-colors"
                                        >
                                            <ArrowPathIcon className="w-3.5 h-3.5" />
                                            Revertir despacho
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {modalAbierto && historialSeleccionado && (
                <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-5 border-b border-gray-100">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                                    <ExclamationTriangleIcon className="w-5 h-5 text-orange-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-base font-bold text-[#232323]">
                                        Revertir despacho
                                    </h3>
                                    <p className="text-xs text-[#828282] mt-0.5">
                                        Esta acción no se puede deshacer fácilmente
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-800">
                                <p className="font-semibold mb-1">⚠️ ¿Qué va a pasar?</p>
                                <ul className="list-disc list-inside space-y-0.5">
                                    <li>El stock <strong>vuelve al inventario</strong> de la bodega</li>
                                    <li>Se registra un movimiento de <strong>entrada</strong></li>
                                    <li>El pedido vuelve a <strong>aprobado_cartera</strong></li>
                                    <li>Quedará marcado como <strong>REVERTIDO</strong></li>
                                    <li>Número de cotización y PDF <strong>se mantienen</strong></li>
                                </ul>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[#232323] mb-1">
                                    Motivo de la reversión <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={motivo}
                                    onChange={(e) => setMotivo(e.target.value)}
                                    placeholder="Describe brevemente por qué se revierte este despacho (mín. 10 caracteres)"
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A0087]/30 focus:border-[#1A0087] resize-none"
                                    disabled={procesando}
                                />
                                <p className="text-[10px] text-[#828282] mt-1">
                                    {motivo.trim().length} / 10 caracteres mínimo
                                </p>
                            </div>

                            <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={confirmado}
                                    onChange={(e) => setConfirmado(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 text-[#1A0087] border-gray-300 rounded focus:ring-[#1A0087]"
                                    disabled={procesando}
                                />
                                <span className="text-xs text-[#232323]">
                                    Entiendo que esta acción devolverá el stock al inventario y quedará registrada en el historial.
                                </span>
                            </label>

                            {errorMsg && (
                                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5 text-xs">
                                    {errorMsg}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-gray-100 p-4 flex flex-col-reverse sm:flex-row gap-2">
                            <button
                                onClick={cerrarModal}
                                disabled={procesando}
                                className="w-full sm:w-auto px-4 py-2.5 border border-gray-300 rounded-xl text-[#232323] bg-white hover:bg-gray-50 font-medium text-sm disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <div className="flex-1" />
                            <button
                                onClick={handleRevertir}
                                disabled={procesando || motivo.trim().length < 10 || !confirmado}
                                className="w-full sm:w-auto px-4 py-2.5 bg-orange-600 rounded-xl text-white hover:bg-orange-700 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {procesando ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Revirtiendo...
                                    </>
                                ) : (
                                    <>
                                        <ArrowPathIcon className="w-4 h-4" />
                                        Confirmar reversión
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}