'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PedidoTimeline } from '@/components/pedidos/PedidoTimeline'
import { CotizacionBadge } from '@/components/cotizaciones/CotizacionBadge'
import { ProductoBuscadorModal } from '@/components/pedidos/ProductoBuscadorModal'
import { getEstadoCotizacion } from '@/lib/utils/cotizacion'
import type { ProductoBusqueda } from '@/lib/hooks/useBuscarProducto'
import {
    XMarkIcon,
    ClockIcon,
    DocumentTextIcon,
    BanknotesIcon,
    CheckIcon,
    ArrowPathIcon,
    ArrowUturnLeftIcon,
    UserIcon,
    PhoneIcon,
    PencilIcon,
    PlusIcon,
    TrashIcon,
    ExclamationTriangleIcon,
    ArrowDownTrayIcon,
    ArrowRightIcon,
    TruckIcon,
    ArchiveBoxIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline'

// ─────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────
interface DetallePedido {
    id: string
    cantidad_solicitada: number
    cantidad_aprobada: number | null
    producto_id: string
    precio_unitario?: number | null
    tipo_precio?: string | null
    productos: {
        id: string
        nombre: string
        precio: number
        precio_mayorista?: number | null
        codigo?: string | null
    }
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
    importante?: boolean
    aprobado_cartera_en?: string | null
    bodega_id?: string | null
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
    abrirEnModoEdicion?: boolean
}

type Tab = 'detalle' | 'timeline' | 'cotizacion'

interface ItemEdit {
    producto_id: string
    cantidad: number | ''
    nombre: string
    precio: number
    precio_unitario: number
    precioTexto: string
}

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────
const formatCOP = (v: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)

const formatFecha = (fecha: string) =>
    new Date(fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })

const calcularDescuento = (subtotal: number) => {
    if (subtotal >= 5000000) return 10
    if (subtotal >= 2000000) return 5
    if (subtotal >= 1000000) return 3
    return 0
}

const PASOS = [
    { key: 'pendiente', label: 'Pedido' },
    { key: 'aprobado_cartera', label: 'Cartera' },
    { key: 'en_preparacion', label: 'Preparando' },
    { key: 'listo_para_despacho', label: 'Listo' },
    { key: 'despachado', label: 'Enviado' },
    { key: 'entregado', label: 'Entregado' },
]

function getPasoActual(estado: string): number {
    return PASOS.findIndex(p => p.key === estado)
}

const ESTADOS_FINALES = ['despachado', 'entregado', 'rechazado_bodega', 'rechazado_cartera', 'cancelado', 'devuelto_por_cartera']

// ─────────────────────────────────────────────────────
// Barra de progreso
// ─────────────────────────────────────────────────────
function BarraProgreso({
    estado,
    esAdmin,
    onRetroceder,
}: {
    estado: string
    esAdmin: boolean
    onRetroceder: (pasoKey: string, pasoLabel: string) => void
}) {
    const cancelado = ['rechazado_bodega', 'rechazado_cartera', 'cancelado'].includes(estado)
    const devuelto = estado === 'devuelto_por_cartera'
    const pasoActual = getPasoActual(estado)
    const puedeRetrocederDesde = !ESTADOS_FINALES.includes(estado)

    if (cancelado) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-sm font-semibold text-red-700">
                    {estado === 'cancelado' ? '❌ Pedido cancelado' :
                        estado === 'rechazado_bodega' ? '❌ Rechazado por bodega' :
                            '❌ Rechazado por cartera'}
                </p>
            </div>
        )
    }

    if (devuelto) {
        return (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                <p className="text-sm font-semibold text-orange-700">
                    🔙 Devuelto por cartera — esperando revisión del admin
                </p>
            </div>
        )
    }

    return (
        <div className="bg-gray-50 rounded-xl p-4">
            <div className="grid grid-cols-6 gap-1">
                {PASOS.map((paso, i) => {
                    const completado = i < pasoActual
                    const actual = i === pasoActual
                    const esAnterior = i < pasoActual
                    const clickable = esAdmin && puedeRetrocederDesde && esAnterior && !actual

                    return (
                        <div
                            key={paso.key}
                            className={`flex flex-col items-center gap-1.5 ${clickable ? 'cursor-pointer group' : ''}`}
                            onClick={() => { if (clickable) onRetroceder(paso.key, paso.label) }}
                            title={clickable ? `Retroceder a ${paso.label}` : undefined}
                        >
                            <div className="relative w-full flex items-center">
                                {i > 0 && (
                                    <div className={`h-0.5 flex-1 rounded ${i <= pasoActual ? 'bg-[#1A0087]' : 'bg-gray-200'}`} />
                                )}
                                {i === 0 && <div className="h-0.5 flex-1" />}

                                <div
                                    className={`relative z-10 flex w-6 h-6 items-center justify-center rounded-full shrink-0 transition-all ${completado
                                        ? 'bg-[#1A0087] text-white'
                                        : actual
                                            ? 'bg-[#1A0087] ring-4 ring-[#1A0087]/15'
                                            : 'border-2 border-gray-200 bg-white'
                                        } ${clickable ? 'group-hover:ring-4 group-hover:ring-orange-300 group-hover:bg-orange-500' : ''}`}
                                >
                                    {completado && <CheckIcon className="h-3.5 w-3.5" />}
                                    {actual && <span className="h-2 w-2 rounded-full bg-white" />}
                                </div>

                                {i < PASOS.length - 1 && (
                                    <div className={`h-0.5 flex-1 rounded ${i < pasoActual ? 'bg-[#1A0087]' : 'bg-gray-200'}`} />
                                )}
                                {i === PASOS.length - 1 && <div className="h-0.5 flex-1" />}
                            </div>
                            <span className={`text-[10px] leading-tight text-center ${actual ? 'font-semibold text-[#1A0087]' : completado ? 'text-[#1A0087]/70' : 'text-gray-400'
                                } ${clickable ? 'group-hover:text-orange-600 group-hover:font-semibold' : ''}`}>
                                {paso.label}
                            </span>
                        </div>
                    )
                })}
            </div>

            {esAdmin && puedeRetrocederDesde && pasoActual > 0 && (
                <p className="text-[10px] text-orange-600 mt-3 text-center">
                    💡 Como admin, puedes pulsar un paso anterior para retroceder el pedido.
                </p>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────
// Modal principal
// ─────────────────────────────────────────────────────
export function PedidoDetalleModal({
    pedido,
    onClose,
    onRefresh,
    rolActual,
    onVerCotizacion,
    abrirEnModoEdicion = false,
}: Props) {
    const [tab, setTab] = useState<Tab>('detalle')
    const [procesando, setProcesando] = useState(false)
    const [errorAccion, setErrorAccion] = useState('')

    const [modoEdicion, setModoEdicion] = useState(false)
    const [itemsEdit, setItemsEdit] = useState<ItemEdit[]>([])
    const [buscadorAbierto, setBuscadorAbierto] = useState(false)
    const [errorEdicion, setErrorEdicion] = useState('')

    const [productosBodega, setProductosBodega] = useState<ProductoBusqueda[]>([])
    const [cargandoProductos, setCargandoProductos] = useState(false)

    const [mostrarCancelar, setMostrarCancelar] = useState(false)
    const [motivoCancelar, setMotivoCancelar] = useState('')
    const [confirmadoCancelar, setConfirmadoCancelar] = useState(false)
    const [errorCancelar, setErrorCancelar] = useState('')

    const [mostrarRechazar, setMostrarRechazar] = useState(false)
    const [motivoRechazar, setMotivoRechazar] = useState('')
    const [confirmadoRechazar, setConfirmadoRechazar] = useState(false)
    const [errorRechazar, setErrorRechazar] = useState('')

    const [mostrarRetroceder, setMostrarRetroceder] = useState(false)
    const [retrocesoDestino, setRetrocesoDestino] = useState<{ key: string; label: string } | null>(null)
    const [motivoRetroceso, setMotivoRetroceso] = useState('')
    const [confirmadoRetroceso, setConfirmadoRetroceso] = useState(false)
    const [errorRetroceso, setErrorRetroceso] = useState('')

    const [motivoCancelado, setMotivoCancelado] = useState<string | null>(null)
    const [fechaCancelado, setFechaCancelado] = useState<string | null>(null)
    const [motivoReversion, setMotivoReversion] = useState<string | null>(null)
    const [fechaReversion, setFechaReversion] = useState<string | null>(null)

    const supabase = createClient()
    const bodegaId = pedido.bodega_id || pedido.bodegas?.id

    const esAdmin = rolActual === 'admin'
    const esBodeguero = rolActual === 'bodeguero' || esAdmin
    const esDevuelto = pedido.estado === 'devuelto_por_cartera'
    const esCancelado = pedido.estado === 'cancelado'
    const esRechazado = ['rechazado_bodega', 'rechazado_cartera'].includes(pedido.estado)
    const esCancelable = !['cancelado', 'entregado'].includes(pedido.estado)
    const esRechazable = esAdmin && !['rechazado_bodega', 'rechazado_cartera', 'cancelado', 'entregado', 'despachado'].includes(pedido.estado)
    const puedeEditar = esAdmin && !['cancelado'].includes(pedido.estado)

    useEffect(() => {
        setTab('detalle')
        setMostrarCancelar(false)
        setMostrarRechazar(false)
        setMostrarRetroceder(false)
        setRetrocesoDestino(null)
        setErrorEdicion('')
        setErrorAccion('')
        setErrorRechazar('')
        setErrorRetroceso('')

        if (abrirEnModoEdicion && puedeEditar) {
            setItemsEdit(
                pedido.detalle_pedido.map(d => {
                    const precioBase = d.precio_unitario ?? d.productos.precio
                    return {
                        producto_id: d.producto_id,
                        cantidad: d.cantidad_solicitada,
                        nombre: d.productos.nombre,
                        precio: d.productos.precio,
                        precio_unitario: precioBase,
                        precioTexto: String(precioBase),
                    }
                })
            )
            setModoEdicion(true)
        } else {
            setModoEdicion(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pedido.id, abrirEnModoEdicion])

    useEffect(() => {
        const cargar = async () => {
            if (!bodegaId) return
            if (productosBodega.length > 0) return
            setCargandoProductos(true)

            const { data, error } = await supabase
                .from('inventario')
                .select(`
                    cantidad_disponible,
                    productos!inner(
                        id, nombre, precio, precio_mayorista, categoria, sku,
                        congelado_manual, limite_congelado
                    )
                `)
                .eq('bodega_id', bodegaId)
                .gt('cantidad_disponible', 0)

            if (error) { console.error(error); setCargandoProductos(false); return }

            const items: ProductoBusqueda[] = (data || [])
                .map((i: any) => ({
                    id: i.productos?.id,
                    nombre: i.productos?.nombre,
                    precio: i.productos?.precio,
                    precio_mayorista: i.productos?.precio_mayorista,
                    categoria: i.productos?.categoria,
                    sku: i.productos?.sku,
                    stock_disponible: i.cantidad_disponible || 0,
                    congelado_manual: i.productos?.congelado_manual ?? false,
                    limite_congelado: i.productos?.limite_congelado ?? null,
                }))
                .filter((p: any) => p.id)

            setProductosBodega(items)
            setCargandoProductos(false)
        }
        cargar()
    }, [bodegaId, supabase, productosBodega.length])

    useEffect(() => {
        const cargarMotivo = async () => {
            if (!pedido.revertido) { setMotivoReversion(null); setFechaReversion(null); return }
            const { data } = await supabase
                .from('pedidos_historial')
                .select('motivo_reversion, revertido_en, usuario_nombre')
                .eq('pedido_id', pedido.id)
                .eq('accion', 'despachado')
                .eq('revertido', true)
                .order('revertido_en', { ascending: false })
                .limit(1)
                .maybeSingle()
            if (data) {
                setMotivoReversion(data.motivo_reversion || 'Sin motivo especificado')
                setFechaReversion(data.revertido_en || null)
            }
        }
        cargarMotivo()
    }, [pedido.id, pedido.revertido, supabase])

    useEffect(() => {
        const cargarMotivoCancelacion = async () => {
            if (pedido.estado !== 'cancelado') { setMotivoCancelado(null); setFechaCancelado(null); return }
            const { data } = await supabase
                .from('pedidos_historial')
                .select('observacion, cambios, fecha')
                .eq('pedido_id', pedido.id)
                .eq('accion', 'cancelado')
                .order('fecha', { ascending: false })
                .limit(1)
                .maybeSingle()
            if (data) {
                const motivo = data.cambios?.motivo || data.observacion || 'Sin motivo especificado'
                setMotivoCancelado(motivo)
                setFechaCancelado(data.fecha || null)
            }
        }
        cargarMotivoCancelacion()
    }, [pedido.id, pedido.estado, supabase])

    const registrarHistorial = async (
        accion: string,
        estadoAnterior: string,
        estadoNuevo: string,
        observacion: string
    ) => {
        const { registrarCambioHistorial } = await import('@/lib/utils/historial')
        await registrarCambioHistorial({
            pedidoId: pedido.id,
            accion: accion as any,
            estadoAnterior,
            estadoNuevo,
            observacion,
        })
    }

    const cambiarEstado = async (estadoAnterior: string, estadoNuevo: string, observacion: string, accion: string = 'editado') => {
        if (procesando) return
        setProcesando(true)
        setErrorAccion('')

        const { data, error } = await supabase
            .from('pedidos')
            .update({ estado: estadoNuevo })
            .eq('id', pedido.id)
            .eq('estado', estadoAnterior)
            .select('id')

        if (error) { setErrorAccion('Error: ' + error.message); setProcesando(false); return }
        if (!data || data.length === 0) {
            setErrorAccion('El pedido cambió de estado. Recarga.')
            setProcesando(false); onRefresh(); return
        }

        await registrarHistorial(accion, estadoAnterior, estadoNuevo, observacion)
        setProcesando(false)
        onRefresh()
        onClose()
    }

    const handleAceptar = () => cambiarEstado('aprobado_cartera', 'en_preparacion', 'Bodega aceptó y empieza a alistar')
    const handleMarcarListo = () => cambiarEstado('en_preparacion', 'listo_para_despacho', 'Bodega terminó el alistamiento')

    const handleDespachar = async () => {
        if (procesando) return
        setProcesando(true)
        setErrorAccion('')

        const p_cantidades = pedido.detalle_pedido.map(d => ({
            detalle_id: d.id,
            cantidad: d.cantidad_aprobada ?? d.cantidad_solicitada,
        }))

        const { error: errRpc } = await supabase.rpc('despachar_pedido', {
            p_pedido: pedido.id,
            p_cantidades,
        })

        if (errRpc) { setErrorAccion('No se pudo despachar: ' + errRpc.message); setProcesando(false); return }
        setProcesando(false); onRefresh(); onClose()
    }

    const handleMarcarEntregado = () => cambiarEstado('despachado', 'entregado', 'Pedido entregado al cliente', 'entregado')

    const iniciarRetroceso = (pasoKey: string, pasoLabel: string) => {
        setRetrocesoDestino({ key: pasoKey, label: pasoLabel })
        setMotivoRetroceso('')
        setConfirmadoRetroceso(false)
        setErrorRetroceso('')
        setMostrarRetroceder(true)
    }

    const confirmarRetroceso = async () => {
        if (!retrocesoDestino || procesando) return
        setErrorRetroceso('')

        if (motivoRetroceso.trim().length < 10) { setErrorRetroceso('El motivo debe tener al menos 10 caracteres.'); return }
        if (!confirmadoRetroceso) { setErrorRetroceso('Debes marcar la casilla de confirmación.'); return }

        setProcesando(true)

        const { data, error } = await supabase
            .from('pedidos')
            .update({ estado: retrocesoDestino.key })
            .eq('id', pedido.id)
            .eq('estado', pedido.estado)
            .select('id')

        if (error) { setErrorRetroceso('Error: ' + error.message); setProcesando(false); return }
        if (!data || data.length === 0) { setErrorRetroceso('El pedido cambió de estado. Recarga.'); setProcesando(false); return }

        await registrarHistorial('revertido', pedido.estado, retrocesoDestino.key, `Retroceso manual por admin. Motivo: ${motivoRetroceso.trim()}`)

        setProcesando(false)
        setMostrarRetroceder(false)
        setRetrocesoDestino(null)
        onRefresh()
        onClose()
    }

    const confirmarRechazo = async () => {
        if (procesando) return
        setErrorRechazar('')

        if (motivoRechazar.trim().length < 10) { setErrorRechazar('El motivo debe tener al menos 10 caracteres.'); return }
        if (!confirmadoRechazar) { setErrorRechazar('Debes marcar la casilla de confirmación.'); return }

        setProcesando(true)

        const { data, error } = await supabase
            .from('pedidos')
            .update({ estado: 'rechazado_bodega' })
            .eq('id', pedido.id)
            .eq('estado', pedido.estado)
            .select('id')

        if (error) { setErrorRechazar('Error: ' + error.message); setProcesando(false); return }
        if (!data || data.length === 0) { setErrorRechazar('El pedido cambió de estado. Recarga.'); setProcesando(false); return }

        await registrarHistorial('rechazado_bodega', pedido.estado, 'rechazado_bodega', `Rechazado por admin. Motivo: ${motivoRechazar.trim()}`)

        setProcesando(false)
        setMostrarRechazar(false)
        onRefresh()
        onClose()
    }

    const handleDevolverABodega = async () => {
        if (procesando) return
        setProcesando(true)
        const { error } = await supabase.from('pedidos').update({ estado: 'pendiente' }).eq('id', pedido.id)
        if (error) { alert('Error: ' + error.message); setProcesando(false); return }
        await registrarHistorial('editado', 'devuelto_por_cartera', 'pendiente', 'Admin devolvió el pedido a bodega sin cambios')
        setProcesando(false)
        onRefresh()
        onClose()
    }

    const handleCancelar = async () => {
        if (procesando) return
        setErrorCancelar('')

        if (motivoCancelar.trim().length < 10) { setErrorCancelar('El motivo debe tener al menos 10 caracteres.'); return }
        if (!confirmadoCancelar) { setErrorCancelar('Debes marcar la casilla de confirmación.'); return }

        setProcesando(true)
        const { cancelarPedido: cancelarFn } = await import('@/lib/utils/historial')
        const res = await cancelarFn({ pedidoId: pedido.id, motivo: motivoCancelar })
        setProcesando(false)
        if (!res.ok) { setErrorCancelar(res.error || 'Error al cancelar'); return }
        setMostrarCancelar(false)
        onRefresh()
        onClose()
    }

    const iniciarEdicion = () => {
        setItemsEdit(
            pedido.detalle_pedido.map(d => {
                const precioBase = d.precio_unitario ?? d.productos.precio
                return {
                    producto_id: d.producto_id,
                    cantidad: d.cantidad_solicitada,
                    nombre: d.productos.nombre,
                    precio: d.productos.precio,
                    precio_unitario: precioBase,
                    precioTexto: String(precioBase),
                }
            })
        )
        setErrorEdicion('')
        setModoEdicion(true)
        setTab('detalle')
    }

    const cancelarEdicion = () => {
        setModoEdicion(false)
        setItemsEdit([])
        setErrorEdicion('')
    }

    const agregarProducto = (p: ProductoBusqueda) => {
        if (itemsEdit.some(it => it.producto_id === p.id)) {
            setErrorEdicion('Ese producto ya está en el pedido')
            return
        }

        const precioBase = p.precio_mayorista ?? p.precio
        setItemsEdit([...itemsEdit, {
            producto_id: p.id, cantidad: 1, nombre: p.nombre,
            precio: precioBase, precio_unitario: precioBase, precioTexto: String(precioBase),
        }])
        setErrorEdicion('')
    }

    const eliminarProducto = (productoId: string) => {
        setItemsEdit(itemsEdit.filter(it => it.producto_id !== productoId))
        setErrorEdicion('')
    }

    const cambiarCantidad = (productoId: string, valor: string) => {
        const soloNumeros = valor.replace(/\D/g, '')
        if (soloNumeros === '') {
            setItemsEdit(itemsEdit.map(it => it.producto_id === productoId ? { ...it, cantidad: '' } : it))
            return
        }
        const num = parseInt(soloNumeros)
        if (num === 0) { setItemsEdit(itemsEdit.filter(it => it.producto_id !== productoId)); return }
        setItemsEdit(itemsEdit.map(it => it.producto_id === productoId ? { ...it, cantidad: num } : it))
    }

    const cambiarPrecioTexto = (productoId: string, valor: string) => {
        const limpio = valor.replace(/[^0-9]/g, '')
        setItemsEdit(itemsEdit.map(it => {
            if (it.producto_id !== productoId) return it
            if (limpio === '') return { ...it, precioTexto: '', precio_unitario: 0 }
            return { ...it, precioTexto: limpio, precio_unitario: parseInt(limpio) }
        }))
    }

    const handleBlurPrecio = (productoId: string) => {
        setItemsEdit(itemsEdit.map(it => {
            if (it.producto_id !== productoId) return it
            const num = parseInt(it.precioTexto || '0')
            if (!it.precioTexto || isNaN(num) || num < it.precio) {
                return { ...it, precio_unitario: it.precio, precioTexto: String(it.precio) }
            }
            return it
        }))
    }

    const handleBlurCantidad = (productoId: string) => {
        setItemsEdit(itemsEdit.map(it =>
            it.producto_id === productoId && it.cantidad === '' ? { ...it, cantidad: 1 } : it
        ))
    }

    const resumenEdicion = useMemo(() => {
        const subtotal = itemsEdit.reduce((acc, it) => {
            const cant = typeof it.cantidad === 'number' ? it.cantidad : 0
            const precio = it.precio_unitario ?? it.precio
            return acc + (precio * cant)
        }, 0)
        const porcentaje = calcularDescuento(subtotal)
        const descuento = Math.round(subtotal * (porcentaje / 100))
        const total = subtotal - descuento
        return { subtotal, porcentaje, descuento, total }
    }, [itemsEdit])

    const guardarEdicion = async () => {
        if (procesando) return
        setErrorEdicion('')

        if (itemsEdit.length === 0) { setErrorEdicion('El pedido debe tener al menos 1 producto.'); return }
        const hayCantidadInvalida = itemsEdit.some(it =>
            it.cantidad === '' || typeof it.cantidad !== 'number' || it.cantidad <= 0
        )
        if (hayCantidadInvalida) { setErrorEdicion('Todas las cantidades deben ser mayores a 0.'); return }

        const itemsAjustados = itemsEdit.map(it => {
            const num = it.precio_unitario ?? 0
            if (!num || num < it.precio) return { ...it, precio_unitario: it.precio }
            return it
        })

        setProcesando(true)
        const { error } = await supabase.rpc('editar_pedido_completo', {
            p_pedido_id: pedido.id,
            p_items: itemsAjustados.map(it => ({
                producto_id: it.producto_id,
                cantidad: typeof it.cantidad === 'number' ? it.cantidad : 0,
                precio_unitario: it.precio_unitario,
            })),
        })
        setProcesando(false)

        if (error) { setErrorEdicion(error.message || 'Error al guardar'); return }

        setModoEdicion(false)
        setItemsEdit([])
        onRefresh()
        onClose()
    }

    const productosExcluidos = itemsEdit.map(it => it.producto_id).filter(Boolean)

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden relative">

                {/* HEADER */}
                <div className="shrink-0 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-3 p-5">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-lg font-bold text-[#232323]">Pedido #{String(pedido.id).slice(0, 8)}</h2>
                                {pedido.revertido && <span className="bg-orange-100 text-orange-700 border border-orange-300 px-2 py-0.5 rounded text-[10px] font-bold">🔄 REVERTIDO</span>}
                                {esDevuelto && <span className="bg-orange-100 text-orange-700 border border-orange-300 px-2 py-0.5 rounded text-[10px] font-bold">🔙 DEVUELTO</span>}
                                {esCancelado && <span className="bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded text-[10px] font-bold">CANCELADO</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-[#828282]">
                                {pedido.numero_cotizacion && <span className="font-mono text-[#1A0087] font-semibold">{pedido.numero_cotizacion}</span>}
                                {pedido.numero_factura && <><span>·</span><span className="text-blue-600 font-medium">{pedido.numero_factura}</span></>}
                                <span>·</span>
                                <span>{formatFecha(pedido.fecha)}</span>
                            </div>
                        </div>
                        <button onClick={modoEdicion ? cancelarEdicion : onClose} className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {modoEdicion && (
                        <div className="px-5 pb-3 space-y-2">
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                                <PencilIcon className="w-4 h-4 text-blue-600 shrink-0" />
                                <p className="text-xs text-blue-800 font-medium">Modo edición</p>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                                <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-800">
                                    Al guardar, el pedido volverá a <strong>pendiente</strong> para que cartera lo apruebe de nuevo. La cotización anterior se descarta.
                                </p>
                            </div>
                        </div>
                    )}

                    {!modoEdicion && (
                        <div className="flex border-t border-gray-100">
                            <TabButton active={tab === 'detalle'} onClick={() => setTab('detalle')} icon={<BanknotesIcon className="w-4 h-4" />} label="Detalle" />
                            <TabButton active={tab === 'timeline'} onClick={() => setTab('timeline')} icon={<ClockIcon className="w-4 h-4" />} label="Historial" />
                            <TabButton active={tab === 'cotizacion'} onClick={() => setTab('cotizacion')} icon={<DocumentTextIcon className="w-4 h-4" />} label="Cotización" />
                        </div>
                    )}
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto bg-[#F7F7FB]">

                    {errorAccion && (
                        <div className="m-5 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{errorAccion}</div>
                    )}

                    {/* MODO EDICIÓN */}
                    {modoEdicion && (
                        <div className="p-5 space-y-4">
                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <p className="text-xs font-semibold text-[#828282] uppercase mb-4">Productos ({itemsEdit.length})</p>

                                {itemsEdit.length === 0 ? (
                                    <p className="text-sm text-center text-[#828282] py-6">No hay productos.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {itemsEdit.map(it => {
                                            const cantNum = typeof it.cantidad === 'number' ? it.cantidad : 0
                                            const precioFinal = it.precio_unitario || it.precio
                                            const subtotalLinea = precioFinal * cantNum
                                            return (
                                                <div key={it.producto_id} className="p-3 bg-gray-50 rounded-xl space-y-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium text-[#232323] truncate">{it.nombre}</p>
                                                            <p className="text-[11px] text-[#828282] mt-0.5">Mínimo: {formatCOP(it.precio)} · subtotal {formatCOP(subtotalLinea)}</p>
                                                        </div>
                                                        <button onClick={() => eliminarProducto(it.producto_id)} disabled={procesando} className="w-9 h-9 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50">
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-[10px] text-[#828282] mb-1">Cantidad</label>
                                                            <input type="text" inputMode="numeric" value={it.cantidad} onChange={e => cambiarCantidad(it.producto_id, e.target.value)} onFocus={e => e.target.select()} onBlur={() => handleBlurCantidad(it.producto_id)} disabled={procesando} className="w-full border border-gray-300 rounded-lg p-2 text-sm text-center font-semibold" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] text-[#828282] mb-1">Precio unitario</label>
                                                            <input type="text" inputMode="numeric" value={it.precioTexto} onChange={e => cambiarPrecioTexto(it.producto_id, e.target.value)} onFocus={e => e.target.select()} onBlur={() => handleBlurPrecio(it.producto_id)} placeholder={String(it.precio)} disabled={procesando} className="w-full border border-gray-300 rounded-lg p-2 text-sm text-right font-semibold" />
                                                        </div>
                                                    </div>

                                                    {precioFinal > it.precio && (
                                                        <p className="text-[10px] text-green-700">↑ Subido {formatCOP(precioFinal - it.precio)} sobre el mínimo</p>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                <button onClick={() => setBuscadorAbierto(true)} disabled={procesando || cargandoProductos} className="mt-4 w-full min-h-[48px] py-3 border-2 border-dashed border-[#1A0087]/30 rounded-xl text-sm font-semibold text-[#1A0087] flex items-center justify-center gap-2">
                                    {cargandoProductos ? 'Cargando...' : <><PlusIcon className="w-5 h-5" />Agregar producto</>}
                                </button>
                            </div>

                            {errorEdicion && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                    <ExclamationTriangleIcon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-800">{errorEdicion}</p>
                                </div>
                            )}

                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <p className="text-xs font-semibold text-[#828282] uppercase mb-3">Resumen</p>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-[#828282]"><span>Subtotal</span><span>{formatCOP(resumenEdicion.subtotal)}</span></div>
                                    {resumenEdicion.porcentaje > 0 && (
                                        <div className="flex justify-between text-green-600"><span>Descuento ({resumenEdicion.porcentaje}%)</span><span>- {formatCOP(resumenEdicion.descuento)}</span></div>
                                    )}
                                    <div className="flex justify-between items-baseline pt-3 border-t border-gray-100 mt-2">
                                        <span className="font-semibold text-[#232323] text-base">Total</span>
                                        <span className="text-xl font-bold text-[#1A0087]">{formatCOP(resumenEdicion.total)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB DETALLE */}
                    {!modoEdicion && tab === 'detalle' && (
                        <div className="p-5 space-y-5">
                            <BarraProgreso estado={pedido.estado} esAdmin={esAdmin} onRetroceder={iniciarRetroceso} />

                            {pedido.revertido && (
                                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
                                    <ArrowPathIcon className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-orange-800 text-sm">Pedido revertido</p>
                                        {motivoReversion && <p className="text-xs text-orange-700 mt-1.5"><span className="font-semibold">Motivo:</span> {motivoReversion}</p>}
                                    </div>
                                </div>
                            )}

                            {esDevuelto && (
                                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
                                    <ArrowUturnLeftIcon className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-orange-800 text-sm">Devuelto por cartera</p>
                                        <p className="text-xs text-orange-700 mt-1">El admin debe revisarlo.</p>
                                    </div>
                                </div>
                            )}

                            {esCancelado && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                    <XMarkIcon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-red-800 text-sm">Pedido cancelado</p>
                                        {motivoCancelado && <p className="text-xs text-red-700 mt-1.5"><span className="font-semibold">Motivo:</span> {motivoCancelado}</p>}
                                    </div>
                                </div>
                            )}

                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-full bg-[#1A0087]/10 flex items-center justify-center shrink-0">
                                        <UserIcon className="w-6 h-6 text-[#1A0087]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-[#828282] uppercase mb-1">Cliente</p>
                                        <p className="font-semibold text-[#232323] text-base">{pedido.clientes?.nombre || 'Sin cliente'}</p>
                                        {pedido.clientes?.cc_nit && <p className="text-sm text-[#828282] mt-1">CC/NIT: {pedido.clientes.cc_nit}</p>}
                                        {pedido.clientes?.telefono && (
                                            <p className="text-sm text-[#828282] mt-0.5 flex items-center gap-1.5">
                                                <PhoneIcon className="w-3.5 h-3.5" />{pedido.clientes.telefono}
                                            </p>
                                        )}
                                        <p className="text-xs text-[#828282] mt-2">Vendedor: <span className="font-medium text-[#232323]">{pedido.usuarios?.nombre || 'N/A'}</span></p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-xs font-semibold text-[#828282] uppercase">Productos</p>
                                    <span className="text-xs text-[#828282] bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                                        {pedido.detalle_pedido.length} {pedido.detalle_pedido.length === 1 ? 'item' : 'items'}
                                    </span>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {pedido.detalle_pedido.map(d => {
                                        const cantidad = d.cantidad_aprobada ?? d.cantidad_solicitada
                                        const precioBase = d.productos.precio_mayorista ?? d.productos.precio
                                        const precioUnit = d.precio_unitario ?? precioBase
                                        const subido = d.precio_unitario != null && d.precio_unitario > precioBase

                                        return (
                                            <div key={d.id} className={`py-3 flex items-center justify-between gap-3 ${subido ? 'bg-red-50/50 -mx-2 px-2 rounded-lg' : ''}`}>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-[#232323] truncate">{d.productos.nombre}</p>
                                                    {d.productos.codigo && <p className="text-[11px] text-[#828282] font-mono mt-0.5">{d.productos.codigo}</p>}
                                                    {subido && (
                                                        <p className="text-[11px] mt-1 tabular-nums flex items-center gap-1 flex-wrap">
                                                            <span className="text-[#828282]">{formatCOP(precioBase)}</span>
                                                            <span className="text-[#828282]">→</span>
                                                            <span className="text-red-700 font-semibold">{formatCOP(precioUnit)}</span>
                                                            <span className="text-red-600 font-bold">*</span>
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-sm font-semibold text-[#232323] tabular-nums">×{cantidad}</p>
                                                    <p className={`text-xs tabular-nums ${subido ? 'text-red-700 font-semibold' : 'text-[#828282]'}`}>
                                                        {formatCOP(precioUnit)}{subido && <span className="text-red-600 font-bold ml-0.5">*</span>}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <p className="text-xs font-semibold text-[#828282] uppercase mb-3">Resumen</p>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-[#828282]"><span>Subtotal</span><span>{formatCOP(pedido.subtotal || 0)}</span></div>
                                    {pedido.descuento_porcentaje > 0 && (
                                        <div className="flex justify-between text-green-600"><span>Descuento ({pedido.descuento_porcentaje}%)</span><span>- {formatCOP(pedido.descuento_valor || 0)}</span></div>
                                    )}
                                    <div className="flex justify-between items-baseline pt-3 border-t border-gray-100 mt-2">
                                        <span className="font-semibold text-[#232323] text-base">Total</span>
                                        <span className="text-xl font-bold text-[#1A0087]">{formatCOP(pedido.total || 0)}</span>
                                    </div>
                                </div>
                            </div>

                            {pedido.observacion && (
                                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                    <p className="text-xs font-semibold text-[#828282] uppercase mb-2">Observación</p>
                                    <p className="text-sm text-[#232323] italic">"{pedido.observacion}"</p>
                                </div>
                            )}
                        </div>
                    )}

                    {!modoEdicion && tab === 'timeline' && (
                        <div className="p-5">
                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <PedidoTimeline pedidoId={pedido.id} estadoPedido={pedido.estado} />
                            </div>
                        </div>
                    )}

                    {!modoEdicion && tab === 'cotizacion' && (
                        <div className="p-5">
                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                                    <div>
                                        <p className="text-xs font-semibold text-[#828282] uppercase">{pedido.numero_cotizacion ? 'Cotización' : 'Borrador'}</p>
                                        <p className="font-mono text-[#1A0087] font-semibold mt-1 text-base">{pedido.numero_cotizacion || `#${String(pedido.id).slice(0, 8)}`}</p>
                                    </div>
                                    <CotizacionBadge estado={getEstadoCotizacion(pedido.estado)} numeroCotizacion={pedido.numero_cotizacion} />
                                </div>
                                <div className="space-y-2">
                                    {onVerCotizacion && (
                                        <button onClick={() => onVerCotizacion(pedido.id)} className="w-full min-h-[52px] py-3.5 bg-[#1A0087] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                                            <DocumentTextIcon className="w-5 h-5" />Ver cotización completa
                                        </button>
                                    )}
                                    <BotonDescargarPDF pedidoId={pedido.id} />
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* FOOTER */}
                <div className="shrink-0 border-t border-gray-100 bg-white p-4 space-y-2 max-h-[40vh] overflow-y-auto">
                    {modoEdicion ? (
                        <div className="flex flex-col-reverse sm:flex-row gap-2">
                            <button onClick={cancelarEdicion} disabled={procesando} className="w-full sm:w-auto px-5 py-3 border border-gray-200 rounded-xl text-sm font-medium min-h-[48px]">Cancelar</button>
                            <div className="hidden sm:block flex-1" />
                            <button onClick={guardarEdicion} disabled={procesando || itemsEdit.length === 0} className="w-full sm:w-auto px-5 py-3 bg-[#1A0087] text-white rounded-xl text-sm font-semibold min-h-[48px]">
                                {procesando ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* BOTONES DE BODEGUERO (SOLO SI ES SU ROL) */}
                            {pedido.estado === 'aprobado_cartera' && esBodeguero && (
                                <button onClick={handleAceptar} disabled={procesando} className="w-full min-h-[48px] px-4 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                                    {procesando ? 'Procesando...' : <><CheckIcon className="w-5 h-5" />Aceptar y empezar a alistar</>}
                                </button>
                            )}
                            {pedido.estado === 'en_preparacion' && esBodeguero && (
                                <button onClick={handleMarcarListo} disabled={procesando} className="w-full min-h-[48px] px-4 py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                                    {procesando ? 'Procesando...' : <><ArrowRightIcon className="w-5 h-5" />Marcar como listo para despacho</>}
                                </button>
                            )}
                            {pedido.estado === 'listo_para_despacho' && esBodeguero && (
                                <button onClick={handleDespachar} disabled={procesando} className="w-full min-h-[48px] px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                                    {procesando ? 'Despachando...' : <><TruckIcon className="w-5 h-5" />Despachar</>}
                                </button>
                            )}
                            {pedido.estado === 'despachado' && esBodeguero && (
                                <button onClick={handleMarcarEntregado} disabled={procesando} className="w-full min-h-[48px] px-4 py-3 bg-gray-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                                    {procesando ? 'Procesando...' : <><ArchiveBoxIcon className="w-5 h-5" />Marcar como entregado</>}
                                </button>
                            )}

                            {/* BOTONES EXCLUSIVOS DEL ADMIN (EDITAR, RECHAZAR, CANCELAR, DEVOLVER) */}
                            {esAdmin && !esCancelado && (
                                <div className="grid grid-cols-2 gap-2">
                                    {puedeEditar && (
                                        <button onClick={iniciarEdicion} className="min-h-[44px] px-4 py-2.5 border border-[#1A0087] rounded-xl text-[#1A0087] bg-white hover:bg-[#1A0087]/5 font-semibold text-sm flex items-center justify-center gap-2">
                                            <PencilIcon className="w-4 h-4" />Editar
                                        </button>
                                    )}
                                    {esRechazable && (
                                        <button onClick={() => { setMotivoRechazar(''); setConfirmadoRechazar(false); setErrorRechazar(''); setMostrarRechazar(true) }} className="min-h-[44px] px-4 py-2.5 border border-red-300 rounded-xl text-red-600 bg-white hover:bg-red-50 font-semibold text-sm flex items-center justify-center gap-2">
                                            <XCircleIcon className="w-4 h-4" />Rechazar
                                        </button>
                                    )}
                                </div>
                            )}

                            {esDevuelto && esAdmin && (
                                <button onClick={handleDevolverABodega} disabled={procesando} className="w-full min-h-[48px] px-4 py-3 bg-orange-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                                    <ArrowUturnLeftIcon className="w-4 h-4" />Devolver a bodega sin cambios
                                </button>
                            )}

                            {esAdmin && esCancelable && !esCancelado && !esRechazado && (
                                <button onClick={() => { setMotivoCancelar(''); setConfirmadoCancelar(false); setErrorCancelar(''); setMostrarCancelar(true) }} disabled={procesando} className="w-full min-h-[44px] px-4 py-2.5 border border-red-200 rounded-xl text-red-600 bg-white hover:bg-red-50 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                                    🗑️ Cancelar pedido definitivamente
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* MODALES SECUNDARIOS: CANCELAR, RECHAZAR, RETROCEDER */}
                {mostrarCancelar && (
                    <div className="absolute inset-0 bg-black/40 flex items-end sm:items-center justify-center z-10 p-0 sm:p-4">
                        <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                            <div className="p-5 border-b border-gray-100">
                                <h3 className="text-base font-bold text-[#232323]">Cancelar pedido</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Motivo <span className="text-red-500">*</span></label>
                                    <textarea value={motivoCancelar} onChange={e => setMotivoCancelar(e.target.value)} rows={3} disabled={procesando} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none" />
                                    <p className="text-[10px] text-[#828282] mt-1">{motivoCancelar.trim().length} / 10 mínimo</p>
                                </div>
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input type="checkbox" checked={confirmadoCancelar} onChange={e => setConfirmadoCancelar(e.target.checked)} disabled={procesando} className="mt-0.5 w-5 h-5 text-red-600 rounded" />
                                    <span className="text-sm">Entiendo que este pedido será cancelado.</span>
                                </label>
                                {errorCancelar && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{errorCancelar}</div>}
                            </div>
                            <div className="border-t p-4 flex gap-2">
                                <button onClick={() => setMostrarCancelar(false)} disabled={procesando} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium">Volver</button>
                                <button onClick={handleCancelar} disabled={procesando || motivoCancelar.trim().length < 10 || !confirmadoCancelar} className="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40">Confirmar</button>
                            </div>
                        </div>
                    </div>
                )}

                {mostrarRechazar && (
                    <div className="absolute inset-0 bg-black/40 flex items-end sm:items-center justify-center z-10 p-0 sm:p-4">
                        <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                            <div className="p-5 border-b border-gray-100">
                                <h3 className="text-base font-bold text-[#232323]">Rechazar pedido</h3>
                                <p className="text-xs text-[#828282] mt-0.5">El pedido quedará en rechazado_bodega.</p>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Motivo <span className="text-red-500">*</span></label>
                                    <textarea value={motivoRechazar} onChange={e => setMotivoRechazar(e.target.value)} rows={3} disabled={procesando} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none" />
                                    <p className="text-[10px] text-[#828282] mt-1">{motivoRechazar.trim().length} / 10 mínimo</p>
                                </div>
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input type="checkbox" checked={confirmadoRechazar} onChange={e => setConfirmadoRechazar(e.target.checked)} disabled={procesando} className="mt-0.5 w-5 h-5 text-red-600 rounded" />
                                    <span className="text-sm">Entiendo que este pedido será rechazado.</span>
                                </label>
                                {errorRechazar && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{errorRechazar}</div>}
                            </div>
                            <div className="border-t p-4 flex gap-2">
                                <button onClick={() => setMostrarRechazar(false)} disabled={procesando} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium">Volver</button>
                                <button onClick={confirmarRechazo} disabled={procesando || motivoRechazar.trim().length < 10 || !confirmadoRechazar} className="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40">Confirmar rechazo</button>
                            </div>
                        </div>
                    </div>
                )}

                {mostrarRetroceder && retrocesoDestino && (
                    <div className="absolute inset-0 bg-black/50 flex items-end sm:items-center justify-center z-20 p-0 sm:p-4">
                        <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                            <div className="p-5 border-b border-orange-100 bg-orange-50">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                                        <ArrowPathIcon className="w-5 h-5 text-orange-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-orange-900">⚠️ Retroceder pedido</h3>
                                        <p className="text-xs text-orange-700 mt-0.5">Esto revertirá el flujo del pedido y quedará registrado.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-[#828282]">Estado actual:</span>
                                        <span className="font-semibold text-[#232323]">{pedido.estado}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[#828282]">Nuevo estado:</span>
                                        <span className="font-semibold text-orange-700">{retrocesoDestino.key}</span>
                                    </div>
                                    <p className="text-[11px] text-[#828282] pt-2 border-t border-gray-200 mt-2">
                                        Volverá al paso "{retrocesoDestino.label}" de la barra de progreso.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[#232323] mb-2">
                                        Motivo del retroceso <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={motivoRetroceso}
                                        onChange={e => { setMotivoRetroceso(e.target.value); setErrorRetroceso('') }}
                                        placeholder="Explica por qué se retrocede el pedido (mín. 10 caracteres)"
                                        rows={3}
                                        disabled={procesando}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 resize-none"
                                    />
                                    <p className="text-[10px] text-[#828282] mt-1">{motivoRetroceso.trim().length} / 10 mínimo</p>
                                </div>

                                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-orange-50">
                                    <input
                                        type="checkbox"
                                        checked={confirmadoRetroceso}
                                        onChange={e => setConfirmadoRetroceso(e.target.checked)}
                                        disabled={procesando}
                                        className="mt-0.5 w-5 h-5 text-orange-600 rounded"
                                    />
                                    <span className="text-sm text-[#232323]">
                                        Entiendo que este retroceso cambiará el estado del pedido y quedará registrado en el historial.
                                    </span>
                                </label>

                                {errorRetroceso && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{errorRetroceso}</div>}
                            </div>

                            <div className="border-t p-4 flex flex-col-reverse sm:flex-row gap-2">
                                <button onClick={() => { setMostrarRetroceder(false); setRetrocesoDestino(null) }} disabled={procesando} className="w-full sm:w-auto px-5 py-3 border border-gray-200 rounded-xl text-sm font-medium min-h-[48px]">
                                    Cancelar
                                </button>
                                <div className="hidden sm:block flex-1" />
                                <button
                                    onClick={confirmarRetroceso}
                                    disabled={procesando || motivoRetroceso.trim().length < 10 || !confirmadoRetroceso}
                                    className="w-full sm:w-auto px-5 py-3 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[48px]"
                                >
                                    {procesando ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Retrocediendo...
                                        </>
                                    ) : (
                                        <>
                                            <ArrowPathIcon className="w-5 h-5" />
                                            Confirmar retroceso
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <ProductoBuscadorModal
                    abierto={buscadorAbierto}
                    onClose={() => setBuscadorAbierto(false)}
                    onSeleccionar={agregarProducto}
                    productosBase={productosBodega}
                    bodegaId={bodegaId}
                    formatCOP={formatCOP}
                    productosExcluidos={productosExcluidos}
                />
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────
// Botón de descarga directa de PDF
// ─────────────────────────────────────────────────────
function BotonDescargarPDF({ pedidoId }: { pedidoId: string }) {
    const [descargando, setDescargando] = useState(false)
    const [error, setError] = useState('')

    const handleDescargar = async () => {
        if (descargando) return
        setDescargando(true)
        setError('')
        try {
            const res = await fetch('/api/cotizacion/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pedidoId }),
            })
            const data = await res.json()
            if (!res.ok) { setError(data.error || 'Error'); setDescargando(false); return }
            if (data.pdfBase64) {
                const byteCharacters = atob(data.pdfBase64)
                const byteArray = new Uint8Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i)
                const blob = new Blob([byteArray], { type: 'application/pdf' })
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = data.nombreArchivo || 'cotizacion.pdf'
                document.body.appendChild(a); a.click(); a.remove()
                window.URL.revokeObjectURL(url)
            }
        } catch (e: any) { setError(e.message || 'Error') } finally { setDescargando(false) }
    }

    return (
        <>
            <button onClick={handleDescargar} disabled={descargando} className="w-full min-h-[48px] py-3 border border-[#1A0087] rounded-xl text-[#1A0087] bg-white hover:bg-[#1A0087]/5 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm">
                {descargando ? 'Generando...' : <><ArrowDownTrayIcon className="w-5 h-5" />Descargar PDF</>}
            </button>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">{error}</div>}
        </>
    )
}

// ─────────────────────────────────────────────────────
// Botón de pestaña
// ─────────────────────────────────────────────────────
function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-colors border-b-2 ${active ? 'text-[#1A0087] border-[#1A0087] bg-[#1A0087]/5' : 'text-[#828282] border-transparent hover:text-[#232323] hover:bg-gray-50'}`}
        >
            {icon}
            {label}
        </button>
    )
}