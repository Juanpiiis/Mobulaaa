'use client'

import { useState, useEffect, useRef } from 'react'
import { MagnifyingGlassIcon, XMarkIcon, LockClosedIcon, PlusIcon, MinusIcon } from '@heroicons/react/24/outline'
import { useBuscarProducto, type ProductoBusqueda } from '@/lib/hooks/useBuscarProducto'

const STOCK_CONGELADO = 150

interface ItemPedido {
    producto_id: string
    cantidad: string
}

interface Props {
    index: number
    item: ItemPedido
    productosBase: ProductoBusqueda[]
    bodegaId: string | undefined
    onSelectProducto: (index: number, producto: ProductoBusqueda) => void
    onCantidadChange: (index: number, cantidad: string) => void
    onEliminar?: (index: number) => void
    mostrarEliminar: boolean
    formatCOP: (v: number) => string
}

export function ProductoSelector({
    index,
    item,
    productosBase,
    bodegaId,
    onSelectProducto,
    onCantidadChange,
    onEliminar,
    mostrarEliminar,
    formatCOP,
}: Props) {
    const [termino, setTermino] = useState('')
    const [abierto, setAbierto] = useState(false)
    const wrapRef = useRef<HTMLDivElement>(null)

    const productoSel = productosBase.find((p) => p.id === item.producto_id)
    const { resultados, buscando } = useBuscarProducto(termino, bodegaId, productosBase)

    useEffect(() => {
        if (item.producto_id) {
            setTermino('')
            setAbierto(false)
        }
    }, [item.producto_id])

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setAbierto(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const esCongelado = (p: ProductoBusqueda) => p.stock_disponible <= STOCK_CONGELADO

    const handleSelect = (p: ProductoBusqueda) => {
        if (esCongelado(p)) return
        onSelectProducto(index, p)
        setTermino('')
        setAbierto(false)
    }

    const cantNum = parseInt(item.cantidad || '0') || 0

    const setCantidad = (n: number) => {
        if (n < 1) return
        const max = productoSel?.stock_disponible ?? 9999
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
        const max = productoSel?.stock_disponible ?? 9999
        onCantidadChange(index, String(Math.min(n, max)))
    }

    const subtotal = productoSel && cantNum > 0 ? productoSel.precio * cantNum : 0
    const congelado = productoSel ? esCongelado(productoSel) : false

    return (
        <div
            ref={wrapRef}
            className={`relative bg-white rounded-2xl border border-gray-200 shadow-sm ${productoSel ? 'overflow-hidden' : (abierto ? 'z-30' : 'z-10')}`}
        >
            {/* Producto seleccionado */}
            {productoSel ? (
                <div className="p-4 space-y-4">
                    {/* Card producto */}
                    <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#232323] leading-tight break-words">
                                {productoSel.nombre}
                            </p>
                            <p className="text-xs text-[#828282] mt-1">
                                {formatCOP(productoSel.precio)}
                                <span className="mx-1.5">·</span>
                                Stock: <span className="font-medium">{productoSel.stock_disponible}</span>
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                onSelectProducto(index, {
                                    id: '', nombre: '', precio: 0, categoria: null, sku: null, stock_disponible: 0,
                                })
                                setTermino('')
                            }}
                            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            aria-label="Quitar producto"
                        >
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Aviso congelado */}
                    {congelado && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                            <LockClosedIcon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700 font-medium leading-snug">
                                Producto congelado (stock ≤ {STOCK_CONGELADO}). No se puede pedir.
                            </p>
                        </div>
                    )}

                    {/* Cantidad + subtotal */}
                    {!congelado && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-[#828282] mb-2">
                                    Cantidad
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
                                        value={item.cantidad}
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
                                        disabled={cantNum >= (productoSel.stock_disponible ?? 0)}
                                        className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        aria-label="Sumar"
                                    >
                                        <PlusIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                <span className="text-xs font-medium text-[#828282]">Subtotal</span>
                                <span className="text-lg font-bold text-[#1A0087]">
                                    {formatCOP(subtotal)}
                                </span>
                            </div>
                        </>
                    )}

                    {/* Botón eliminar fila (si hay varios) */}
                    {mostrarEliminar && onEliminar && (
                        <button
                            type="button"
                            onClick={() => onEliminar(index)}
                            className="w-full text-xs text-gray-400 hover:text-red-500 py-1 transition-colors"
                        >
                            Quitar esta fila
                        </button>
                    )}
                </div>
            ) : (
                /* Buscador */
                <div className="p-3">
                    <div className="relative">
                        <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            className="w-full border border-gray-200 rounded-xl pl-9 pr-10 py-3 text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
                            placeholder="Buscar producto..."
                            value={termino}
                            onChange={(e) => {
                                setTermino(e.target.value)
                                setAbierto(true)
                            }}
                            onFocus={() => setAbierto(true)}
                        />
                        {buscando && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                    </div>

                    {mostrarEliminar && onEliminar && (
                        <button
                            type="button"
                            onClick={() => onEliminar(index)}
                            className="mt-2 w-full text-xs text-gray-400 hover:text-red-500 py-1 transition-colors"
                        >
                            Quitar esta fila
                        </button>
                    )}

                    {/* Dropdown */}
                    {abierto && (
                        <div className="absolute z-30 left-0 right-0 mt-2 mx-3 bg-white border border-gray-200 rounded-xl max-h-72 overflow-y-auto shadow-2xl">
                            {resultados.length === 0 ? (
                                <p className="p-5 text-sm text-[#828282] text-center">
                                    {buscando ? 'Buscando…' : termino.length < 2 ? 'Escribe al menos 2 letras' : 'Sin resultados'}
                                </p>
                            ) : (
                                resultados.map((p) => {
                                    const congeladoItem = esCongelado(p)
                                    return (
                                        <button
                                            key={p.id}
                                            type="button"
                                            disabled={congeladoItem}
                                            onClick={() => handleSelect(p)}
                                            className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 transition-colors ${congeladoItem
                                                    ? 'bg-gray-50 cursor-not-allowed'
                                                    : 'hover:bg-[#1A0087]/5 active:bg-[#1A0087]/10'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p
                                                        className={`text-sm font-medium leading-tight break-words ${congeladoItem ? 'text-gray-400' : 'text-[#232323]'
                                                            }`}
                                                    >
                                                        {p.nombre}
                                                    </p>
                                                    <p className="text-xs text-[#828282] mt-0.5">
                                                        {p.categoria || 'Sin categoría'} · Stock {p.stock_disponible}
                                                    </p>
                                                </div>
                                                {congeladoItem ? (
                                                    <span className="flex items-center gap-1 text-xs font-semibold text-red-600 shrink-0">
                                                        <LockClosedIcon className="w-3.5 h-3.5" />
                                                        Congelado
                                                    </span>
                                                ) : (
                                                    <span className="text-sm font-semibold text-[#1A0087] shrink-0">
                                                        {formatCOP(p.precio)}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}