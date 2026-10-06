'use client'

import {
    XMarkIcon,
    LockClosedIcon,
    PlusIcon,
    MinusIcon,
} from '@heroicons/react/24/outline'
import type { ProductoBusqueda } from '@/lib/hooks/useBuscarProducto'

const STOCK_CONGELADO = 150

interface Props {
    index: number
    producto: ProductoBusqueda
    cantidad: string
    onCantidadChange: (index: number, cantidad: string) => void
    onEliminar: (index: number) => void
    formatCOP: (v: number) => string
}

export function ProductoSelector({
    index,
    producto,
    cantidad,
    onCantidadChange,
    onEliminar,
    formatCOP,
}: Props) {
    const cantNum = parseInt(cantidad || '0') || 0
    const congelado = producto.stock_disponible <= STOCK_CONGELADO
    const subtotal = producto.precio * cantNum

    const setCantidad = (n: number) => {
        if (n < 1) return
        const max = producto.stock_disponible
        if (n > max) n = max
        onCantidadChange(index, String(n))
    }

    const handleInputCantidad = (valor: string) => {
        const limpio = valor.replace(/\D/g, '')
        if (limpio === '') {
            onCantidadChange(index, '')
            return
        }
        const n = parseInt(limpio)
        const max = producto.stock_disponible
        onCantidadChange(index, String(Math.min(n, max)))
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 space-y-4">
                {/* Header: nombre + quitar */}
                <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#232323] leading-tight break-words">
                            {producto.nombre}
                        </p>
                        <p className="text-xs text-[#828282] mt-1 flex items-center gap-1.5 flex-wrap">
                            {producto.sku && <span className="font-mono">{producto.sku}</span>}
                            {producto.sku && <span>·</span>}
                            <span>{formatCOP(producto.precio)} c/u</span>
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => onEliminar(index)}
                        className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 active:bg-red-100 transition-colors"
                        aria-label="Quitar producto"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Congelado */}
                {congelado && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                        <LockClosedIcon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-700 font-medium leading-snug">
                            Producto congelado (stock ≤ {STOCK_CONGELADO}). No se puede pedir.
                        </p>
                    </div>
                )}

                {/* Cantidad */}
                {!congelado && (
                    <>
                        <div>
                            <label className="block text-xs font-medium text-[#828282] mb-2">
                                Cantidad · Stock: <span className="font-semibold">{producto.stock_disponible}</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCantidad(cantNum - 1)}
                                    disabled={cantNum <= 1}
                                    className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    aria-label="Restar"
                                >
                                    <MinusIcon className="w-4 h-4" />
                                </button>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={cantidad}
                                    onChange={(e) => handleInputCantidad(e.target.value)}
                                    className="flex-1 min-w-0 h-11 border border-gray-200 rounded-xl text-center text-base font-semibold text-[#232323] focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
                                    onKeyDown={(e) => {
                                        const permitidas = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
                                        if (permitidas.includes(e.key)) return
                                        if (e.ctrlKey || e.metaKey) return
                                        if (!/^\d$/.test(e.key)) e.preventDefault()
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setCantidad(cantNum + 1)}
                                    disabled={cantNum >= producto.stock_disponible}
                                    className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    aria-label="Sumar"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Subtotal */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                            <span className="text-xs font-medium text-[#828282]">Subtotal</span>
                            <span className="text-lg font-bold text-[#1A0087]">
                                {formatCOP(subtotal)}
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}