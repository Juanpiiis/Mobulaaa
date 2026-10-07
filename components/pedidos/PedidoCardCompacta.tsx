'use client'

import { CheckIcon, XMarkIcon, ArrowPathIcon, StarIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/solid'

export interface PedidoCompacto {
    id: string
    estado: string
    fecha: string
    total: number
    numero_factura: string | null
    numero_cotizacion: string | null
    revertido: boolean
    importante?: boolean
    usuarios: { nombre: string } | null
    clientes: { nombre: string; cc_nit: string } | null
    detalle_pedido: {
        cantidad_solicitada: number
        cantidad_aprobada?: number | null
        productos?: {
            nombre: string
            codigo?: string | null
            precio?: number | null
        } | null
    }[]
}

interface Props {
    pedido: PedidoCompacto
    onClick: () => void
    acciones?: React.ReactNode
    esAdmin?: boolean
    onToggleImportante?: (pedidoId: string, importante: boolean) => void
}

const ESTADO_LABEL: Record<string, string> = {
    pendiente: 'Pendiente',
    aprobado_bodega: 'Aprobado bodega',
    rechazado_bodega: 'Rechazado',
    aprobado_cartera: 'Listo para despachar',
    rechazado_cartera: 'Rechazado',
    devuelto_por_cartera: 'Devuelto por cartera',
    despachado: 'Despachado',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
}

const ESTADO_PILL: Record<string, { pill: string; dot: string }> = {
    pendiente: { pill: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
    aprobado_bodega: { pill: 'bg-blue-50 text-blue-800 ring-blue-200', dot: 'bg-blue-500' },
    rechazado_bodega: { pill: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
    aprobado_cartera: { pill: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500' },
    rechazado_cartera: { pill: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
    devuelto_por_cartera: { pill: 'bg-orange-50 text-orange-800 ring-orange-200', dot: 'bg-orange-500' },
    despachado: { pill: 'bg-violet-50 text-violet-800 ring-violet-200', dot: 'bg-violet-500' },
    entregado: { pill: 'bg-gray-100 text-gray-700 ring-gray-200', dot: 'bg-gray-400' },
    cancelado: { pill: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
}

const ACENTO: Record<string, string> = {
    pendiente: 'bg-amber-400',
    aprobado_bodega: 'bg-blue-500',
    rechazado_bodega: 'bg-red-500',
    aprobado_cartera: 'bg-emerald-500',
    rechazado_cartera: 'bg-red-500',
    devuelto_por_cartera: 'bg-orange-500',
    despachado: 'bg-violet-500',
    entregado: 'bg-gray-300',
    cancelado: 'bg-red-500',
}

const PASOS = [
    { key: 'pendiente', label: 'Pedido' },
    { key: 'aprobado_bodega', label: 'Bodega' },
    { key: 'aprobado_cartera', label: 'Cartera' },
    { key: 'despachado', label: 'Enviado' },
    { key: 'entregado', label: 'Entregado' },
]

const formatCOP = (v: number) =>
    new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
    }).format(v)

const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

export function PedidoCardCompacta({
    pedido,
    onClick,
    acciones,
    esAdmin = false,
    onToggleImportante,
}: Props) {
    const esRechazado = ['cancelado', 'rechazado_bodega', 'rechazado_cartera'].includes(pedido.estado)
    const esDevuelto = pedido.estado === 'devuelto_por_cartera'
    const pasoActual = PASOS.findIndex(p => p.key === pedido.estado)

    const pill = ESTADO_PILL[pedido.estado] ?? ESTADO_PILL.entregado
    const acento = pedido.revertido
        ? 'bg-orange-500'
        : pedido.importante
            ? 'bg-amber-400'
            : (ACENTO[pedido.estado] ?? 'bg-gray-300')

    const totalItems = pedido.detalle_pedido.length
    const itemsMostrar = pedido.detalle_pedido.slice(0, 2)
    const itemsExtra = Math.max(0, totalItems - 2)
    const referencia = pedido.numero_factura || pedido.numero_cotizacion

    const puedeMarcarImportante = esAdmin && !esRechazado && !esDevuelto && pedido.estado !== 'despachado' && pedido.estado !== 'entregado'

    return (
        <article
            onClick={onClick}
            className={`relative w-full overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md cursor-pointer ${pedido.importante ? 'border-amber-200' : esDevuelto ? 'border-orange-200' : 'border-gray-200'
                }`}
        >
            <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${acento}`} />

            <div className="flex flex-col gap-4 px-5 py-4 sm:px-6 sm:py-5">
                <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2 flex-wrap">
                            <h3 className="truncate text-base font-semibold text-[#232323]">
                                {pedido.clientes?.nombre || 'Sin cliente'}
                            </h3>
                            {pedido.revertido && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700 ring-1 ring-inset ring-orange-200">
                                    <ArrowPathIcon className="h-3 w-3" />
                                    Revertido
                                </span>
                            )}
                            {esDevuelto && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700 ring-1 ring-inset ring-orange-200">
                                    <ArrowUturnLeftIcon className="h-3 w-3" />
                                    Devuelto
                                </span>
                            )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#828282]">
                            {pedido.clientes?.cc_nit && <span>CC {pedido.clientes.cc_nit}</span>}
                            {referencia && <span>{referencia}</span>}
                            <span>{formatFecha(pedido.fecha)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {esAdmin && onToggleImportante && puedeMarcarImportante && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onToggleImportante(pedido.id, !pedido.importante)
                                }}
                                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${pedido.importante
                                    ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                                    : 'bg-gray-100 text-gray-400 hover:bg-amber-50 hover:text-amber-500'
                                    }`}
                                aria-label={pedido.importante ? 'Quitar importante' : 'Marcar como importante'}
                                title={pedido.importante ? 'Quitar importante' : 'Marcar como importante'}
                            >
                                <StarIcon
                                    className="w-5 h-5"
                                    fill={pedido.importante ? 'currentColor' : 'none'}
                                    stroke="currentColor"
                                    strokeWidth={2}
                                />
                            </button>
                        )}

                        {!esAdmin && pedido.importante && (
                            <span
                                className="w-10 h-10 flex items-center justify-center text-amber-500 bg-amber-50 rounded-full"
                                title="Marcado como importante"
                            >
                                <StarIcon className="w-5 h-5" fill="currentColor" />
                            </span>
                        )}

                        <span
                            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${pill.pill}`}
                        >
                            <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
                            {ESTADO_LABEL[pedido.estado] || pedido.estado}
                        </span>
                    </div>
                </header>

                {/* Stepper: solo si NO es rechazado ni devuelto */}
                {!esRechazado && !esDevuelto && pasoActual >= 0 && (
                    <ol className="grid grid-cols-5" aria-label="Progreso del pedido">
                        {PASOS.map((paso, i) => {
                            const completado = i < pasoActual
                            const actual = i === pasoActual
                            return (
                                <li
                                    key={paso.key}
                                    className="relative flex min-w-0 flex-col items-center gap-1.5"
                                    aria-current={actual ? 'step' : undefined}
                                >
                                    {i < PASOS.length - 1 && (
                                        <span
                                            aria-hidden
                                            className={`absolute left-1/2 top-[9px] h-0.5 w-full ${completado ? 'bg-[#1A0087]' : 'bg-gray-200'
                                                }`}
                                        />
                                    )}
                                    <span
                                        className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full ${completado
                                            ? 'bg-[#1A0087] text-white'
                                            : actual
                                                ? 'bg-[#1A0087] ring-4 ring-[#1A0087]/15'
                                                : 'border-2 border-gray-200 bg-white'
                                            }`}
                                    >
                                        {completado && <CheckIcon className="h-3 w-3" />}
                                        {actual && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                                    </span>
                                    <span
                                        className={`w-full truncate text-center text-[11px] leading-tight ${actual ? 'font-semibold text-[#1A0087]' : 'text-[#828282]'
                                            }`}
                                    >
                                        {paso.label}
                                    </span>
                                </li>
                            )
                        })}
                    </ol>
                )}

                {esRechazado && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                        <XMarkIcon className="h-4 w-4 shrink-0" />
                        Pedido {ESTADO_LABEL[pedido.estado].toLowerCase()}
                    </div>
                )}

                {esDevuelto && (
                    <div className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700">
                        <ArrowUturnLeftIcon className="h-4 w-4 shrink-0" />
                        Cartera devolvió este pedido a bodega
                    </div>
                )}

                <section>
                    <p className="mb-2 text-xs font-medium text-[#828282]">
                        {totalItems} {totalItems === 1 ? 'producto' : 'productos'}
                    </p>
                    {itemsMostrar.length > 0 ? (
                        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                            {itemsMostrar.map((d, i) => {
                                const cantidad = d.cantidad_aprobada ?? d.cantidad_solicitada
                                const precio = d.productos?.precio ?? 0
                                const subtotalLinea = precio * cantidad

                                return (
                                    <li key={i} className="flex min-w-0 items-center gap-3 px-3 py-2.5">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm text-[#232323]">
                                                {d.productos?.nombre || 'Producto'}
                                            </p>
                                            {precio > 0 && (
                                                <p className="text-[11px] text-[#828282] mt-0.5 tabular-nums">
                                                    {formatCOP(precio)} c/u
                                                </p>
                                            )}
                                        </div>
                                        <span className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-[#232323]">
                                            ×{cantidad}
                                        </span>
                                        <span className="shrink-0 text-sm font-semibold tabular-nums text-[#232323] min-w-[80px] text-right">
                                            {formatCOP(subtotalLinea)}
                                        </span>
                                    </li>
                                )
                            })}
                            {itemsExtra > 0 && (
                                <li className="px-3 py-2 text-xs font-medium text-[#1A0087]">
                                    y {itemsExtra} {itemsExtra === 1 ? 'producto más' : 'productos más'}
                                </li>
                            )}
                        </ul>
                    ) : (
                        <p className="text-xs italic text-[#828282]">Sin productos</p>
                    )}
                </section>

                <footer className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
                    <div className="min-w-0">
                        <p className="text-xs text-[#828282]">Total</p>
                        <p className="truncate text-lg font-bold tabular-nums text-[#1A0087]">
                            {formatCOP(pedido.total || 0)}
                        </p>
                    </div>

                    {acciones && (
                        <div
                            onClick={e => e.stopPropagation()}
                            className="flex shrink-0 items-center gap-2"
                        >
                            {acciones}
                        </div>
                    )}
                </footer>
            </div>
        </article>
    )
}