'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PedidoTimeline } from '@/components/pedidos/PedidoTimeline'
import { CotizacionBadge } from '@/components/cotizaciones/CotizacionBadge'
import { getEstadoCotizacion, generarNumeroCotizacion, generarNumeroFactura } from '@/lib/utils/cotizacion'
import { calcularDescuento } from '@/types/index'
import {
    XMarkIcon,
    ClockIcon,
    DocumentTextIcon,
    BanknotesIcon,
    CheckCircleIcon,
    XCircleIcon,
    PencilIcon,
    TruckIcon,
    ArchiveBoxIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline'

interface DetallePedido {
    id: string
    cantidad_solicitada: number
    cantidad_aprobada: number | null
    productos: { id: string; nombre: string; precio: number; codigo?: string | null }
}

export interface PedidoCompleto {
    id: string
    estado: string
    fecha: string
    observacion: string | null
    subtotal: number
    descuento_porcentaje: number
    descuento_valor: number
    total: number
    numero_factura: string | null
    numero_cotizacion: string | null
    revertido: boolean
    aprobado_cartera_en?: string | null
    usuarios: { nombre: string; email?: string } | null
    bodegas: { id: string; nombre: string } | null
    clientes: { nombre: string; cc_nit: string; telefono?: string | null } | null
    detalle_pedido: DetallePedido[]
}

interface Props {
    pedido: PedidoCompleto
    onClose: () => void
    onRefresh: () => void
    rolActual: string | null
    onVerCotizacion?: (pedidoId: string) => void
}

type Tab = 'timeline' | 'detalle' | 'cotizacion'

export function PedidoDetalleModal({ pedido, onClose, onRefresh, rolActual, onVerCotizacion }: Props) {
    const [tab, setTab] = useState<Tab>('detalle')
    const [procesando, setProcesando] = useState(false)
    const [mostrarEdicion, setMostrarEdicion] = useState(false)
    const [cantidadesEdit, setCantidadesEdit] = useState<Record<string, number>>({})
    const [mostrarDespacho, setMostrarDespacho] = useState(false)
    const [cantidadesDespacho, setCantidadesDespacho] = useState<Record<string, number>>({})

    // Cancelación
    const [mostrarCancelar, setMostrarCancelar] = useState(false)
    const [motivoCancelar, setMotivoCancelar] = useState('')
    const [confirmadoCancelar, setConfirmadoCancelar] = useState(false)
    const [errorCancelar, setErrorCancelar] = useState('')

    const supabase = createClient()

    useEffect(() => {
        setTab('detalle')
        setMostrarEdicion(false)
        setMostrarDespacho(false)
        setMostrarCancelar(false)
    }, [pedido.id])

    const formatCOP = (v: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)

    // ─────────────────────────────────────────────────────
    // Acciones BODEGUERO
    // ─────────────────────────────────────────────────────

    const handleAprobarBodega = async () => {
        if (procesando) return
        setProcesando(true)
        const { error } = await supabase
            .from('pedidos')
            .update({ estado: 'aprobado_bodega' })
            .eq('id', pedido.id)
        if (!error) {
            const { registrarCambioHistorial } = await import('@/lib/utils/historial')
            await registrarCambioHistorial({
                pedidoId: pedido.id,
                accion: 'aprobado_bodega',
                estadoAnterior: 'pendiente',
                estadoNuevo: 'aprobado_bodega',
                observacion: 'Pedido aprobado por bodega',
            })
        }
        setProcesando(false)
        onRefresh()
        onClose()
    }

    const handleRechazarBodega = async () => {
        if (procesando) return
        setProcesando(true)
        const { error } = await supabase
            .from('pedidos')
            .update({ estado: 'rechazado_bodega' })
            .eq('id', pedido.id)
        if (!error) {
            const { registrarCambioHistorial } = await import('@/lib/utils/historial')
            await registrarCambioHistorial({
                pedidoId: pedido.id,
                accion: 'rechazado_bodega',
                estadoAnterior: 'pendiente',
                estadoNuevo: 'rechazado_bodega',
                observacion: 'Pedido rechazado por bodega',
            })
        }
        setProcesando(false)
        onRefresh()
        onClose()
    }

    const iniciarEdicion = () => {
        const inicial: Record<string, number> = {}
        pedido.detalle_pedido.forEach(d => { inicial[d.id] = d.cantidad_solicitada })
        setCantidadesEdit(inicial)
        setMostrarEdicion(true)
    }

    const guardarEdicion = async () => {
        if (procesando) return
        setProcesando(true)
        const modificados: any[] = []
        for (const d of pedido.detalle_pedido) {
            const nueva = cantidadesEdit[d.id] ?? d.cantidad_solicitada
            if (nueva !== d.cantidad_solicitada) {
                modificados.push({
                    producto: d.productos.nombre,
                    antes: d.cantidad_solicitada,
                    despues: nueva,
                })
                await supabase.from('detalle_pedido').update({ cantidad_solicitada: nueva }).eq('id', d.id)
            }
        }
        if (modificados.length > 0) {
            const { registrarCambioHistorial } = await import('@/lib/utils/historial')
            await registrarCambioHistorial({
                pedidoId: pedido.id,
                accion: 'editado',
                observacion: `Se modificaron ${modificados.length} producto(s)`,
                cambios: { productos_modificados: modificados },
            })
        }
        setProcesando(false)
        setMostrarEdicion(false)
        onRefresh()
        onClose()
    }

    const iniciarDespacho = () => {
        const inicial: Record<string, number> = {}
        pedido.detalle_pedido.forEach(d => {
            inicial[d.id] = d.cantidad_aprobada ?? d.cantidad_solicitada
        })
        setCantidadesDespacho(inicial)
        setMostrarDespacho(true)
    }

    const confirmarDespacho = async () => {
        if (procesando) return
        setProcesando(true)
        const { data: { user } } = await supabase.auth.getUser()

        for (const d of pedido.detalle_pedido) {
            const cantidad = cantidadesDespacho[d.id] || 0
            await supabase.from('detalle_pedido').update({ cantidad_aprobada: cantidad }).eq('id', d.id)

            if (cantidad > 0) {
                await supabase.from('movimientos').insert({
                    producto_id: d.productos.id,
                    bodega_origen_id: pedido.bodegas?.id,
                    cantidad,
                    tipo: 'salida',
                    usuario_id: user?.id,
                    fecha: new Date().toISOString(),
                    observacion: `Despacho ${pedido.numero_factura || pedido.id.slice(0, 8)}`,
                })

                const { data: inv } = await supabase
                    .from('inventario')
                    .select('id, cantidad_disponible')
                    .eq('producto_id', d.productos.id)
                    .eq('bodega_id', pedido.bodegas?.id)
                    .single()

                if (inv) {
                    await supabase
                        .from('inventario')
                        .update({ cantidad_disponible: Math.max(0, inv.cantidad_disponible - cantidad) })
                        .eq('id', inv.id)
                }
            }
        }

        await supabase
            .from('pedidos')
            .update({ estado: 'despachado', revertido: false })
            .eq('id', pedido.id)

        const { registrarCambioHistorial } = await import('@/lib/utils/historial')
        await registrarCambioHistorial({
            pedidoId: pedido.id,
            accion: 'despachado',
            estadoAnterior: 'aprobado_cartera',
            estadoNuevo: 'despachado',
            observacion: pedido.revertido
                ? `Re-despacho después de reversión (${pedido.detalle_pedido.length} productos)`
                : `Despacho de ${pedido.detalle_pedido.length} productos`,
        })

        setProcesando(false)
        setMostrarDespacho(false)
        onRefresh()
        onClose()
    }

    const marcarEntregado = async () => {
        if (procesando) return
        setProcesando(true)
        await supabase.from('pedidos').update({ estado: 'entregado' }).eq('id', pedido.id)
        const { registrarCambioHistorial } = await import('@/lib/utils/historial')
        await registrarCambioHistorial({
            pedidoId: pedido.id,
            accion: 'entregado',
            estadoAnterior: 'despachado',
            estadoNuevo: 'entregado',
            observacion: 'Pedido entregado al cliente',
        })
        setProcesando(false)
        onRefresh()
        onClose()
    }

    // ─────────────────────────────────────────────────────
    // Acciones CARTERA
    // ─────────────────────────────────────────────────────

    const handleAprobarCartera = async () => {
        if (procesando) return
        setProcesando(true)

        try {
            // 1. Calcular totales
            const subtotal = pedido.detalle_pedido.reduce(
                (acc, d) => acc + (d.productos?.precio || 0) * d.cantidad_solicitada,
                0
            )
            const porcentaje = calcularDescuento(subtotal)
            const descuento = subtotal * (porcentaje / 100)
            const total = subtotal - descuento

            const numeroFactura = generarNumeroFactura()
            const numeroCotizacion = await generarNumeroCotizacion(supabase)

            // 2. Actualizar pedido
            const { error: errUpdate } = await supabase.from('pedidos').update({
                estado: 'aprobado_cartera',
                subtotal,
                descuento_porcentaje: porcentaje,
                descuento_valor: descuento,
                total,
                numero_factura: numeroFactura,
                numero_cotizacion: numeroCotizacion,
                aprobado_cartera_en: new Date().toISOString(),
            }).eq('id', pedido.id)

            if (errUpdate) {
                alert('Error actualizando pedido: ' + errUpdate.message)
                setProcesando(false)
                return
            }

            // 3. Registrar en historial
            const { registrarCambioHistorial } = await import('@/lib/utils/historial')
            await registrarCambioHistorial({
                pedidoId: pedido.id,
                accion: 'aprobado_cartera',
                estadoAnterior: 'aprobado_bodega',
                estadoNuevo: 'aprobado_cartera',
                observacion: `Aprobado por cartera. Cotización: ${numeroCotizacion}`,
                cambios: {
                    numero_cotizacion: numeroCotizacion,
                    numero_factura: numeroFactura,
                    total,
                },
            })

            // 4. Generar PDF y subir a Drive
            const res = await fetch('/api/cotizacion/generar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pedidoId: pedido.id }),
            })

            const data = await res.json()

            if (!res.ok) {
                console.error('Error generando PDF:', data)
                alert(
                    'Pedido aprobado, pero hubo un error generando el PDF: ' +
                    (data.error || 'Error desconocido')
                )
            } else {
                await registrarCambioHistorial({
                    pedidoId: pedido.id,
                    accion: 'cotizacion_generada',
                    observacion: data.url
                        ? `PDF subido a Google Drive`
                        : `PDF generado (Drive no disponible: ${data.driveError})`,
                    cambios: {
                        numero_cotizacion: numeroCotizacion,
                        carpeta: data.subcarpeta,
                        archivo: data.nombreArchivo,
                        url: data.url,
                    },
                })

                if (data.url) {
                    alert(
                        `✅ Pedido aprobado\n\n` +
                        `Cotización: ${data.numeroCotizacion}\n` +
                        `Carpeta: ${data.subcarpeta}\n` +
                        `Archivo: ${data.nombreArchivo}\n\n` +
                        `El PDF se subió a tu Drive`
                    )
                } else {
                    alert(
                        `✅ Pedido aprobado\n\n` +
                        `Cotización: ${data.numeroCotizacion}\n\n` +
                        `⚠️ El PDF se generó correctamente pero NO se pudo subir a Drive.\n` +
                        `Motivo: ${data.driveError || 'Desconocido'}\n\n` +
                        `Puedes descargarlo desde el botón "Ver cotización" → "Descargar PDF"`
                    )
                }
            }

            onRefresh()
            onClose()
        } catch (e: any) {
            alert('Error: ' + e.message)
        } finally {
            setProcesando(false)
        }
    }

    const handleRechazarCartera = async () => {
        if (procesando) return
        setProcesando(true)
        await supabase.from('pedidos').update({ estado: 'rechazado_cartera' }).eq('id', pedido.id)
        const { registrarCambioHistorial } = await import('@/lib/utils/historial')
        await registrarCambioHistorial({
            pedidoId: pedido.id,
            accion: 'rechazado_cartera',
            estadoAnterior: 'aprobado_bodega',
            estadoNuevo: 'rechazado_cartera',
            observacion: 'Pedido rechazado por cartera',
        })
        setProcesando(false)
        onRefresh()
        onClose()
    }

    // ─────────────────────────────────────────────────────
    // Cancelación (admin)
    // ─────────────────────────────────────────────────────

    const handleCancelar = async () => {
        if (procesando) return
        setErrorCancelar('')

        if (motivoCancelar.trim().length < 10) {
            setErrorCancelar('El motivo debe tener al menos 10 caracteres.')
            return
        }
        if (!confirmadoCancelar) {
            setErrorCancelar('Debes marcar la casilla de confirmación.')
            return
        }

        setProcesando(true)
        const { cancelarPedido: cancelarFn } = await import('@/lib/utils/historial')
        const res = await cancelarFn({
            pedidoId: pedido.id,
            motivo: motivoCancelar,
        })
        setProcesando(false)

        if (!res.ok) {
            setErrorCancelar(res.error || 'Error al cancelar')
            return
        }

        setMostrarCancelar(false)
        onRefresh()
        onClose()
    }

    // ─────────────────────────────────────────────────────
    // Botones según rol + estado
    // ─────────────────────────────────────────────────────
    const renderBotonesAccion = () => {
        const botones: React.ReactNode[] = []
        const esCancelable = ['pendiente', 'aprobado_bodega', 'aprobado_cartera'].includes(pedido.estado)
        const esAdmin = rolActual === 'admin'
        const esBodeguero = rolActual === 'bodeguero' || rolActual === 'admin'
        const esCartera = rolActual === 'cartera' || rolActual === 'admin'

        // Si está cancelado → solo aviso
        if (pedido.estado === 'cancelado') {
            return (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                    <p className="text-sm font-semibold text-red-700">Pedido cancelado</p>
                    <p className="text-xs text-red-600 mt-0.5">Este pedido ya no está activo</p>
                </div>
            )
        }

        // PENDIENTE → acciones de bodeguero
        if (pedido.estado === 'pendiente' && esBodeguero) {
            botones.push(
                <button
                    key="editar"
                    onClick={iniciarEdicion}
                    disabled={procesando}
                    className="flex-1 min-h-[44px] px-4 py-2.5 border border-gray-300 rounded-xl text-[#232323] bg-white hover:bg-gray-50 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <PencilIcon className="w-4 h-4" />
                    Editar
                </button>
            )
            botones.push(
                <button
                    key="rechazar"
                    onClick={handleRechazarBodega}
                    disabled={procesando}
                    className="flex-1 min-h-[44px] px-4 py-2.5 border border-red-300 rounded-xl text-red-600 bg-white hover:bg-red-50 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <XCircleIcon className="w-4 h-4" />
                    Rechazar
                </button>
            )
            botones.push(
                <button
                    key="aprobar"
                    onClick={handleAprobarBodega}
                    disabled={procesando}
                    className="flex-1 min-h-[44px] px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <CheckCircleIcon className="w-4 h-4" />
                    Aprobar
                </button>
            )
        }

        // APROBADO_BODEGA → acciones de cartera
        if (pedido.estado === 'aprobado_bodega' && esCartera) {
            botones.push(
                <button
                    key="rechazar_cartera"
                    onClick={handleRechazarCartera}
                    disabled={procesando}
                    className="flex-1 min-h-[44px] px-4 py-2.5 border border-red-300 rounded-xl text-red-600 bg-white hover:bg-red-50 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <XCircleIcon className="w-4 h-4" />
                    Rechazar
                </button>
            )
            botones.push(
                <button
                    key="aprobar_cartera"
                    onClick={handleAprobarCartera}
                    disabled={procesando}
                    className="flex-1 min-h-[44px] px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {procesando ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Procesando...
                        </>
                    ) : (
                        <>
                            <CheckCircleIcon className="w-4 h-4" />
                            Aprobar y generar cotización
                        </>
                    )}
                </button>
            )
        }

        // APROBADO_CARTERA → acciones de bodeguero (despachar)
        if (pedido.estado === 'aprobado_cartera' && esBodeguero) {
            botones.push(
                <button
                    key="despachar"
                    onClick={iniciarDespacho}
                    disabled={procesando}
                    className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 ${pedido.revertido
                            ? 'bg-orange-600 hover:bg-orange-700'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                >
                    <TruckIcon className="w-4 h-4" />
                    {pedido.revertido ? 'Re-despachar pedido' : 'Despachar pedido'}
                </button>
            )
        }

        // DESPACHADO → acciones de bodeguero
        if (pedido.estado === 'despachado' && esBodeguero) {
            botones.push(
                <button
                    key="entregar"
                    onClick={marcarEntregado}
                    disabled={procesando}
                    className="flex-1 min-h-[44px] px-4 py-2.5 bg-gray-700 text-white rounded-xl hover:bg-gray-800 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <ArchiveBoxIcon className="w-4 h-4" />
                    Marcar entregado
                </button>
            )
        }

        const contenido = botones.length > 0 ? (
            <div className="flex flex-col sm:flex-row gap-2">{botones}</div>
        ) : null

        // Botón de cancelar (solo admin)
        const botonCancelar = esAdmin && esCancelable ? (
            <button
                onClick={() => {
                    setMotivoCancelar('')
                    setConfirmadoCancelar(false)
                    setErrorCancelar('')
                    setMostrarCancelar(true)
                }}
                disabled={procesando}
                className="w-full min-h-[40px] mt-2 px-4 py-2 border border-red-200 rounded-xl text-red-600 bg-white hover:bg-red-50 font-medium text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
                🗑️ Cancelar pedido definitivamente
            </button>
        ) : null

        return (
            <>
                {contenido}
                {botonCancelar}
            </>
        )
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden relative">

                <div className="shrink-0 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-3 p-5">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-lg font-bold text-[#232323]">
                                    Pedido #{pedido.id.slice(0, 8)}
                                </h2>
                                {pedido.revertido && (
                                    <span className="bg-orange-100 text-orange-700 border border-orange-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                                        🔄 REVERTIDO
                                    </span>
                                )}
                                {pedido.estado === 'cancelado' && (
                                    <span className="bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded text-[10px] font-bold">
                                        CANCELADO
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-[#828282]">
                                {pedido.numero_cotizacion && (
                                    <span className="font-mono text-[#1A0087] font-semibold">
                                        {pedido.numero_cotizacion}
                                    </span>
                                )}
                                {pedido.numero_factura && (
                                    <>
                                        <span>·</span>
                                        <span className="text-blue-600 font-medium">{pedido.numero_factura}</span>
                                    </>
                                )}
                                <span>·</span>
                                <span>
                                    {new Date(pedido.fecha).toLocaleDateString('es-CO', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                    })}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                            aria-label="Cerrar"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex border-t border-gray-100">
                        <TabButton
                            active={tab === 'detalle'}
                            onClick={() => setTab('detalle')}
                            icon={<BanknotesIcon className="w-4 h-4" />}
                            label="Detalle"
                        />
                        <TabButton
                            active={tab === 'timeline'}
                            onClick={() => setTab('timeline')}
                            icon={<ClockIcon className="w-4 h-4" />}
                            label="Historial"
                        />
                        <TabButton
                            active={tab === 'cotizacion'}
                            onClick={() => setTab('cotizacion')}
                            icon={<DocumentTextIcon className="w-4 h-4" />}
                            label="Cotización"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-[#F7F7FB]">
                    {tab === 'detalle' && (
                        <div className="p-5 space-y-4">
                            <div className="bg-white rounded-2xl border border-gray-100 p-4">
                                <p className="text-xs font-semibold text-[#828282] uppercase tracking-wide mb-2">
                                    Cliente
                                </p>
                                <p className="font-semibold text-[#232323]">
                                    {pedido.clientes?.nombre || 'Sin cliente'}
                                </p>
                                {pedido.clientes?.cc_nit && (
                                    <p className="text-sm text-[#828282] mt-0.5">CC/NIT: {pedido.clientes.cc_nit}</p>
                                )}
                                {pedido.clientes?.telefono && (
                                    <p className="text-sm text-[#828282]">Tel: {pedido.clientes.telefono}</p>
                                )}
                                <p className="text-xs text-[#828282] mt-2">
                                    Vendedor: <span className="font-medium">{pedido.usuarios?.nombre || 'N/A'}</span>
                                </p>
                            </div>

                            {pedido.revertido && (
                                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
                                    <ArrowPathIcon className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-orange-800 text-sm">Pedido revertido</p>
                                        <p className="text-xs text-orange-700 mt-1">
                                            Este pedido fue revertido después de un despacho anterior. Verifica
                                            las cantidades antes de volver a despachar.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {pedido.estado === 'cancelado' && (
                                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                                    <XCircleIcon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-red-800 text-sm">Pedido cancelado</p>
                                        <p className="text-xs text-red-700 mt-1">
                                            Este pedido fue cancelado y ya no está activo.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="bg-white rounded-2xl border border-gray-100 p-4">
                                <p className="text-xs font-semibold text-[#828282] uppercase tracking-wide mb-3">
                                    Productos ({pedido.detalle_pedido.length})
                                </p>

                                {mostrarEdicion ? (
                                    <div className="space-y-3">
                                        {pedido.detalle_pedido.map(d => (
                                            <div key={d.id} className="flex items-center gap-3">
                                                <span className="flex-1 text-sm truncate">{d.productos.nombre}</span>
                                                <span className="text-xs text-[#828282] shrink-0">
                                                    {d.cantidad_solicitada}
                                                </span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={cantidadesEdit[d.id] ?? d.cantidad_solicitada}
                                                    onChange={e => setCantidadesEdit({
                                                        ...cantidadesEdit,
                                                        [d.id]: parseInt(e.target.value) || 0,
                                                    })}
                                                    className="w-20 border border-gray-300 rounded-lg p-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#1A0087]/30 focus:border-[#1A0087]"
                                                />
                                            </div>
                                        ))}
                                        <div className="flex gap-2 pt-2">
                                            <button
                                                onClick={() => setMostrarEdicion(false)}
                                                disabled={procesando}
                                                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-[#232323] bg-white hover:bg-gray-50 disabled:opacity-50"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={guardarEdicion}
                                                disabled={procesando}
                                                className="flex-1 py-2.5 bg-[#1A0087] text-white rounded-xl text-sm font-medium hover:bg-[#130066] disabled:opacity-50"
                                            >
                                                {procesando ? 'Guardando...' : 'Guardar cambios'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {pedido.detalle_pedido.map(d => {
                                            const cantidad = d.cantidad_aprobada ?? d.cantidad_solicitada
                                            return (
                                                <div key={d.id} className="py-2.5 flex items-center justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium text-[#232323] truncate">
                                                            {d.productos.nombre}
                                                        </p>
                                                        {d.productos.codigo && (
                                                            <p className="text-[10px] text-[#828282] font-mono">
                                                                {d.productos.codigo}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-sm font-semibold text-[#232323]">
                                                            ×{cantidad}
                                                        </p>
                                                        <p className="text-xs text-[#828282]">
                                                            {formatCOP(d.productos.precio)}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 p-4">
                                <p className="text-xs font-semibold text-[#828282] uppercase tracking-wide mb-3">
                                    Resumen
                                </p>
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between text-[#828282]">
                                        <span>Subtotal</span>
                                        <span>{formatCOP(pedido.subtotal || 0)}</span>
                                    </div>
                                    {pedido.descuento_porcentaje > 0 && (
                                        <div className="flex justify-between text-green-600">
                                            <span>Descuento ({pedido.descuento_porcentaje}%)</span>
                                            <span>- {formatCOP(pedido.descuento_valor || 0)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-baseline pt-2 border-t border-gray-100 mt-2">
                                        <span className="font-semibold text-[#232323]">Total</span>
                                        <span className="text-lg font-bold text-[#1A0087]">
                                            {formatCOP(pedido.total || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {pedido.observacion && (
                                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                                    <p className="text-xs font-semibold text-[#828282] uppercase tracking-wide mb-2">
                                        Observación
                                    </p>
                                    <p className="text-sm text-[#232323] italic">"{pedido.observacion}"</p>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'timeline' && (
                        <div className="p-5">
                            <div className="bg-white rounded-2xl border border-gray-100 p-4">
                                <PedidoTimeline
                                    pedidoId={pedido.id}
                                    estadoPedido={pedido.estado}
                                />
                            </div>
                        </div>
                    )}

                    {tab === 'cotizacion' && (
                        <div className="p-5 space-y-4">
                            {pedido.numero_cotizacion ? (
                                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="text-xs font-semibold text-[#828282] uppercase tracking-wide">
                                                Cotización
                                            </p>
                                            <p className="font-mono text-[#1A0087] font-semibold mt-1">
                                                {pedido.numero_cotizacion}
                                            </p>
                                        </div>
                                        <CotizacionBadge
                                            estado={getEstadoCotizacion(pedido.estado)}
                                            numeroCotizacion={pedido.numero_cotizacion}
                                        />
                                    </div>

                                    {onVerCotizacion && (
                                        <button
                                            onClick={() => onVerCotizacion(pedido.id)}
                                            className="w-full py-2.5 bg-[#1A0087] text-white rounded-xl text-sm font-medium hover:bg-[#130066] flex items-center justify-center gap-2"
                                        >
                                            <DocumentTextIcon className="w-4 h-4" />
                                            Ver cotización completa
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                                    <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-[#828282]">
                                        La cotización aún no ha sido generada
                                    </p>
                                    <p className="text-xs text-[#828282] mt-1">
                                        Se genera cuando cartera aprueba el pedido
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* MODAL DE DESPACHO */}
                {mostrarDespacho && (
                    <div className="absolute inset-0 bg-black/40 flex items-end sm:items-center justify-center z-10 p-0 sm:p-4">
                        <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                            <div className="p-5 border-b border-gray-100">
                                <h3 className="text-base font-bold text-[#232323]">
                                    {pedido.revertido ? 'Re-despachar pedido' : 'Confirmar despacho'}
                                </h3>
                                <p className="text-xs text-[#828282] mt-0.5">
                                    Verifica las cantidades antes de despachar
                                </p>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                {pedido.detalle_pedido.map(d => (
                                    <div key={d.id} className="flex items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-[#232323] truncate">
                                                {d.productos.nombre}
                                            </p>
                                            <p className="text-[10px] text-[#828282]">
                                                Solicitado: {d.cantidad_solicitada}
                                            </p>
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            max={d.cantidad_solicitada}
                                            value={cantidadesDespacho[d.id] || 0}
                                            onChange={e => setCantidadesDespacho({
                                                ...cantidadesDespacho,
                                                [d.id]: parseInt(e.target.value) || 0,
                                            })}
                                            className="w-20 border border-gray-300 rounded-lg p-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#1A0087]/30 focus:border-[#1A0087]"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="border-t border-gray-100 p-4 flex gap-2">
                                <button
                                    onClick={() => setMostrarDespacho(false)}
                                    disabled={procesando}
                                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-[#232323] bg-white hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmarDespacho}
                                    disabled={procesando}
                                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {procesando ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Despachando...
                                        </>
                                    ) : (
                                        <>
                                            <TruckIcon className="w-4 h-4" />
                                            Confirmar
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL DE CANCELACIÓN */}
                {mostrarCancelar && (
                    <div className="absolute inset-0 bg-black/40 flex items-end sm:items-center justify-center z-10 p-0 sm:p-4">
                        <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                            <div className="p-5 border-b border-gray-100">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                        <span className="text-lg">🗑️</span>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-[#232323]">
                                            Cancelar pedido
                                        </h3>
                                        <p className="text-xs text-[#828282] mt-0.5">
                                            Esta acción no se puede deshacer fácilmente
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800">
                                    <p className="font-semibold mb-1">⚠️ ¿Qué va a pasar?</p>
                                    <ul className="list-disc list-inside space-y-0.5">
                                        <li>El pedido quedará en estado <strong>cancelado</strong></li>
                                        <li>Ya no aparecerá en "En proceso"</li>
                                        <li>Se moverá al historial con badge CANCELADO</li>
                                        <li><strong>No se devuelve stock</strong> al inventario</li>
                                        <li>El número de cotización <strong>se mantiene</strong></li>
                                    </ul>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[#232323] mb-1">
                                        Motivo de la cancelación <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={motivoCancelar}
                                        onChange={(e) => setMotivoCancelar(e.target.value)}
                                        placeholder="Ej: Cliente canceló el pedido, error en la creación, etc."
                                        rows={3}
                                        disabled={procesando}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 resize-none"
                                    />
                                    <p className="text-[10px] text-[#828282] mt-1">
                                        {motivoCancelar.trim().length} / 10 caracteres mínimo
                                    </p>
                                </div>

                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={confirmadoCancelar}
                                        onChange={(e) => setConfirmadoCancelar(e.target.checked)}
                                        disabled={procesando}
                                        className="mt-0.5 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                    />
                                    <span className="text-xs text-[#232323]">
                                        Entiendo que este pedido será cancelado definitivamente y no podrá volver a procesarse.
                                    </span>
                                </label>

                                {errorCancelar && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5 text-xs">
                                        {errorCancelar}
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-gray-100 p-4 flex gap-2">
                                <button
                                    onClick={() => setMostrarCancelar(false)}
                                    disabled={procesando}
                                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-[#232323] bg-white hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Volver
                                </button>
                                <button
                                    onClick={handleCancelar}
                                    disabled={procesando || motivoCancelar.trim().length < 10 || !confirmadoCancelar}
                                    className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {procesando ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Cancelando...
                                        </>
                                    ) : (
                                        'Confirmar cancelación'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {renderBotonesAccion() && (
                    <div className="shrink-0 border-t border-gray-100 bg-white p-4">
                        {renderBotonesAccion()}
                    </div>
                )}
            </div>
        </div>
    )
}

function TabButton({
    active,
    onClick,
    icon,
    label,
}: {
    active: boolean
    onClick: () => void
    icon: React.ReactNode
    label: string
}) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium transition-colors border-b-2 ${active
                    ? 'text-[#1A0087] border-[#1A0087] bg-[#1A0087]/5'
                    : 'text-[#828282] border-transparent hover:text-[#232323] hover:bg-gray-50'
                }`}
        >
            {icon}
            {label}
        </button>
    )
}