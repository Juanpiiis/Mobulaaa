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
} from '@heroicons/react/24/outline'

// ─────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────
interface DetallePedido {
    id: string
    cantidad_solicitada: number
    cantidad_aprobada: number | null
    producto_id: string
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

// ─────────────────────────────────────────────────────
// Barra de progreso
// ─────────────────────────────────────────────────────
const PASOS = [
    { key: 'pendiente', label: 'Pedido' },
    { key: 'aprobado_bodega', label: 'Bodega' },
    { key: 'aprobado_cartera', label: 'Cartera' },
    { key: 'despachado', label: 'Enviado' },
    { key: 'entregado', label: 'Entregado' },
]

function BarraProgreso({ estado }: { estado: string }) {
    const cancelado = ['rechazado_bodega', 'rechazado_cartera', 'cancelado'].includes(estado)
    const devuelto = estado === 'devuelto_por_cartera'
    const pasoActual = PASOS.findIndex(p => p.key === estado)

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
        <div className="bg-gray-50 rounded-xl p-5">
            <div className="flex items-start">
                {PASOS.map((paso, i) => {
                    const completado = i <= pasoActual
                    const esActual = i === pasoActual

                    return (
                        <div key={paso.key} className="flex items-center flex-1 last:flex-initial">
                            <div className="flex flex-col items-center gap-2">
                                <div
                                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${completado
                                        ? 'bg-[#1A0087] text-white'
                                        : 'bg-gray-200 text-gray-400'
                                        }`}
                                >
                                    {completado ? <CheckIcon className="w-4 h-4" /> : <span>{i + 1}</span>}
                                </div>
                                <span className={`text-[10px] font-medium whitespace-nowrap ${esActual ? 'text-[#1A0087]' : completado ? 'text-[#1A0087]/70' : 'text-gray-400'}`}>
                                    {paso.label}
                                </span>
                            </div>
                            {i < PASOS.length - 1 && (
                                <div className={`h-1 flex-1 mx-2 -mt-6 rounded ${i < pasoActual ? 'bg-[#1A0087]' : 'bg-gray-200'}`} />
                            )}
                        </div>
                    )
                })}
            </div>
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

    // Edición
    const [modoEdicion, setModoEdicion] = useState(false)
    const [itemsEdit, setItemsEdit] = useState<ItemEdit[]>([])
    const [buscadorAbierto, setBuscadorAbierto] = useState(false)
    const [errorEdicion, setErrorEdicion] = useState('')

    // Productos disponibles
    const [productosBodega, setProductosBodega] = useState<ProductoBusqueda[]>([])
    const [cargandoProductos, setCargandoProductos] = useState(false)

    // Cancelación
    const [mostrarCancelar, setMostrarCancelar] = useState(false)
    const [motivoCancelar, setMotivoCancelar] = useState('')
    const [confirmadoCancelar, setConfirmadoCancelar] = useState(false)
    const [errorCancelar, setErrorCancelar] = useState('')

    // Motivo de cancelación (si aplica)
    const [motivoCancelado, setMotivoCancelado] = useState<string | null>(null)
    const [fechaCancelado, setFechaCancelado] = useState<string | null>(null)

    // Motivo de reversión (si aplica)
    const [motivoReversion, setMotivoReversion] = useState<string | null>(null)
    const [fechaReversion, setFechaReversion] = useState<string | null>(null)

    const supabase = createClient()
    const bodegaId = pedido.bodega_id || pedido.bodegas?.id

    const esAdmin = rolActual === 'admin'
    const esBodeguero = rolActual === 'bodeguero' || esAdmin
    const esDevuelto = pedido.estado === 'devuelto_por_cartera'
    const esCancelado = pedido.estado === 'cancelado'
    const esRechazado = ['rechazado_bodega', 'rechazado_cartera'].includes(pedido.estado)
    const esCancelable = ['pendiente', 'aprobado_bodega', 'aprobado_cartera', 'devuelto_por_cartera'].includes(pedido.estado)

    const puedeEditar =
        (pedido.estado === 'pendiente' && esBodeguero) ||
        (esDevuelto && esAdmin)

    // Reset al cambiar de pedido
    useEffect(() => {
        setTab('detalle')
        setMostrarCancelar(false)
        setErrorEdicion('')

        if (abrirEnModoEdicion && (pedido.estado === 'pendiente' || pedido.estado === 'devuelto_por_cartera')) {
            setItemsEdit(
                pedido.detalle_pedido.map(d => ({
                    producto_id: d.producto_id,
                    cantidad: d.cantidad_solicitada,
                    nombre: d.productos.nombre,
                    precio: d.productos.precio,
                }))
            )
            setModoEdicion(true)
        } else {
            setModoEdicion(false)
        }
    }, [pedido.id, abrirEnModoEdicion])

    // Cargar productos de la bodega (CON CAMPOS NUEVOS)
    useEffect(() => {
        const cargar = async () => {
            if (!bodegaId) return
            if (productosBodega.length > 0) return
            setCargandoProductos(true)

            const { data } = await supabase
                .from('inventario')
                .select(`
                    cantidad_disponible,
                    productos!inner(
                        id, nombre, precio, categoria, sku,
                        congelado_manual, limite_congelado
                    )
                `)
                .eq('bodega_id', bodegaId)
                .gt('cantidad_disponible', 0)

            const items: ProductoBusqueda[] = (data || [])
                .map((i: any) => ({
                    id: i.productos?.id,
                    nombre: i.productos?.nombre,
                    precio: i.productos?.precio,
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

    // Cargar motivo de reversión
    useEffect(() => {
        const cargarMotivo = async () => {
            if (!pedido.revertido) {
                setMotivoReversion(null)
                setFechaReversion(null)
                return
            }

            const { data, error } = await supabase
                .from('pedidos_historial')
                .select('motivo_reversion, revertido_en, usuario_nombre')
                .eq('pedido_id', pedido.id)
                .eq('accion', 'despachado')
                .eq('revertido', true)
                .order('revertido_en', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (error) {
                console.error('Error cargando motivo de reversión:', error)
                return
            }

            if (data) {
                setMotivoReversion(data.motivo_reversion || 'Sin motivo especificado')
                setFechaReversion(data.revertido_en || null)
            }
        }
        cargarMotivo()
    }, [pedido.id, pedido.revertido, supabase])

    // Cargar motivo de cancelación
    useEffect(() => {
        const cargarMotivoCancelacion = async () => {
            if (pedido.estado !== 'cancelado') {
                setMotivoCancelado(null)
                setFechaCancelado(null)
                return
            }

            const { data, error } = await supabase
                .from('pedidos_historial')
                .select('observacion, cambios, fecha')
                .eq('pedido_id', pedido.id)
                .eq('accion', 'cancelado')
                .order('fecha', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (error) {
                console.error('Error cargando motivo de cancelación:', error)
                return
            }

            if (data) {
                const motivo = data.cambios?.motivo || data.observacion || 'Sin motivo especificado'
                setMotivoCancelado(motivo)
                setFechaCancelado(data.fecha || null)
            }
        }
        cargarMotivoCancelacion()
    }, [pedido.id, pedido.estado, supabase])

    // ─────────────────────────────────────────────────────
    // Edición
    // ─────────────────────────────────────────────────────
    const iniciarEdicion = () => {
        setItemsEdit(
            pedido.detalle_pedido.map(d => ({
                producto_id: d.producto_id,
                cantidad: d.cantidad_solicitada,
                nombre: d.productos.nombre,
                precio: d.productos.precio,
            }))
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
        setItemsEdit([...itemsEdit, { producto_id: p.id, cantidad: 1, nombre: p.nombre, precio: p.precio }])
        setErrorEdicion('')
    }

    const eliminarProducto = (productoId: string) => {
        setItemsEdit(itemsEdit.filter(it => it.producto_id !== productoId))
        setErrorEdicion('')
    }

    const cambiarCantidad = (productoId: string, valor: string) => {
        const soloNumeros = valor.replace(/\D/g, '')
        if (soloNumeros === '') {
            setItemsEdit(itemsEdit.map(it =>
                it.producto_id === productoId ? { ...it, cantidad: '' } : it
            ))
            setErrorEdicion('')
            return
        }
        const num = parseInt(soloNumeros)
        if (num === 0) {
            setItemsEdit(itemsEdit.filter(it => it.producto_id !== productoId))
            setErrorEdicion('')
            return
        }
        setItemsEdit(itemsEdit.map(it =>
            it.producto_id === productoId ? { ...it, cantidad: num } : it
        ))
        setErrorEdicion('')
    }

    const handleBlurCantidad = (productoId: string) => {
        setItemsEdit(itemsEdit.map(it =>
            it.producto_id === productoId && it.cantidad === ''
                ? { ...it, cantidad: 1 }
                : it
        ))
    }

    const resumenEdicion = useMemo(() => {
        const subtotal = itemsEdit.reduce((acc, it) => {
            const cant = typeof it.cantidad === 'number' ? it.cantidad : 0
            return acc + (it.precio * cant)
        }, 0)
        const porcentaje = calcularDescuento(subtotal)
        const descuento = Math.round(subtotal * (porcentaje / 100))
        const total = subtotal - descuento
        return { subtotal, porcentaje, descuento, total }
    }, [itemsEdit])

    const guardarEdicion = async () => {
        if (procesando) return
        setErrorEdicion('')

        if (itemsEdit.length === 0) {
            setErrorEdicion('El pedido debe tener al menos 1 producto. Si quieres vaciarlo, cancela el pedido.')
            return
        }

        const hayCantidadInvalida = itemsEdit.some(it =>
            it.cantidad === '' || typeof it.cantidad !== 'number' || it.cantidad <= 0
        )
        if (hayCantidadInvalida) {
            setErrorEdicion('Todas las cantidades deben ser mayores a 0. Verifica los productos.')
            return
        }

        setProcesando(true)

        const { data, error } = await supabase.rpc('editar_pedido_completo', {
            p_pedido_id: pedido.id,
            p_items: itemsEdit.map(it => ({
                producto_id: it.producto_id,
                cantidad: typeof it.cantidad === 'number' ? it.cantidad : 0,
            })),
        })

        setProcesando(false)

        if (error) {
            console.error('Error RPC:', error)
            setErrorEdicion(error.message || 'Error al guardar los cambios')
            return
        }

        if (esDevuelto) {
            await supabase
                .from('pedidos')
                .update({ estado: 'pendiente' })
                .eq('id', pedido.id)
        }

        const { registrarCambioHistorial } = await import('@/lib/utils/historial')
        await registrarCambioHistorial({
            pedidoId: pedido.id,
            accion: 'editado',
            estadoAnterior: pedido.estado,
            estadoNuevo: esDevuelto ? 'pendiente' : pedido.estado,
            observacion: esDevuelto
                ? `Pedido devuelto por cartera, editado por admin y devuelto a bodega`
                : `Pedido editado (${itemsEdit.length} ${itemsEdit.length === 1 ? 'producto' : 'productos'})`,
            cambios: {
                productos_modificados: itemsEdit.map(it => ({
                    producto_id: it.producto_id,
                    cantidad: it.cantidad,
                })),
            },
        })

        setModoEdicion(false)
        setItemsEdit([])
        onRefresh()
        onClose()
    }

    // ─────────────────────────────────────────────────────
    // Devolver a bodega
    // ─────────────────────────────────────────────────────
    const handleDevolverABodega = async () => {
        if (procesando) return
        setProcesando(true)

        const { error } = await supabase
            .from('pedidos')
            .update({ estado: 'pendiente' })
            .eq('id', pedido.id)

        if (error) {
            console.error('Error devolviendo a bodega:', error)
            alert('Error al devolver a bodega: ' + error.message)
            setProcesando(false)
            return
        }

        const { registrarCambioHistorial } = await import('@/lib/utils/historial')
        await registrarCambioHistorial({
            pedidoId: pedido.id,
            accion: 'editado',
            estadoAnterior: 'devuelto_por_cartera',
            estadoNuevo: 'pendiente',
            observacion: 'Admin devolvió el pedido a bodega sin cambios',
        })

        setProcesando(false)
        onRefresh()
        onClose()
    }

    // ─────────────────────────────────────────────────────
    // Cancelación
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

    const productosExcluidos = itemsEdit.map(it => it.producto_id).filter(Boolean)

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden relative">

                {/* HEADER */}
                <div className="shrink-0 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-3 p-5">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-lg font-bold text-[#232323]">
                                    Pedido #{String(pedido.id).slice(0, 8)}
                                </h2>
                                {pedido.revertido && (
                                    <span className="bg-orange-100 text-orange-700 border border-orange-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                                        🔄 REVERTIDO
                                    </span>
                                )}
                                {esDevuelto && (
                                    <span className="bg-orange-100 text-orange-700 border border-orange-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                                        🔙 DEVUELTO POR CARTERA
                                    </span>
                                )}
                                {esCancelado && (
                                    <span className="bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded text-[10px] font-bold">
                                        CANCELADO
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-[#828282]">
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
                                <span>{formatFecha(pedido.fecha)}</span>
                            </div>
                        </div>
                        <button
                            onClick={modoEdicion ? cancelarEdicion : onClose}
                            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                            aria-label="Cerrar"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {modoEdicion && (
                        <div className="px-5 pb-3">
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                                <PencilIcon className="w-4 h-4 text-blue-600 shrink-0" />
                                <p className="text-xs text-blue-800 font-medium">
                                    Modo edición — cambia cantidades, agrega o elimina productos
                                </p>
                            </div>
                        </div>
                    )}

                    {!modoEdicion && (
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
                    )}
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto bg-[#F7F7FB]">

                    {/* MODO EDICIÓN */}
                    {modoEdicion && (
                        <div className="p-5 space-y-4">
                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-xs font-semibold text-[#828282] uppercase tracking-wide">
                                        Productos ({itemsEdit.length})
                                    </p>
                                </div>

                                {itemsEdit.length === 0 ? (
                                    <p className="text-sm text-center text-[#828282] py-6">
                                        No hay productos. Agrega al menos uno para continuar.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {itemsEdit.map(it => {
                                            const cantNum = typeof it.cantidad === 'number' ? it.cantidad : 0
                                            const subtotalLinea = it.precio * cantNum
                                            return (
                                                <div
                                                    key={it.producto_id}
                                                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium text-[#232323] truncate">
                                                            {it.nombre}
                                                        </p>
                                                        {it.precio > 0 && (
                                                            <p className="text-[11px] text-[#828282] mt-0.5 tabular-nums">
                                                                {formatCOP(it.precio)} c/u · subtotal {formatCOP(subtotalLinea)}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        value={it.cantidad}
                                                        onChange={e => cambiarCantidad(it.producto_id, e.target.value)}
                                                        onFocus={e => e.target.select()}
                                                        onBlur={() => handleBlurCantidad(it.producto_id)}
                                                        disabled={procesando}
                                                        className="w-16 border border-gray-300 rounded-lg p-2 text-sm text-center font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1A0087]/30 focus:border-[#1A0087] disabled:opacity-50"
                                                        aria-label={`Cantidad de ${it.nombre}`}
                                                    />

                                                    <button
                                                        type="button"
                                                        onClick={() => eliminarProducto(it.producto_id)}
                                                        disabled={procesando}
                                                        className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 active:bg-red-100 disabled:opacity-50 transition-colors"
                                                        aria-label={`Eliminar ${it.nombre}`}
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setBuscadorAbierto(true)}
                                    disabled={procesando || cargandoProductos}
                                    className="mt-4 w-full min-h-[48px] py-3 border-2 border-dashed border-[#1A0087]/30 rounded-xl text-sm font-semibold text-[#1A0087] hover:bg-[#1A0087]/5 active:bg-[#1A0087]/10 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                                >
                                    {cargandoProductos ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
                                            Cargando...
                                        </>
                                    ) : (
                                        <>
                                            <PlusIcon className="w-5 h-5" />
                                            Agregar producto
                                        </>
                                    )}
                                </button>
                            </div>

                            {errorEdicion && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                    <ExclamationTriangleIcon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-800">{errorEdicion}</p>
                                </div>
                            )}

                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <p className="text-xs font-semibold text-[#828282] uppercase tracking-wide mb-3">
                                    Resumen
                                </p>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-[#828282]">
                                        <span>Subtotal</span>
                                        <span className="tabular-nums">{formatCOP(resumenEdicion.subtotal)}</span>
                                    </div>
                                    {resumenEdicion.porcentaje > 0 && (
                                        <div className="flex justify-between text-green-600">
                                            <span>Descuento ({resumenEdicion.porcentaje}%)</span>
                                            <span className="tabular-nums">- {formatCOP(resumenEdicion.descuento)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-baseline pt-3 border-t border-gray-100 mt-2">
                                        <span className="font-semibold text-[#232323] text-base">Total</span>
                                        <span className="text-xl font-bold text-[#1A0087] tabular-nums">
                                            {formatCOP(resumenEdicion.total)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB DETALLE */}
                    {!modoEdicion && tab === 'detalle' && (
                        <div className="p-5 space-y-5">
                            <BarraProgreso estado={pedido.estado} />

                            {pedido.revertido && (
                                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
                                    <ArrowPathIcon className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-orange-800 text-sm">Pedido revertido</p>

                                        {motivoReversion ? (
                                            <>
                                                <p className="text-xs text-orange-700 mt-1.5">
                                                    <span className="font-semibold">Motivo:</span> {motivoReversion}
                                                </p>
                                                {fechaReversion && (
                                                    <p className="text-[10px] text-orange-600 mt-1">
                                                        Revertido el {new Date(fechaReversion).toLocaleString('es-CO', {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-xs text-orange-700 mt-1">
                                                Cargando motivo...
                                            </p>
                                        )}

                                        <p className="text-[11px] text-orange-600 mt-2 italic">
                                            Verifica las cantidades antes de volver a despachar.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {esDevuelto && (
                                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
                                    <ArrowUturnLeftIcon className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-orange-800 text-sm">Devuelto por cartera</p>
                                        <p className="text-xs text-orange-700 mt-1">
                                            Cartera devolvió este pedido. El admin debe revisarlo y decidir si devolverlo a bodega o cancelarlo.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {esCancelado && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                    <XMarkIcon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-red-800 text-sm">Pedido cancelado</p>
                                        {motivoCancelado ? (
                                            <>
                                                <p className="text-xs text-red-700 mt-1.5">
                                                    <span className="font-semibold">Motivo:</span> {motivoCancelado}
                                                </p>
                                                {fechaCancelado && (
                                                    <p className="text-[10px] text-red-600 mt-1">
                                                        Cancelado el {new Date(fechaCancelado).toLocaleString('es-CO', {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-xs text-red-700 mt-1">
                                                Cargando motivo...
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-full bg-[#1A0087]/10 flex items-center justify-center shrink-0">
                                        <UserIcon className="w-6 h-6 text-[#1A0087]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-[#828282] uppercase tracking-wide mb-1">
                                            Cliente
                                        </p>
                                        <p className="font-semibold text-[#232323] text-base">
                                            {pedido.clientes?.nombre || 'Sin cliente'}
                                        </p>
                                        {pedido.clientes?.cc_nit && (
                                            <p className="text-sm text-[#828282] mt-1">
                                                CC/NIT: {pedido.clientes.cc_nit}
                                            </p>
                                        )}
                                        {pedido.clientes?.telefono && (
                                            <p className="text-sm text-[#828282] mt-0.5 flex items-center gap-1.5">
                                                <PhoneIcon className="w-3.5 h-3.5" />
                                                {pedido.clientes.telefono}
                                            </p>
                                        )}
                                        <p className="text-xs text-[#828282] mt-2">
                                            Vendedor: <span className="font-medium text-[#232323]">{pedido.usuarios?.nombre || 'N/A'}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-xs font-semibold text-[#828282] uppercase tracking-wide">
                                        Productos
                                    </p>
                                    <span className="text-xs text-[#828282] bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                                        {pedido.detalle_pedido.length} {pedido.detalle_pedido.length === 1 ? 'item' : 'items'}
                                    </span>
                                </div>

                                <div className="divide-y divide-gray-100">
                                    {pedido.detalle_pedido.map(d => {
                                        const cantidad = d.cantidad_aprobada ?? d.cantidad_solicitada
                                        return (
                                            <div key={d.id} className="py-3 flex items-center justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-[#232323] truncate">
                                                        {d.productos.nombre}
                                                    </p>
                                                    {d.productos.codigo && (
                                                        <p className="text-[11px] text-[#828282] font-mono mt-0.5">
                                                            {d.productos.codigo}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-sm font-semibold text-[#232323] tabular-nums">
                                                        ×{cantidad}
                                                    </p>
                                                    <p className="text-xs text-[#828282] tabular-nums">
                                                        {formatCOP(d.productos.precio)}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <p className="text-xs font-semibold text-[#828282] uppercase tracking-wide mb-3">
                                    Resumen
                                </p>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-[#828282]">
                                        <span>Subtotal</span>
                                        <span className="tabular-nums">{formatCOP(pedido.subtotal || 0)}</span>
                                    </div>
                                    {pedido.descuento_porcentaje > 0 && (
                                        <div className="flex justify-between text-green-600">
                                            <span>Descuento ({pedido.descuento_porcentaje}%)</span>
                                            <span className="tabular-nums">- {formatCOP(pedido.descuento_valor || 0)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-baseline pt-3 border-t border-gray-100 mt-2">
                                        <span className="font-semibold text-[#232323] text-base">Total</span>
                                        <span className="text-xl font-bold text-[#1A0087] tabular-nums">
                                            {formatCOP(pedido.total || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {pedido.observacion && (
                                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                    <p className="text-xs font-semibold text-[#828282] uppercase tracking-wide mb-2">
                                        Observación
                                    </p>
                                    <p className="text-sm text-[#232323] italic">
                                        "{pedido.observacion}"
                                    </p>
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
                                        <p className="text-xs font-semibold text-[#828282] uppercase tracking-wide">
                                            {pedido.numero_cotizacion ? 'Cotización' : 'Borrador de cotización'}
                                        </p>
                                        <p className="font-mono text-[#1A0087] font-semibold mt-1 text-base">
                                            {pedido.numero_cotizacion || `Borrador #${String(pedido.id).slice(0, 8)}`}
                                        </p>
                                    </div>
                                    <CotizacionBadge
                                        estado={getEstadoCotizacion(pedido.estado)}
                                        numeroCotizacion={pedido.numero_cotizacion}
                                    />
                                </div>

                                {!pedido.numero_cotizacion && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                                        <span className="text-yellow-600 text-sm shrink-0">⚠️</span>
                                        <div>
                                            <p className="text-xs font-semibold text-yellow-800">
                                                Cotización borrador
                                            </p>
                                            <p className="text-[11px] text-yellow-700 mt-0.5">
                                                Esta cotización aún no es oficial. Se generará el número COT cuando cartera la apruebe.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-1.5 text-sm">
                                    <div className="flex justify-between text-[#828282]">
                                        <span>Cliente</span>
                                        <span className="font-medium text-[#232323] truncate max-w-[60%] text-right">
                                            {pedido.clientes?.nombre || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[#828282]">
                                        <span>Productos</span>
                                        <span className="font-medium text-[#232323]">
                                            {pedido.detalle_pedido.length}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[#828282]">
                                        <span>Subtotal</span>
                                        <span className="font-medium text-[#232323] tabular-nums">
                                            {formatCOP(pedido.subtotal || 0)}
                                        </span>
                                    </div>
                                    {pedido.descuento_porcentaje > 0 && (
                                        <div className="flex justify-between text-green-600">
                                            <span>Descuento ({pedido.descuento_porcentaje}%)</span>
                                            <span className="tabular-nums">- {formatCOP(pedido.descuento_valor || 0)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-baseline pt-2 border-t border-gray-200 mt-2">
                                        <span className="font-semibold text-[#232323]">Total</span>
                                        <span className="text-lg font-bold text-[#1A0087] tabular-nums">
                                            {formatCOP(pedido.total || 0)}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {onVerCotizacion && (
                                        <button
                                            onClick={() => onVerCotizacion(pedido.id)}
                                            className="w-full min-h-[52px] py-3.5 bg-[#1A0087] text-white rounded-xl text-sm font-semibold hover:bg-[#130066] active:scale-[0.98] flex items-center justify-center gap-2 transition-all"
                                        >
                                            <DocumentTextIcon className="w-5 h-5" />
                                            {pedido.numero_cotizacion ? 'Ver cotización completa' : 'Ver borrador'}
                                        </button>
                                    )}

                                    <BotonDescargarPDF pedidoId={pedido.id} />
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* FOOTER */}
                <div className="shrink-0 border-t border-gray-100 bg-white p-4">
                    {modoEdicion ? (
                        <div className="flex flex-col-reverse sm:flex-row gap-2">
                            <button
                                onClick={cancelarEdicion}
                                disabled={procesando}
                                className="w-full sm:w-auto px-5 py-3 border border-gray-200 rounded-xl text-sm font-medium text-[#232323] bg-white hover:bg-gray-50 disabled:opacity-50 min-h-[48px]"
                            >
                                Cancelar
                            </button>
                            <div className="hidden sm:block flex-1" />
                            <button
                                onClick={guardarEdicion}
                                disabled={procesando || itemsEdit.length === 0}
                                className="w-full sm:w-auto px-5 py-3 bg-[#1A0087] text-white rounded-xl text-sm font-semibold hover:bg-[#130066] disabled:opacity-50 min-h-[48px] flex items-center justify-center gap-2 transition-all"
                            >
                                {procesando ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <CheckIcon className="w-5 h-5" />
                                        Guardar cambios
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <>
                            {puedeEditar && (
                                <button
                                    onClick={iniciarEdicion}
                                    className="w-full mb-2 min-h-[48px] px-4 py-3 border border-[#1A0087] rounded-xl text-[#1A0087] bg-white hover:bg-[#1A0087]/5 active:scale-[0.98] font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                                >
                                    <PencilIcon className="w-4 h-4" />
                                    Editar pedido
                                </button>
                            )}
                            {esDevuelto && esAdmin && !modoEdicion && (
                                <button
                                    onClick={handleDevolverABodega}
                                    disabled={procesando}
                                    className="w-full mb-2 min-h-[48px] px-4 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 active:scale-[0.98] font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                >
                                    <ArrowUturnLeftIcon className="w-4 h-4" />
                                    Devolver a bodega sin cambios
                                </button>
                            )}
                            {esAdmin && esCancelable && !esCancelado && !esRechazado && (
                                <button
                                    onClick={() => {
                                        setMotivoCancelar('')
                                        setConfirmadoCancelar(false)
                                        setErrorCancelar('')
                                        setMostrarCancelar(true)
                                    }}
                                    disabled={procesando}
                                    className="w-full min-h-[44px] px-4 py-2.5 border border-red-200 rounded-xl text-red-600 bg-white hover:bg-red-50 active:scale-[0.98] font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                                >
                                    🗑️ Cancelar pedido definitivamente
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* MODAL CANCELAR */}
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
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800">
                                    <p className="font-semibold mb-2">⚠️ ¿Qué va a pasar?</p>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>El pedido quedará en estado <strong>cancelado</strong></li>
                                        <li>Ya no aparecerá en "En proceso"</li>
                                        <li>Se moverá al historial con badge CANCELADO</li>
                                        <li><strong>No se devuelve stock</strong> al inventario</li>
                                    </ul>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[#232323] mb-2">
                                        Motivo de la cancelación <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={motivoCancelar}
                                        onChange={(e) => setMotivoCancelar(e.target.value)}
                                        placeholder="Ej: Cliente canceló el pedido, error en la creación, etc."
                                        rows={3}
                                        disabled={procesando}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 resize-none"
                                    />
                                    <p className="text-[10px] text-[#828282] mt-1">
                                        {motivoCancelar.trim().length} / 10 caracteres mínimo
                                    </p>
                                </div>

                                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50">
                                    <input
                                        type="checkbox"
                                        checked={confirmadoCancelar}
                                        onChange={(e) => setConfirmadoCancelar(e.target.checked)}
                                        disabled={procesando}
                                        className="mt-0.5 w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                    />
                                    <span className="text-sm text-[#232323]">
                                        Entiendo que este pedido será cancelado definitivamente.
                                    </span>
                                </label>

                                {errorCancelar && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                                        {errorCancelar}
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-gray-100 p-4 flex flex-col-reverse sm:flex-row gap-2">
                                <button
                                    onClick={() => setMostrarCancelar(false)}
                                    disabled={procesando}
                                    className="w-full sm:w-auto px-5 py-3 border border-gray-200 rounded-xl text-sm font-medium text-[#232323] bg-white hover:bg-gray-50 disabled:opacity-50 min-h-[48px]"
                                >
                                    Volver
                                </button>
                                <div className="hidden sm:block flex-1" />
                                <button
                                    onClick={handleCancelar}
                                    disabled={procesando || motivoCancelar.trim().length < 10 || !confirmadoCancelar}
                                    className="w-full sm:w-auto px-5 py-3 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[48px] transition-all"
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

                {/* BUSCADOR DE PRODUCTO */}
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

            if (!res.ok) {
                setError(data.error || 'Error al generar el PDF')
                setDescargando(false)
                return
            }

            if (data.pdfBase64) {
                const byteCharacters = atob(data.pdfBase64)
                const byteArray = new Uint8Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteArray[i] = byteCharacters.charCodeAt(i)
                }
                const blob = new Blob([byteArray], { type: 'application/pdf' })
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = data.nombreArchivo || 'cotizacion.pdf'
                document.body.appendChild(a)
                a.click()
                a.remove()
                window.URL.revokeObjectURL(url)
            }
        } catch (e: any) {
            setError(e.message || 'Error inesperado')
        } finally {
            setDescargando(false)
        }
    }

    return (
        <>
            <button
                onClick={handleDescargar}
                disabled={descargando}
                className="w-full min-h-[48px] py-3 border border-[#1A0087] rounded-xl text-[#1A0087] bg-white hover:bg-[#1A0087]/5 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 transition-all font-semibold text-sm"
            >
                {descargando ? (
                    <>
                        <div className="w-4 h-4 border-2 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
                        Generando PDF...
                    </>
                ) : (
                    <>
                        <ArrowDownTrayIcon className="w-5 h-5" />
                        Descargar PDF
                    </>
                )}
            </button>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                    {error}
                </div>
            )}
        </>
    )
}

// ─────────────────────────────────────────────────────
// Botón de pestaña
// ─────────────────────────────────────────────────────
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
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-colors border-b-2 ${active
                ? 'text-[#1A0087] border-[#1A0087] bg-[#1A0087]/5'
                : 'text-[#828282] border-transparent hover:text-[#232323] hover:bg-gray-50'
                }`}
        >
            {icon}
            {label}
        </button>
    )
}