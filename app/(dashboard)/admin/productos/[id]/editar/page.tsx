'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    XCircleIcon,
    CurrencyDollarIcon,
    TagIcon,
    ClipboardDocumentListIcon,
    LockClosedIcon,
} from '@heroicons/react/24/outline'

interface Producto {
    id: string
    nombre: string
    referencia_excel: string | null
    marca: string | null
    categoria_excel: string | null
    codigo: string | null
    sku: string | null
    descripcion: string | null
    precio: number | null
    precio_mayorista: number | null
    precio_tat: number | null
    activo: boolean
    congelado_manual: boolean
    limite_congelado: number | null
}

export default function EditarProductoPage() {
    const params = useParams()
    const productoId = params.id as string
    const router = useRouter()
    const supabase = createClient()

    const [producto, setProducto] = useState<Producto | null>(null)
    const [loading, setLoading] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')
    const [exito, setExito] = useState(false)

    // Cargar producto
    useEffect(() => {
        const cargar = async () => {
            const { data, error } = await supabase
                .from('productos')
                .select('*')
                .eq('id', productoId)
                .single()

            if (error || !data) {
                setError('Producto no encontrado')
                setLoading(false)
                return
            }
            setProducto({
                ...data,
                referencia_excel: data.referencia_excel || '',
                marca: data.marca || '',
                categoria_excel: data.categoria_excel || '',
                codigo: data.codigo || '',
                sku: data.sku || '',
                descripcion: data.descripcion || '',
                congelado_manual: data.congelado_manual ?? false,
                limite_congelado: data.limite_congelado ?? 150,
            } as any)
            setLoading(false)
        }
        if (productoId) cargar()
    }, [productoId, supabase])

    const handleGuardar = async () => {
        if (!producto) return

        // Validaciones
        if (!producto.nombre?.trim()) {
            setError('El nombre es obligatorio')
            return
        }
        if (!producto.referencia_excel?.trim()) {
            setError('La referencia del Excel es obligatoria (se usa para comparar cortes)')
            return
        }

        setGuardando(true)
        setError('')
        setExito(false)

        try {
            // Verificar que la referencia_excel no esté duplicada
            const { data: existe } = await supabase
                .from('productos')
                .select('id')
                .eq('referencia_excel', producto.referencia_excel.trim())
                .neq('id', producto.id)
                .maybeSingle()

            if (existe) {
                throw new Error(
                    'Ya existe otro producto con esa referencia de Excel. Las referencias deben ser únicas.'
                )
            }

            const { error: errUpdate } = await supabase
                .from('productos')
                .update({
                    nombre: producto.nombre.trim(),
                    referencia_excel: producto.referencia_excel.trim(),
                    marca: producto.marca?.trim() || null,
                    categoria_excel: producto.categoria_excel?.trim() || null,
                    codigo: producto.codigo?.trim() || null,
                    sku: producto.sku?.trim() || null,
                    descripcion: producto.descripcion?.trim() || null,
                    precio: producto.precio ?? null,
                    precio_mayorista: producto.precio_mayorista ?? null,
                    precio_tat: producto.precio_tat ?? null,
                    activo: producto.activo,
                    congelado_manual: producto.congelado_manual,
                    limite_congelado: producto.limite_congelado ?? null,
                })
                .eq('id', producto.id)

            if (errUpdate) throw new Error(errUpdate.message)

            setExito(true)
            setTimeout(() => {
                router.push('/admin/productos')
            }, 1500)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setGuardando(false)
        }
    }

    const formatInput = (valor: number | null | undefined) => {
        if (valor === null || valor === undefined) return ''
        return valor.toString()
    }

    const parseInput = (str: string): number | null => {
        const limpio = str.replace(/[^0-9.-]/g, '')
        if (!limpio) return null
        const n = Number(limpio)
        return isNaN(n) ? null : n
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F7F7FB] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!producto) {
        return (
            <div className="min-h-screen bg-[#F7F7FB] p-6">
                <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-2xl p-8 text-center">
                    <XCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-3" />
                    <h2 className="text-lg font-bold text-[#232323]">Producto no encontrado</h2>
                    <button
                        onClick={() => router.push('/admin/productos')}
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
                        onClick={() => router.push('/admin/productos')}
                        className="flex items-center gap-1 text-sm text-[#828282] hover:text-[#1A0087] transition-colors mb-2"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                        Volver a productos
                    </button>
                    <h1 className="text-xl sm:text-2xl font-bold text-[#232323]">
                        Editar Producto
                    </h1>
                    <p className="text-sm text-[#828282] mt-0.5">
                        {producto.nombre}
                    </p>
                </div>
            </header>

            <main className="w-full px-4 sm:px-6 py-6 max-w-3xl mx-auto space-y-5">

                {/* INFO */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-800 space-y-1">
                    <p className="font-semibold">💡 Sobre la referencia del Excel</p>
                    <p>
                        Este campo es el que se usa para hacer match entre el Excel que subes
                        y el producto en la base de datos. Debe coincidir exactamente con la
                        columna <strong>REFERENCIA</strong> del Excel.
                    </p>
                    <p className="italic">
                        Ejemplo: AC-C1 BLANCO AUDIFONOS
                    </p>
                </div>

                {/* Error / Éxito */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-start gap-3">
                        <XCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>{error}</div>
                    </div>
                )}
                {exito && (
                    <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-sm flex items-start gap-3">
                        <CheckCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>Producto actualizado. Redirigiendo...</div>
                    </div>
                )}

                {/* Sección: Identificación */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                        <TagIcon className="w-5 h-5 text-[#1A0087]" />
                        <h2 className="text-sm font-bold text-[#232323] uppercase tracking-wide">
                            Identificación
                        </h2>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[#232323] mb-1.5">
                            Nombre <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={producto.nombre || ''}
                            onChange={(e) => setProducto({ ...producto, nombre: e.target.value })}
                            className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[#232323] mb-1.5">
                            Referencia del Excel <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={producto.referencia_excel || ''}
                            onChange={(e) =>
                                setProducto({ ...producto, referencia_excel: e.target.value })
                            }
                            placeholder="AC-C1 BLANCO AUDIFONOS"
                            className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 font-mono"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[#232323] mb-1.5">
                                Marca
                            </label>
                            <input
                                type="text"
                                value={producto.marca || ''}
                                onChange={(e) => setProducto({ ...producto, marca: e.target.value })}
                                placeholder="GTIDE"
                                className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#232323] mb-1.5">
                                Categoría (Excel)
                            </label>
                            <input
                                type="text"
                                value={producto.categoria_excel || ''}
                                onChange={(e) =>
                                    setProducto({ ...producto, categoria_excel: e.target.value })
                                }
                                placeholder="AUDIFONO DE CABLE"
                                className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[#232323] mb-1.5">
                                Código interno
                            </label>
                            <input
                                type="text"
                                value={producto.codigo || ''}
                                onChange={(e) =>
                                    setProducto({ ...producto, codigo: e.target.value })
                                }
                                className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#232323] mb-1.5">
                                SKU
                            </label>
                            <input
                                type="text"
                                value={producto.sku || ''}
                                onChange={(e) => setProducto({ ...producto, sku: e.target.value })}
                                className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[#232323] mb-1.5">
                            Descripción
                        </label>
                        <textarea
                            value={producto.descripcion || ''}
                            onChange={(e) =>
                                setProducto({ ...producto, descripcion: e.target.value })
                            }
                            rows={2}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 resize-none"
                        />
                    </div>
                </div>

                {/* Sección: Precios */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                        <CurrencyDollarIcon className="w-5 h-5 text-[#1A0087]" />
                        <h2 className="text-sm font-bold text-[#232323] uppercase tracking-wide">
                            Precios
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[#232323] mb-1.5">
                                Precio mayorista
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#828282] text-sm">
                                    $
                                </span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={formatInput(producto.precio_mayorista)}
                                    onChange={(e) =>
                                        setProducto({
                                            ...producto,
                                            precio_mayorista: parseInput(e.target.value),
                                        })
                                    }
                                    placeholder="0"
                                    className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#232323] mb-1.5">
                                Precio TAT
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#828282] text-sm">
                                    $
                                </span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={formatInput(producto.precio_tat)}
                                    onChange={(e) =>
                                        setProducto({
                                            ...producto,
                                            precio_tat: parseInput(e.target.value),
                                        })
                                    }
                                    placeholder="0"
                                    className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#232323] mb-1.5">
                                Precio unidad
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#828282] text-sm">
                                    $
                                </span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={formatInput(producto.precio)}
                                    onChange={(e) =>
                                        setProducto({
                                            ...producto,
                                            precio: parseInput(e.target.value),
                                        })
                                    }
                                    placeholder="0"
                                    className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sección: Stock y congelado (NUEVA) */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                        <LockClosedIcon className="w-5 h-5 text-[#1A0087]" />
                        <h2 className="text-sm font-bold text-[#232323] uppercase tracking-wide">
                            Stock y congelado
                        </h2>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
                        <p className="font-semibold">💡 ¿Cómo funciona?</p>
                        <p>
                            Un producto está <strong>congelado</strong> cuando no se puede pedir.
                            Se puede congelar de dos formas:
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 ml-2">
                            <li><strong>Manual:</strong> el switch está encendido → siempre congelado</li>
                            <li><strong>Automático:</strong> si el stock baja del límite configurado</li>
                        </ul>
                    </div>

                    {/* Switch congelado manual */}
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50">
                        <input
                            type="checkbox"
                            checked={producto.congelado_manual}
                            onChange={(e) =>
                                setProducto({ ...producto, congelado_manual: e.target.checked })
                            }
                            className="w-5 h-5 rounded border-gray-300 text-[#1A0087] focus:ring-[#1A0087]"
                        />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-[#232323]">
                                Congelar manualmente
                            </p>
                            <p className="text-xs text-[#828282]">
                                Si está encendido, el producto no se puede pedir sin importar el stock
                            </p>
                        </div>
                        {producto.congelado_manual && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-700">
                                Congelado
                            </span>
                        )}
                    </label>

                    {/* Límite automático */}
                    <div>
                        <label className="block text-sm font-medium text-[#232323] mb-1.5">
                            Límite de congelado automático
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={producto.limite_congelado ?? ''}
                            onChange={(e) => {
                                const limpio = e.target.value.replace(/[^0-9]/g, '')
                                if (limpio === '') {
                                    setProducto({ ...producto, limite_congelado: 0 })
                                    return
                                }
                                setProducto({ ...producto, limite_congelado: parseInt(limpio) })
                            }}
                            placeholder="150"
                            className="w-full sm:max-w-xs border border-gray-200 px-3 py-2.5 rounded-xl text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
                        />
                        <p className="text-xs text-[#828282] mt-1.5">
                            Si el stock es <strong>menor o igual</strong> a este número, el producto se congela automáticamente.
                            <br />
                            Pon <strong>0</strong> para desactivar el congelado automático.
                        </p>
                    </div>
                </div>

                {/* Sección: Estado */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={producto.activo}
                            onChange={(e) =>
                                setProducto({ ...producto, activo: e.target.checked })
                            }
                            className="w-5 h-5 rounded border-gray-300 text-[#1A0087] focus:ring-[#1A0087]"
                        />
                        <div>
                            <p className="text-sm font-medium text-[#232323]">Producto activo</p>
                            <p className="text-xs text-[#828282]">
                                Los productos inactivos no aparecen en el catálogo
                            </p>
                        </div>
                    </label>
                </div>

                {/* Botones */}
                <div className="flex flex-col sm:flex-row gap-3 sticky bottom-0 bg-[#F7F7FB] py-3 -mx-4 sm:mx-0 px-4 sm:px-0">
                    <button
                        onClick={() => router.push('/admin/productos')}
                        disabled={guardando}
                        className="flex-1 min-h-[48px] py-3 border border-gray-200 rounded-xl text-sm font-medium text-[#232323] bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleGuardar}
                        disabled={guardando}
                        className="flex-1 min-h-[48px] py-3 bg-[#1A0087] text-white rounded-xl text-sm font-semibold hover:bg-[#130066] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                        {guardando ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <CheckCircleIcon className="w-5 h-5" />
                                Guardar cambios
                            </>
                        )}
                    </button>
                </div>
            </main>
        </div>
    )
}