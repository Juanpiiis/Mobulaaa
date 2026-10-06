'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    XMarkIcon,
    ArrowDownTrayIcon,
    PrinterIcon,
    DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { CotizacionBadge } from './CotizacionBadge'
import {
    getEstadoCotizacion,
    getMarcaAgua,
    generarIdTemporal,
    formatearFechaCotizacion,
    calcularVencimiento,
} from '@/lib/utils/cotizacion'

interface Props {
    pedidoId: string
    onClose: () => void
}

interface PedidoData {
    id: string
    estado: string
    fecha: string
    observacion: string | null
    subtotal: number
    descuento_porcentaje: number
    descuento_valor: number
    total: number
    numero_cotizacion: string | null
    numero_factura: string | null
    pdf_url: string | null
    clientes: {
        nombre: string
        cc_nit: string
        telefono: string | null
        email: string | null
        direccion: string | null
    } | null
    bodegas: { nombre: string } | null
    detalle_pedido: {
        cantidad_solicitada: number
        cantidad_aprobada: number | null
        productos: {
            nombre: string
            codigo: string | null
            precio: number
        } | null
    }[]
}

export function CotizacionPreview({ pedidoId, onClose }: Props) {
    const [pedido, setPedido] = useState<PedidoData | null>(null)
    const [loading, setLoading] = useState(true)

    const supabase = createClient()

    useEffect(() => {
        const cargar = async () => {
            setLoading(true)
            const { data, error } = await supabase
                .from('pedidos')
                .select(`
          *,
          clientes(nombre, cc_nit, telefono, email, direccion),
          bodegas(nombre),
          detalle_pedido(cantidad_solicitada, cantidad_aprobada, productos(nombre, codigo, precio))
        `)
                .eq('id', pedidoId)
                .single()

            if (error) {
                console.error('Error cargando pedido:', error)
            } else {
                setPedido(data as any)
            }
            setLoading(false)
        }
        cargar()
    }, [pedidoId, supabase])

    const handleImprimir = () => {
        window.print()
    }

    const handleDescargarPDF = async () => {
        // Si ya está en Drive, abrir el link
        if (pedido?.pdf_url) {
            window.open(pedido.pdf_url, '_blank')
            return
        }

        // Si no, generar el PDF
        try {
            const res = await fetch('/api/cotizacion/generar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pedidoId }),
            })

            const data = await res.json()

            if (!res.ok) {
                alert('Error: ' + (data.error || 'No se pudo generar el PDF'))
                return
            }

            // Descargar el PDF desde base64
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

            // Si Drive subió bien, avisar
            if (data.url) {
                // Recargar para mostrar el botón "Ver PDF en Drive"
                setTimeout(() => window.location.reload(), 500)
            } else if (data.driveError) {
                console.warn('Drive falló:', data.driveError)
            }
        } catch (e: any) {
            alert('Error: ' + e.message)
        }
    }

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-12">
                    <div className="w-10 h-10 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        )
    }

    if (!pedido) {
        return (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-8 text-center">
                    <p className="text-[#828282]">No se encontró el pedido</p>
                    <button
                        onClick={onClose}
                        className="mt-4 text-sm text-[#1A0087] font-medium hover:underline"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        )
    }

    const estadoCotizacion = getEstadoCotizacion(pedido.estado)
    const marcaAgua = getMarcaAgua(estadoCotizacion)
    const numeroMostrar = pedido.numero_cotizacion || generarIdTemporal(pedido.id)

    const formatCOP = (v: number) =>
        new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(v)

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-2xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header del modal */}
                <div className="shrink-0 flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 print:hidden">
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-[#232323]">
                            Cotización
                        </h2>
                        <p className="text-xs text-[#828282]">
                            Pedido #{pedido.id.slice(0, 8)}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <CotizacionBadge
                            estado={estadoCotizacion}
                            numeroCotizacion={pedido.numero_cotizacion}
                        />
                        <button
                            onClick={onClose}
                            className="w-11 h-11 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                            aria-label="Cerrar"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Contenido scrollable - la cotización */}
                <div className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6">
                    <div className="bg-white rounded-xl shadow-sm max-w-2xl mx-auto p-6 sm:p-10 relative">
                        {/* Marca de agua */}
                        {marcaAgua && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                                <p className="text-6xl sm:text-8xl font-bold text-gray-200/60 -rotate-12 text-center leading-none">
                                    {marcaAgua}
                                </p>
                            </div>
                        )}

                        {/* Encabezado */}
                        <div className="relative z-10">
                            <div className="flex items-start justify-between border-b-2 border-[#1A0087] pb-4 mb-6">
                                <div>
                                    <h1 className="text-2xl font-bold text-[#1A0087]">
                                        MOBULAA
                                    </h1>
                                    <p className="text-xs text-[#828282] tracking-widest">
                                        TECNOLOGÍA
                                    </p>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-xl font-bold text-[#232323]">
                                        COTIZACIÓN
                                    </h2>
                                    <p className="text-sm font-mono text-[#1A0087] font-semibold">
                                        {numeroMostrar}
                                    </p>
                                    <p className="text-xs text-[#828282] mt-1">
                                        {formatearFechaCotizacion(pedido.fecha)}
                                    </p>
                                </div>
                            </div>

                            {/* Datos del cliente */}
                            <div className="mb-6">
                                <h3 className="text-xs font-bold text-[#828282] uppercase mb-2 tracking-wider">
                                    Datos del Cliente
                                </h3>
                                <div className="bg-gray-50 rounded-lg p-4 space-y-1.5 text-sm">
                                    <p className="font-semibold text-[#232323] text-base">
                                        {pedido.clientes?.nombre || 'Sin cliente'}
                                    </p>
                                    {pedido.clientes?.cc_nit && (
                                        <p className="text-[#828282]">
                                            <span className="font-medium">CC/NIT:</span>{' '}
                                            {pedido.clientes.cc_nit}
                                        </p>
                                    )}
                                    {pedido.clientes?.telefono && (
                                        <p className="text-[#828282]">
                                            <span className="font-medium">Teléfono:</span>{' '}
                                            {pedido.clientes.telefono}
                                        </p>
                                    )}
                                    {pedido.clientes?.email && (
                                        <p className="text-[#828282]">
                                            <span className="font-medium">Email:</span>{' '}
                                            {pedido.clientes.email}
                                        </p>
                                    )}
                                    {pedido.clientes?.direccion && (
                                        <p className="text-[#828282]">
                                            <span className="font-medium">Dirección:</span>{' '}
                                            {pedido.clientes.direccion}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Tabla de productos */}
                            <div className="mb-6">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-[#1A0087] text-white">
                                            <th className="text-left p-2.5 rounded-tl-lg font-semibold text-xs">
                                                Código
                                            </th>
                                            <th className="text-left p-2.5 font-semibold text-xs">
                                                Producto
                                            </th>
                                            <th className="text-center p-2.5 font-semibold text-xs">
                                                Cant.
                                            </th>
                                            <th className="text-right p-2.5 font-semibold text-xs">
                                                Precio
                                            </th>
                                            <th className="text-right p-2.5 rounded-tr-lg font-semibold text-xs">
                                                Total
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pedido.detalle_pedido.map((d, i) => {
                                            const cantidad = d.cantidad_aprobada || d.cantidad_solicitada
                                            const precio = d.productos?.precio || 0
                                            const total = precio * cantidad
                                            return (
                                                <tr
                                                    key={i}
                                                    className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                                                >
                                                    <td className="p-2.5 text-xs text-[#828282] font-mono">
                                                        {d.productos?.codigo || '—'}
                                                    </td>
                                                    <td className="p-2.5 text-[#232323]">
                                                        {d.productos?.nombre || 'Producto'}
                                                    </td>
                                                    <td className="p-2.5 text-center font-medium">
                                                        {cantidad}
                                                    </td>
                                                    <td className="p-2.5 text-right text-[#828282]">
                                                        {formatCOP(precio)}
                                                    </td>
                                                    <td className="p-2.5 text-right font-semibold text-[#232323]">
                                                        {formatCOP(total)}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totales */}
                            <div className="flex justify-end mb-6">
                                <div className="w-full sm:w-64 space-y-1.5">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[#828282]">Subtotal</span>
                                        <span className="font-medium text-[#232323]">
                                            {formatCOP(pedido.subtotal)}
                                        </span>
                                    </div>
                                    {pedido.descuento_porcentaje > 0 && (
                                        <div className="flex justify-between text-sm text-green-600">
                                            <span>
                                                Descuento ({pedido.descuento_porcentaje}%)
                                            </span>
                                            <span>- {formatCOP(pedido.descuento_valor)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-baseline pt-2 border-t-2 border-[#1A0087]">
                                        <span className="font-bold text-[#232323]">Total</span>
                                        <span className="text-xl font-bold text-[#1A0087]">
                                            {formatCOP(pedido.total)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Observaciones */}
                            {pedido.observacion && (
                                <div className="mb-6">
                                    <h3 className="text-xs font-bold text-[#828282] uppercase mb-2 tracking-wider">
                                        Observaciones
                                    </h3>
                                    <p className="text-sm text-[#232323] bg-gray-50 rounded-lg p-3">
                                        {pedido.observacion}
                                    </p>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="border-t border-gray-200 pt-4 text-xs text-[#828282] text-center space-y-1">
                                <p>Cotización válida por 15 días</p>
                                <p>Vence el {calcularVencimiento(pedido.fecha)}</p>
                                <p className="pt-2 text-[#1A0087] font-medium">
                                    MOBULAA - Tecnología de alta calidad
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer con acciones */}
                <div className="shrink-0 border-t border-gray-100 bg-white p-4 flex flex-col sm:flex-row gap-2 print:hidden">
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 border border-gray-300 rounded-xl text-[#232323] bg-white hover:bg-gray-50 active:scale-[0.98] font-medium text-sm transition-all"
                    >
                        Cerrar
                    </button>

                    <div className="flex-1" />

                    <button
                        onClick={handleImprimir}
                        className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 border border-gray-300 rounded-xl text-[#232323] bg-white hover:bg-gray-50 active:scale-[0.98] font-medium text-sm transition-all flex items-center justify-center gap-2"
                    >
                        <PrinterIcon className="w-4 h-4" />
                        Imprimir
                    </button>

                    <button
                        onClick={handleDescargarPDF}
                        className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 border border-[#1A0087] rounded-xl text-[#1A0087] bg-white hover:bg-[#1A0087]/5 active:scale-[0.98] font-medium text-sm transition-all flex items-center justify-center gap-2"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Descargar PDF
                    </button>

                    {pedido.pdf_url && (
                        <a
                            href={pedido.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-green-600 rounded-xl text-white hover:bg-green-700 active:scale-[0.98] font-medium text-sm transition-all flex items-center justify-center gap-2"
                        >
                            <DocumentTextIcon className="w-4 h-4" />
                            Ver PDF en Drive
                        </a>
                    )}
                </div>
            </div>
        </div>
    )
}