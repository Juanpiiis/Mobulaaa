'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
    ClipboardDocumentListIcon,
    ChevronRightIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

interface Corte {
    id: string
    fecha: string
    usuario_nombre: string | null
    archivo_nombre: string | null
    bodega_id: string
    bodegas: { nombre: string } | null
    total_productos: number
    total_nuevos: number
    total_modificados: number
    total_ausentes: number
    total_sin_cambios: number
    aplicado: boolean
    aplicado_en: string | null
    revertido: boolean
    notas: string | null
}

interface Bodega {
    id: string
    nombre: string
}

export default function CortesPage() {
    const [cortes, setCortes] = useState<Corte[]>([])
    const [bodegas, setBodegas] = useState<Bodega[]>([])
    const [bodegaFiltro, setBodegaFiltro] = useState('')
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(0)
    const POR_PAGINA = 20

    const supabase = createClient()
    const router = useRouter()

    // Cargar bodegas
    useEffect(() => {
        const cargarBodegas = async () => {
            const { data } = await supabase
                .from('bodegas')
                .select('id, nombre')
                .eq('activo', true)
                .order('nombre')
            setBodegas(data || [])
        }
        cargarBodegas()
    }, [supabase])

    // Cargar cortes
    useEffect(() => {
        const cargarCortes = async () => {
            setLoading(true)

            let query = supabase
                .from('cortes')
                .select(`
                    id, fecha, usuario_nombre, archivo_nombre, bodega_id,
                    total_productos, total_nuevos, total_modificados,
                    total_ausentes, total_sin_cambios,
                    aplicado, aplicado_en, revertido, notas,
                    bodegas ( nombre )
                `)
                .order('fecha', { ascending: false })
                .range(page * POR_PAGINA, (page + 1) * POR_PAGINA - 1)

            if (bodegaFiltro) {
                query = query.eq('bodega_id', bodegaFiltro)
            }

            const { data, error } = await query

            if (error) {
                console.error('Error cargando cortes:', error)
                setCortes([])
            } else {
                setCortes(data as any || [])
            }
            setLoading(false)
        }
        cargarCortes()
    }, [supabase, page, bodegaFiltro])

    const formatFecha = (iso: string) => {
        const d = new Date(iso)
        return d.toLocaleDateString('es-CO', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    return (
        <div className="min-h-screen bg-[#F7F7FB] w-full">
            {/* HEADER */}
            <header className="sticky top-[calc(var(--main-padding)*-1)] -mx-[var(--main-padding)] -mt-[var(--main-padding)] z-20 bg-white border-b border-gray-100">
                <div className="w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[#232323]">
                            Cortes de Inventario
                        </h1>
                        <p className="text-sm text-[#828282] mt-0.5">
                            Historial de cortes y comparación de diferencias
                        </p>
                    </div>
                    <button
                        onClick={() => router.push('/admin/subir-inventario')}
                        className="shrink-0 min-h-[44px] px-4 py-2.5 bg-[#1A0087] text-white text-sm font-semibold rounded-xl hover:bg-[#130066] active:scale-[0.98] transition-all"
                    >
                        + Nuevo Corte
                    </button>
                </div>
            </header>

            <main className="w-full px-4 sm:px-6 py-6 space-y-4">

                {/* Filtro por bodega */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <select
                        value={bodegaFiltro}
                        onChange={(e) => {
                            setBodegaFiltro(e.target.value)
                            setPage(0)
                        }}
                        className="w-full sm:max-w-xs border border-gray-200 px-3 py-2.5 rounded-xl text-sm min-h-[44px] focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 bg-white"
                    >
                        <option value="">Todas las bodegas</option>
                        {bodegas.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.nombre}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {/* Sin resultados */}
                {!loading && cortes.length === 0 && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
                        <ClipboardDocumentListIcon className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-[#232323]">
                            No hay cortes todavía
                        </h3>
                        <p className="text-sm text-[#828282] mt-1">
                            Sube tu primer Excel para crear un corte
                        </p>
                        <button
                            onClick={() => router.push('/admin/subir-inventario')}
                            className="mt-4 min-h-[44px] px-5 py-2.5 bg-[#1A0087] text-white text-sm font-semibold rounded-xl hover:bg-[#130066] transition-all"
                        >
                            Subir inventario
                        </button>
                    </div>
                )}

                {/* Lista de cortes */}
                {!loading && cortes.length > 0 && (
                    <div className="space-y-3">
                        {cortes.map((corte) => (
                            <button
                                key={corte.id}
                                onClick={() => router.push(`/admin/cortes/${corte.id}`)}
                                className="w-full bg-white border border-gray-200 rounded-2xl p-4 hover:border-[#1A0087]/30 hover:shadow-md active:scale-[0.99] transition-all text-left"
                            >
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-[#232323]">
                                                {corte.bodegas?.nombre || 'Sin bodega'}
                                            </h3>

                                            {/* Badges de estado */}
                                            {corte.revertido && (
                                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                                    Revertido
                                                </span>
                                            )}
                                            {!corte.revertido && corte.aplicado && (
                                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                                                    <CheckCircleIcon className="w-3 h-3" />
                                                    Aplicado
                                                </span>
                                            )}
                                            {!corte.revertido && !corte.aplicado && (
                                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                                    Sin aplicar
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-[#828282] mt-1">
                                            {formatFecha(corte.fecha)}
                                            {corte.usuario_nombre && ` · ${corte.usuario_nombre}`}
                                        </p>
                                        {corte.archivo_nombre && (
                                            <p className="text-xs text-[#828282] truncate mt-0.5">
                                                📄 {corte.archivo_nombre}
                                            </p>
                                        )}
                                    </div>
                                    <ChevronRightIcon className="w-5 h-5 text-gray-400 shrink-0 mt-1" />
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-5 gap-1.5 text-center">
                                    <div className="bg-gray-50 rounded-lg py-1.5">
                                        <p className="text-sm font-bold text-[#232323]">
                                            {corte.total_productos}
                                        </p>
                                        <p className="text-[9px] text-[#828282] uppercase">Total</p>
                                    </div>
                                    <div className="bg-blue-50 rounded-lg py-1.5">
                                        <p className="text-sm font-bold text-blue-600">
                                            {corte.total_nuevos}
                                        </p>
                                        <p className="text-[9px] text-[#828282] uppercase">Nuevos</p>
                                    </div>
                                    <div className="bg-amber-50 rounded-lg py-1.5">
                                        <p className="text-sm font-bold text-amber-600">
                                            {corte.total_modificados}
                                        </p>
                                        <p className="text-[9px] text-[#828282] uppercase">Modif.</p>
                                    </div>
                                    <div className="bg-red-50 rounded-lg py-1.5">
                                        <p className="text-sm font-bold text-red-600">
                                            {corte.total_ausentes}
                                        </p>
                                        <p className="text-[9px] text-[#828282] uppercase">Ausentes</p>
                                    </div>
                                    <div className="bg-green-50 rounded-lg py-1.5">
                                        <p className="text-sm font-bold text-green-600">
                                            {corte.total_sin_cambios}
                                        </p>
                                        <p className="text-[9px] text-[#828282] uppercase">Sin camb.</p>
                                    </div>
                                </div>

                                {/* Notas */}
                                {corte.notas && (
                                    <p className="text-xs text-[#828282] mt-2 italic line-clamp-1">
                                        💬 {corte.notas}
                                    </p>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* Paginación */}
                {!loading && cortes.length > 0 && (
                    <div className="flex items-center justify-center gap-3 pt-4">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="min-h-[40px] px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-[#232323] bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Anterior
                        </button>
                        <span className="text-sm text-[#828282]">
                            Página {page + 1}
                        </span>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={cortes.length < POR_PAGINA}
                            className="min-h-[40px] px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-[#232323] bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Siguiente
                        </button>
                    </div>
                )}
            </main>
        </div>
    )
}