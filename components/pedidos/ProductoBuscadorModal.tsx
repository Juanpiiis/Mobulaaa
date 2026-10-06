'use client'

import { useState, useEffect, useMemo } from 'react'
import {
    XMarkIcon,
    MagnifyingGlassIcon,
    LockClosedIcon,
    PlusIcon,
} from '@heroicons/react/24/outline'
import { useBuscarProducto, type ProductoBusqueda } from '@/lib/hooks/useBuscarProducto'

const STOCK_CONGELADO = 150

interface Props {
    abierto: boolean
    onClose: () => void
    onSeleccionar: (producto: ProductoBusqueda) => void
    productosBase: ProductoBusqueda[]
    bodegaId: string | undefined
    formatCOP: (v: number) => string
    productosExcluidos?: string[]
}

export function ProductoBuscadorModal({
    abierto,
    onClose,
    onSeleccionar,
    productosBase,
    bodegaId,
    formatCOP,
    productosExcluidos = [],
}: Props) {
    const [termino, setTermino] = useState('')
    const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null)

    const { resultados, buscando } = useBuscarProducto(termino, bodegaId, productosBase)

    // Reset al abrir
    useEffect(() => {
        if (abierto) {
            setTermino('')
            setCategoriaActiva(null)
        }
    }, [abierto])

    // Lista de categorías únicas (solo de los productos que existen)
    const categorias = useMemo(() => {
        const set = new Set<string>()
        productosBase.forEach(p => {
            if (p.categoria && p.categoria.trim()) set.add(p.categoria.trim())
        })
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [productosBase])

    if (!abierto) return null

    const esCongelado = (p: ProductoBusqueda) => p.stock_disponible <= STOCK_CONGELADO

    // 1. Filtrar por categoría + excluir los que ya están en el pedido
    let filtrados = resultados.filter(p => !productosExcluidos.includes(p.id))
    if (categoriaActiva) {
        filtrados = filtrados.filter(p => p.categoria === categoriaActiva)
    }

    // 2. Ordenar: disponibles primero, luego congelados
    const ordenados = [...filtrados].sort((a, b) => {
        const aCong = esCongelado(a) ? 1 : 0
        const bCong = esCongelado(b) ? 1 : 0
        return aCong - bCong
    })

    const totalDisponibles = ordenados.filter(p => !esCongelado(p)).length

    return (
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">

                {/* HEADER */}
                <div className="shrink-0 flex items-center justify-between p-5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-[#1A0087]/10 flex items-center justify-center">
                            <MagnifyingGlassIcon className="w-4 h-4 text-[#1A0087]" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[#232323]">Agregar producto</h2>
                            <p className="text-[11px] text-[#828282]">
                                {totalDisponibles} {totalDisponibles === 1 ? 'disponible' : 'disponibles'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                        aria-label="Cerrar"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* BUSCADOR */}
                <div className="shrink-0 p-4 border-b border-gray-100">
                    <div className="relative">
                        <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={termino}
                            onChange={(e) => setTermino(e.target.value)}
                            placeholder="Buscar por nombre o SKU..."
                            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#1A0087]/20 focus:border-[#1A0087]"
                            autoFocus
                        />
                        {buscando && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="w-5 h-5 border-2 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                    </div>
                </div>

                {/* CHIPS DE CATEGORÍAS (scroll horizontal) */}
                {categorias.length > 0 && (
                    <div className="shrink-0 border-b border-gray-100 bg-white">
                        <div className="overflow-x-auto scrollbar-hide">
                            <div className="flex items-center gap-2 px-4 py-3 min-w-max">
                                <button
                                    type="button"
                                    onClick={() => setCategoriaActiva(null)}
                                    className={`shrink-0 px-4 py-2.5 rounded-full text-sm font-semibold transition-all min-h-[40px] flex items-center ${categoriaActiva === null
                                            ? 'bg-[#1A0087] text-white shadow-sm'
                                            : 'bg-gray-100 text-[#232323] hover:bg-gray-200 active:bg-gray-300'
                                        }`}
                                >
                                    Todas
                                </button>
                                {categorias.map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setCategoriaActiva(cat)}
                                        className={`shrink-0 px-4 py-2.5 rounded-full text-sm font-semibold transition-all min-h-[40px] flex items-center ${categoriaActiva === cat
                                                ? 'bg-[#1A0087] text-white shadow-sm'
                                                : 'bg-gray-100 text-[#232323] hover:bg-gray-200 active:bg-gray-300'
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* LISTA */}
                <div className="flex-1 overflow-y-auto">
                    {ordenados.length === 0 ? (
                        <div className="p-8 text-center">
                            <MagnifyingGlassIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-[#828282]">
                                {buscando
                                    ? 'Buscando…'
                                    : termino.length > 0 && termino.length < 2
                                        ? 'Escribe al menos 2 letras para buscar'
                                        : 'Sin resultados'}
                            </p>
                            {categoriaActiva && (
                                <button
                                    type="button"
                                    onClick={() => setCategoriaActiva(null)}
                                    className="mt-3 text-xs text-[#1A0087] font-medium hover:underline"
                                >
                                    Quitar filtro de categoría
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {ordenados.map(p => {
                                const congelado = esCongelado(p)
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        disabled={congelado}
                                        onClick={() => {
                                            onSeleccionar(p)
                                            onClose()
                                        }}
                                        className={`w-full text-left p-4 transition-colors ${congelado
                                                ? 'bg-gray-50 cursor-not-allowed opacity-60'
                                                : 'hover:bg-[#1A0087]/5 active:bg-[#1A0087]/10'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-semibold leading-tight break-words ${congelado ? 'text-gray-400' : 'text-[#232323]'
                                                    }`}>
                                                    {p.nombre}
                                                </p>
                                                <p className="text-xs text-[#828282] mt-1 flex items-center gap-2 flex-wrap">
                                                    {p.sku && <span className="font-mono">{p.sku}</span>}
                                                    {p.categoria && (
                                                        <>
                                                            {p.sku && <span>·</span>}
                                                            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                                                {p.categoria}
                                                            </span>
                                                        </>
                                                    )}
                                                </p>
                                                <p className="text-xs mt-1">
                                                    {congelado ? (
                                                        <span className="text-red-600 font-medium flex items-center gap-1">
                                                            <LockClosedIcon className="w-3 h-3" />
                                                            Congelado (stock {p.stock_disponible} ≤ {STOCK_CONGELADO})
                                                        </span>
                                                    ) : (
                                                        <span className="text-[#828282]">
                                                            Stock: <span className="font-semibold text-[#232323]">{p.stock_disponible}</span>
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                                <span className={`text-sm font-bold ${congelado ? 'text-gray-400' : 'text-[#1A0087]'
                                                    }`}>
                                                    {formatCOP(p.precio)}
                                                </span>
                                                {!congelado && (
                                                    <span className="flex items-center gap-1 text-[11px] font-medium text-[#1A0087] bg-[#1A0087]/10 px-2 py-0.5 rounded-lg">
                                                        <PlusIcon className="w-3 h-3" />
                                                        Agregar
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}