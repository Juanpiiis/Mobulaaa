'use client'

import { useState, useEffect } from 'react'
import {
    XMarkIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
} from '@heroicons/react/24/outline'

export type FiltroFecha = 'todo' | 'hoy' | '7d' | '30d' | 'mes'
export type FiltroEstado = 'todos' | 'pendiente' | 'aprobado' | 'despachado' | 'entregado' | 'rechazado' | 'cancelado'

export interface FiltrosValores {
    busqueda: string
    fecha: FiltroFecha
    estado: FiltroEstado
    extra: string
}

export const FILTROS_INICIALES: FiltrosValores = {
    busqueda: '',
    fecha: 'todo',
    estado: 'todos',
    extra: 'todos',
}

interface Props {
    abierto: boolean
    onClose: () => void
    valores: FiltrosValores
    onAplicar: (v: FiltrosValores) => void
    extraLabel?: string
    extraOpciones?: { valor: string; etiqueta: string }[]
    placeholderBusqueda?: string
    mostrarFecha?: boolean
    mostrarEstado?: boolean
}

const OPCIONES_FECHA: { valor: FiltroFecha; etiqueta: string }[] = [
    { valor: 'todo', etiqueta: 'Todo' },
    { valor: 'hoy', etiqueta: 'Hoy' },
    { valor: '7d', etiqueta: '7 días' },
    { valor: '30d', etiqueta: '30 días' },
    { valor: 'mes', etiqueta: 'Este mes' },
]

const OPCIONES_ESTADO: { valor: FiltroEstado; etiqueta: string }[] = [
    { valor: 'todos', etiqueta: 'Todos' },
    { valor: 'pendiente', etiqueta: 'En revisión' },
    { valor: 'aprobado', etiqueta: 'Aprobados' },
    { valor: 'despachado', etiqueta: 'Despachados' },
    { valor: 'entregado', etiqueta: 'Entregados' },
    { valor: 'rechazado', etiqueta: 'Rechazados' },
    { valor: 'cancelado', etiqueta: 'Cancelados' },
]

export function FiltrosModal({
    abierto,
    onClose,
    valores,
    onAplicar,
    extraLabel,
    extraOpciones,
    placeholderBusqueda = 'Buscar por COT, factura, pedido, cliente...',
    mostrarFecha = true,
    mostrarEstado = true,
}: Props) {
    const [local, setLocal] = useState<FiltrosValores>(valores)

    useEffect(() => {
        if (abierto) {
            setLocal(valores)
        }
    }, [abierto, valores])

    if (!abierto) return null

    const limpiar = () => {
        setLocal(FILTROS_INICIALES)
    }

    const aplicar = () => {
        onAplicar(local)
        onClose()
    }

    const hayCambios =
        local.busqueda !== valores.busqueda ||
        local.fecha !== valores.fecha ||
        local.estado !== valores.estado ||
        local.extra !== valores.extra

    return (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

                <div className="shrink-0 flex items-center justify-between p-5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-[#1A0087]/10 flex items-center justify-center">
                            <FunnelIcon className="w-4 h-4 text-[#1A0087]" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[#232323]">Filtros</h2>
                            <p className="text-[11px] text-[#828282]">Refina los resultados</p>
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

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    <div>
                        <label className="block text-xs font-semibold text-[#828282] uppercase tracking-wide mb-2">
                            Buscar
                        </label>
                        <div className="relative">
                            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={local.busqueda}
                                onChange={e => setLocal({ ...local, busqueda: e.target.value })}
                                placeholder={placeholderBusqueda}
                                className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1A0087]/20 focus:border-[#1A0087]"
                            />
                        </div>
                    </div>

                    {mostrarFecha && (
                        <div>
                            <label className="block text-xs font-semibold text-[#828282] uppercase tracking-wide mb-2">
                                Fecha
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {OPCIONES_FECHA.map(op => (
                                    <button
                                        key={op.valor}
                                        type="button"
                                        onClick={() => setLocal({ ...local, fecha: op.valor })}
                                        className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${local.fecha === op.valor
                                                ? 'bg-[#1A0087] text-white shadow-sm'
                                                : 'bg-gray-100 text-[#232323] hover:bg-gray-200'
                                            }`}
                                    >
                                        {op.etiqueta}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {mostrarEstado && (
                        <div>
                            <label className="block text-xs font-semibold text-[#828282] uppercase tracking-wide mb-2">
                                Estado
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {OPCIONES_ESTADO.map(op => (
                                    <button
                                        key={op.valor}
                                        type="button"
                                        onClick={() => setLocal({ ...local, estado: op.valor })}
                                        className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${local.estado === op.valor
                                                ? 'bg-[#1A0087] text-white shadow-sm'
                                                : 'bg-gray-100 text-[#232323] hover:bg-gray-200'
                                            }`}
                                    >
                                        {op.etiqueta}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {extraLabel && extraOpciones && extraOpciones.length > 0 && (
                        <div>
                            <label className="block text-xs font-semibold text-[#828282] uppercase tracking-wide mb-2">
                                {extraLabel}
                            </label>
                            <select
                                value={local.extra}
                                onChange={e => setLocal({ ...local, extra: e.target.value })}
                                className="w-full px-3.5 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1A0087]/20 focus:border-[#1A0087]"
                            >
                                <option value="todos">Todos</option>
                                {extraOpciones.map(op => (
                                    <option key={op.valor} value={op.valor}>
                                        {op.etiqueta}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="shrink-0 border-t border-gray-100 bg-white p-4 flex gap-2">
                    <button
                        type="button"
                        onClick={limpiar}
                        className="flex-1 min-h-[44px] px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-[#232323] bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    >
                        Limpiar
                    </button>
                    <button
                        type="button"
                        onClick={aplicar}
                        className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-sm ${hayCambios
                                ? 'bg-[#1A0087] hover:bg-[#130066] active:scale-[0.98]'
                                : 'bg-gray-300 cursor-not-allowed'
                            }`}
                        disabled={!hayCambios}
                    >
                        Aplicar
                    </button>
                </div>
            </div>
        </div>
    )
}

export function FiltrosChips({
    valores,
    onQuitar,
    onLimpiar,
    extraLabel,
    extraOpciones,
}: {
    valores: FiltrosValores
    onQuitar: (campo: keyof FiltrosValores) => void
    onLimpiar: () => void
    extraLabel?: string
    extraOpciones?: { valor: string; etiqueta: string }[]
}) {
    const chips: { campo: keyof FiltrosValores; etiqueta: string }[] = []

    if (valores.busqueda.trim()) {
        chips.push({ campo: 'busqueda', etiqueta: `"${valores.busqueda}"` })
    }
    if (valores.fecha !== 'todo') {
        const op = OPCIONES_FECHA.find(o => o.valor === valores.fecha)
        if (op) chips.push({ campo: 'fecha', etiqueta: `Fecha: ${op.etiqueta}` })
    }
    if (valores.estado !== 'todos') {
        const op = OPCIONES_ESTADO.find(o => o.valor === valores.estado)
        if (op) chips.push({ campo: 'estado', etiqueta: `Estado: ${op.etiqueta}` })
    }
    if (valores.extra !== 'todos' && extraOpciones) {
        const op = extraOpciones.find(o => o.valor === valores.extra)
        if (op && extraLabel) {
            chips.push({ campo: 'extra', etiqueta: `${extraLabel}: ${op.etiqueta}` })
        }
    }

    if (chips.length === 0) return null

    return (
        <div className="flex flex-wrap items-center gap-2">
            {chips.map(chip => (
                <button
                    key={chip.campo}
                    onClick={() => onQuitar(chip.campo)}
                    className="flex items-center gap-1.5 bg-[#1A0087]/10 text-[#1A0087] hover:bg-[#1A0087]/20 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                >
                    {chip.etiqueta}
                    <XMarkIcon className="w-3.5 h-3.5" />
                </button>
            ))}
            {chips.length > 1 && (
                <button
                    onClick={onLimpiar}
                    className="text-xs text-[#828282] hover:text-[#232323] font-medium underline ml-1"
                >
                    Limpiar todo
                </button>
            )}
        </div>
    )
}