'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    ClipboardDocumentListIcon,
    MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

interface CorteDetalle {
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
    revertido_en: string | null
    motivo_reversion: string | null
    notas: string | null
}

interface DetalleItem {
    id: string
    producto_id: string | null
    referencia_excel: string
    marca: string | null
    categoria_excel: string | null
    tipo_cambio: 'nuevo' | 'modificado' | 'ausente' | 'sin_cambio'
    cantidad_anterior: number | null
    cantidad_nueva: number
    diferencia: number | null
    precio_mayorista_anterior: number | null
    precio_mayorista_nuevo: number | null
    precio_tat_anterior: number | null
    precio_tat_nuevo: number | null
    precio_unidad_anterior: number | null
    precio_unidad_nuevo: number | null
}

type Filtro = 'todos' | 'nuevo' | 'modificado' | 'ausente' | 'sin_cambio'

export default function CorteDetallePage() {
    const params = useParams()
    const corteId = params.id as string
    const router = useRouter()
    const supabase = createClient()

    const [corte, setCorte] = useState<CorteDetalle | null>(null)
    const [detalle, setDetalle] = useState<DetalleItem[]>([])
    const [loading, setLoading] = useState(true)
    const [aplicando, setAplicando] = useState(false)
    const [revirtiendo, setRevirtiendo] = useState(false)
    const [filtro, setFiltro] = useState<Filtro>('todos')
    const [busqueda, setBusqueda] = useState('')

    // Cargar datos
    useEffect(() => {
        const cargar = async () => {
            setLoading(true)

            const { data: corteData, error: errCorte } = await supabase
                .from('cortes')
                .select(`
                    id, fecha, usuario_nombre, archivo_nombre, bodega_id,
                    total_productos, total_nuevos, total_modificados,
                    total_ausentes, total_sin_cambios,
                    aplicado, aplicado_en, revertido, revertido_en,
                    motivo_reversion, notas,
                    bodegas ( nombre )
                `)
                .eq('id', corteId)
                .single()

            if (errCorte || !corteData) {
                console.error(errCorte)
                setLoading(false)
                return
            }
            setCorte(corteData as any)

            const { data: detData } = await supabase
                .from('cortes_detalle')
                .select('*')
                .eq('corte_id', corteId)
                .order('tipo_cambio', { ascending: true })
                .order('referencia_excel', { ascending: true })

            setDetalle(detData || [])
            setLoading(false)
        }
        if (corteId) cargar()
    }, [corteId, supabase])

    // Aplicar corte
    const handleAplicar = async () => {
        const confirmar = window.confirm(
            '⚠️ ¿Aplicar este corte al inventario?\n\n' +
            'Esto va a:\n' +
            '• Actualizar stock de productos modificados\n' +
            '• Crear productos nuevos\n' +
            '• Poner en 0 los productos ausentes\n' +
            '• Registrar movimientos\n\n' +
            '¿Continuar?'
        )
        if (!confirmar) return

        setAplicando(true)
        try {
            const res = await fetch('/api/cortes/aplicar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ corteId }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error')

            alert(`✅ Corte aplicado. Movimientos: ${data.movimientos || 0}`)
            window.location.reload()
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setAplicando(false)
        }
    }

    // Revertir corte
    const handleRevertir = async () => {
        const motivo = window.prompt(
            'Motivo de reversión (mínimo 10 caracteres):'
        )
        if (!motivo) return
        if (motivo.trim().length < 10) {
            alert('El motivo debe tener al menos 10 caracteres')
            return
        }

        setRevirtiendo(true)
        try {
            const res = await fetch('/api/cortes/revertir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ corteId, motivo: motivo.trim() }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error')

            alert('✅ Corte revertido')
            window.location.reload()
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setRevirtiendo(false)
        }
    }

    const formatFecha = (iso: string | null) => {
        if (!iso) return '-'
        const d = new Date(iso)
        return d.toLocaleDateString('es-CO', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        })
    }

    const formatPrecio = (n: number | null) => {
        if (n === null || n === undefined) return '-'
        return '$' + n.toLocaleString('es-CO')
    }

    // Filtrar
    const filtrados = detalle.filter(d => {
        if (filtro !== 'todos' && d.tipo_cambio !== filtro) return false
        if (busqueda.trim()) {
            const q = busqueda.toLowerCase()
            return (
                d.referencia_excel.toLowerCase().includes(q) ||
                (d.marca || '').toLowerCase().includes(q) ||
                (d.categoria_excel || '').toLowerCase().includes(q)
            )
        }
        return true
    })

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F7F7FB] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!corte) {
        return (
            <div className="min-h-screen bg-[#F7F7FB] p-6">
                <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-2xl p-8 text-center">
                    <XCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-3" />
                    <h2 className="text-lg font-bold text-[#232323]">Corte no encontrado</h2>
                    <button
                        onClick={() => router.push('/admin/cortes')}
                        className="mt-4 min-h-[44px] px-5 py-2.5 bg-[#1A0087] text-white text-sm font-semibold rounded-xl"
                    >
                        Volver
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F7F7FB] w-full">
            {/* HEADER */}
            <header className="sticky top-[calc(var(--main-padding)*-1)] -mx-[var(--main-padding)] -mt-[var(--main-padding)] z-20 bg-white border-b border-gray-100">
                <div className="w-full px-4 sm:px-6 py-4">
                    <button
                        onClick={() => router.push('/admin/cortes')}
                        className="flex items-center gap-1 text-sm text-[#828282] hover:text-[#1A0087] transition-colors mb-2"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                        Volver a cortes
                    </button>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-[#232323]">
                                Corte · {corte.bodegas?.nombre || 'Sin bodega'}
                            </h1>
                            <p className="text-sm text-[#828282] mt-0.5">
                                {formatFecha(corte.fecha)}
                                {corte.usuario_nombre && ` · ${corte.usuario_nombre}`}
                            </p>
                            {corte.archivo_nombre && (
                                <p className="text-xs text-[#828282] mt-1">
                                    📄 {corte.archivo_nombre}
                                </p>
                            )}
                        </div>
                        <div>
                            {corte.revertido && (
                                <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                                    Revertido
                                </span>
                            )}
                            {!corte.revertido && corte.aplicado && (
                                <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-green-100 text-green-700">
                                    ✅ Aplicado
                                </span>
                            )}
                            {!corte.revertido && !corte.aplicado && (
                                <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-amber-100 text-amber-700">
                                    Sin aplicar
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="w-full px-4 sm:px-6 py-6 space-y-5">

                {/* Resumen */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-[#232323]">{corte.total_productos}</p>
                        <p className="text-xs text-[#828282] mt-1">Total</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600">{corte.total_nuevos}</p>
                        <p className="text-xs text-[#828282] mt-1">➕ Nuevos</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-amber-600">{corte.total_modificados}</p>
                        <p className="text-xs text-[#828282] mt-1">📝 Modificados</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-red-600">{corte.total_ausentes}</p>
                        <p className="text-xs text-[#828282] mt-1">❌ Ausentes</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">{corte.total_sin_cambios}</p>
                        <p className="text-xs text-[#828282] mt-1">✅ Sin cambios</p>
                    </div>
                </div>

                {/* Notas */}
                {corte.notas && (
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-[#828282] uppercase mb-1">Notas</p>
                        <p className="text-sm text-[#232323]">{corte.notas}</p>
                    </div>
                )}

                {/* Motivo de reversión */}
                {corte.revertido && corte.motivo_reversion && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-[#828282] uppercase mb-1">
                            Motivo de reversión ({formatFecha(corte.revertido_en)})
                        </p>
                        <p className="text-sm text-[#232323]">{corte.motivo_reversion}</p>
                    </div>
                )}

                {/* Botones de acción */}
                {!corte.revertido && (
                    <div className="flex flex-col sm:flex-row gap-2">
                        {!corte.aplicado && (
                            <button
                                onClick={handleAplicar}
                                disabled={aplicando}
                                className="flex-1 min-h-[48px] py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {aplicando ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Aplicando...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircleIcon className="w-5 h-5" />
                                        Aplicar al inventario
                                    </>
                                )}
                            </button>
                        )}
                        {!corte.aplicado && (
                            <button
                                onClick={handleRevertir}
                                disabled={revirtiendo}
                                className="flex-1 min-h-[48px] py-3 border border-red-200 text-red-600 rounded-xl text-sm font-semibold bg-white hover:bg-red-50 active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {revirtiendo ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                        Revirtiendo...
                                    </>
                                ) : (
                                    <>
                                        <ArrowPathIcon className="w-5 h-5" />
                                        Revertir corte
                                    </>
                                )}
                            </button>
                        )}
                        {corte.aplicado && (
                            <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                                <p className="text-xs text-green-800">
                                    ✅ Corte aplicado el {formatFecha(corte.aplicado_en)}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Filtros */}
                <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {(['todos', 'nuevo', 'modificado', 'ausente', 'sin_cambio'] as Filtro[]).map(f => {
                            const labels: Record<Filtro, string> = {
                                todos: 'Todos',
                                nuevo: '➕ Nuevos',
                                modificado: '📝 Modificados',
                                ausente: '❌ Ausentes',
                                sin_cambio: '✅ Sin cambios',
                            }
                            const activo = filtro === f
                            return (
                                <button
                                    key={f}
                                    onClick={() => setFiltro(f)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activo
                                            ? 'bg-[#1A0087] text-white'
                                            : 'bg-gray-100 text-[#828282] hover:bg-gray-200'
                                        }`}
                                >
                                    {labels[f]}
                                </button>
                            )
                        })}
                    </div>
                    <div className="relative">
                        <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar por referencia, marca o categoría..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
                        />
                    </div>
                </div>

                {/* Tabla de detalles */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#828282] uppercase">Tipo</th>
                                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#828282] uppercase">Referencia</th>
                                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#828282] uppercase hidden sm:table-cell">Marca</th>
                                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#828282] uppercase">Antes</th>
                                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#828282] uppercase">Nuevo</th>
                                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#828282] uppercase">Dif.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtrados.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-[#828282] text-sm">
                                            No hay items con este filtro
                                        </td>
                                    </tr>
                                )}
                                {filtrados.map((d) => {
                                    const tipoConfig = {
                                        nuevo: { icon: '➕', color: 'text-blue-600', bg: 'bg-blue-50' },
                                        modificado: { icon: '📝', color: 'text-amber-600', bg: 'bg-amber-50' },
                                        ausente: { icon: '❌', color: 'text-red-600', bg: 'bg-red-50' },
                                        sin_cambio: { icon: '✅', color: 'text-green-600', bg: 'bg-green-50' },
                                    }[d.tipo_cambio]

                                    return (
                                        <tr key={d.id} className="hover:bg-gray-50/50">
                                            <td className="px-3 py-2.5">
                                                <span className={`text-xs font-bold ${tipoConfig.color}`}>
                                                    {tipoConfig.icon}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <p className="font-medium text-[#232323] text-xs sm:text-sm line-clamp-1">
                                                    {d.referencia_excel}
                                                </p>
                                                <p className="text-[10px] text-[#828282] sm:hidden">
                                                    {d.marca}
                                                </p>
                                            </td>
                                            <td className="px-3 py-2.5 hidden sm:table-cell text-xs text-[#828282]">
                                                {d.marca || '-'}
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-xs sm:text-sm text-[#232323]">
                                                {d.cantidad_anterior ?? '-'}
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-xs sm:text-sm font-medium text-[#232323]">
                                                {d.cantidad_nueva}
                                            </td>
                                            <td className={`px-3 py-2.5 text-right text-xs sm:text-sm font-bold ${d.diferencia === null
                                                    ? 'text-blue-600'
                                                    : d.diferencia > 0
                                                        ? 'text-green-600'
                                                        : d.diferencia < 0
                                                            ? 'text-red-600'
                                                            : 'text-[#828282]'
                                                }`}>
                                                {d.diferencia === null
                                                    ? 'NUEVO'
                                                    : d.diferencia > 0
                                                        ? `+${d.diferencia}`
                                                        : d.diferencia}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Contador */}
                <p className="text-xs text-[#828282] text-center">
                    Mostrando {filtrados.length} de {detalle.length} items
                </p>
            </main>
        </div>
    )
}