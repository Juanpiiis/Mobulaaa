'use client'

import { ChevronRightIcon } from '@heroicons/react/24/outline'

export interface PedidoCompacto {
    id: string
    estado: string
    fecha: string
    total: number
    numero_factura: string | null
    numero_cotizacion: string | null
    revertido: boolean
    usuarios: { nombre: string } | null
    clientes: { nombre: string; cc_nit: string } | null
    detalle_pedido: { cantidad_solicitada: number }[]
}

interface Props {
    pedido: PedidoCompacto
    onClick: () => void
}

const ESTADO_LABEL: Record<string, string> = {
    pendiente: 'Pendiente',
    aprobado_bodega: 'Aprobado bodega',
    rechazado_bodega: 'Rechazado',
    aprobado_cartera: 'Listo para despachar',
    rechazado_cartera: 'Rechazado',
    despachado: 'Despachado',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
}

const ESTADO_COLOR: Record<string, string> = {
    pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    aprobado_bodega: 'bg-blue-100 text-blue-800 border-blue-200',
    rechazado_bodega: 'bg-red-100 text-red-800 border-red-200',
    aprobado_cartera: 'bg-green-100 text-green-800 border-green-200',
    rechazado_cartera: 'bg-red-100 text-red-800 border-red-200',
    despachado: 'bg-purple-100 text-purple-800 border-purple-200',
    entregado: 'bg-gray-100 text-gray-800 border-gray-200',
    cancelado: 'bg-red-100 text-red-800 border-red-200',
}

const BARRA_COLOR: Record<string, string> = {
    pendiente: 'bg-yellow-400',
    aprobado_bodega: 'bg-blue-400',
    rechazado_bodega: 'bg-red-400',
    aprobado_cartera: 'bg-green-500',
    rechazado_cartera: 'bg-red-400',
    despachado: 'bg-purple-500',
    entregado: 'bg-gray-400',
    cancelado: 'bg-red-600',
}

export function PedidoCardCompacta({ pedido, onClick }: Props) {
    const formatCOP = (v: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)

    const totalItems = pedido.detalle_pedido?.reduce(
        (acc, d) => acc + (d.cantidad_solicitada || 0),
        0
    ) || 0

    const fecha = new Date(pedido.fecha)
    const fechaCorta = fecha.toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'short',
    })

    const barraColor = pedido.revertido ? 'bg-orange-500' : (BARRA_COLOR[pedido.estado] || 'bg-gray-300')

    return (
        <button
            onClick={onClick}
            className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all overflow-hidden flex items-stretch group active:scale-[0.99]"
        >
            <div className={`w-1 shrink-0 ${barraColor}`} />

            <div className="flex-1 min-w-0 p-4">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-[#232323] truncate text-sm">
                                {pedido.clientes?.nombre || 'Sin cliente'}
                            </p>
                            {pedido.revertido && (
                                <span className="bg-orange-100 text-orange-700 border border-orange-300 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 shrink-0">
                                    🔄 REVERTIDO
                                </span>
                            )}
                        </div>
                        {pedido.clientes?.cc_nit && (
                            <p className="text-[11px] text-[#828282] mt-0.5 truncate">
                                CC: {pedido.clientes.cc_nit}
                            </p>
                        )}
                    </div>
                    <span
                        className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${ESTADO_COLOR[pedido.estado] || 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                    >
                        {ESTADO_LABEL[pedido.estado] || pedido.estado}
                    </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-[11px] text-[#828282] mb-2">
                    <span className="font-medium">{fechaCorta}</span>
                    {pedido.numero_cotizacion && (
                        <>
                            <span>·</span>
                            <span className="font-mono text-[#1A0087] font-semibold">
                                {pedido.numero_cotizacion}
                            </span>
                        </>
                    )}
                    {pedido.numero_factura && (
                        <>
                            <span>·</span>
                            <span className="text-blue-600 font-medium">{pedido.numero_factura}</span>
                        </>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] text-[#828282]">
                            {totalItems} {totalItems === 1 ? 'item' : 'items'}
                        </span>
                        {pedido.usuarios?.nombre && (
                            <>
                                <span className="text-[#828282]">·</span>
                                <span className="text-[11px] text-[#828282] truncate">
                                    {pedido.usuarios.nombre}
                                </span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {pedido.total > 0 && (
                            <span className="text-sm font-bold text-[#1A0087]">
                                {formatCOP(pedido.total)}
                            </span>
                        )}
                        <ChevronRightIcon className="w-4 h-4 text-gray-400 group-hover:text-[#1A0087] transition-colors" />
                    </div>
                </div>
            </div>
        </button>
    )
}