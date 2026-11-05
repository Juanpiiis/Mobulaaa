'use client'

import { useEffect, useState } from 'react'
import {
    XMarkIcon,
    ArrowDownTrayIcon,
    DocumentTextIcon,
} from '@heroicons/react/24/outline'

interface Props {
    pedidoId: string
    onClose: () => void
}

export function CotizacionPreview({ pedidoId, onClose }: Props) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [nombreArchivo, setNombreArchivo] = useState<string>('cotizacion.pdf')
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let revoke: string | null = null
        let cancelado = false

        const cargar = async () => {
            setCargando(true)
            setError('')
            try {
                const res = await fetch('/api/cotizacion/preview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pedidoId }),
                })
                const json = await res.json()
                if (!res.ok) throw new Error(json?.error || 'Error al generar')
                if (cancelado) return

                // base64 -> Blob
                const bin = atob(json.pdfBase64 as string)
                const len = bin.length
                const bytes = new Uint8Array(len)
                for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
                const blob = new Blob([bytes], { type: 'application/pdf' })
                const url = URL.createObjectURL(blob)
                revoke = url
                setPdfUrl(url)
                setNombreArchivo(json.nombreArchivo || 'cotizacion.pdf')
            } catch (e: any) {
                if (!cancelado) setError(e?.message || 'Error al cargar PDF')
            } finally {
                if (!cancelado) setCargando(false)
            }
        }

        cargar()

        return () => {
            cancelado = true
            if (revoke) URL.revokeObjectURL(revoke)
        }
    }, [pedidoId])

    const descargar = () => {
        if (!pdfUrl) return
        const a = document.createElement('a')
        a.href = pdfUrl
        a.download = nombreArchivo
        document.body.appendChild(a)
        a.click()
        a.remove()
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-4xl h-full sm:h-[90vh] rounded-none sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden">
                {/* HEADER */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <DocumentTextIcon className="w-5 h-5 text-[#1A0087] shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-[#232323] truncate">
                                Vista previa de cotización
                            </p>
                            <p className="text-[11px] text-[#828282] truncate">
                                {nombreArchivo}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={descargar}
                            disabled={!pdfUrl}
                            className="h-10 px-3 sm:px-4 flex items-center gap-2 rounded-lg bg-[#1A0087] text-white text-sm font-semibold hover:bg-[#130066] disabled:opacity-40"
                        >
                            <ArrowDownTrayIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">Descargar</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* BODY */}
                <div className="flex-1 bg-gray-100 overflow-hidden">
                    {cargando && (
                        <div className="h-full flex flex-col items-center justify-center gap-3">
                            <div className="w-10 h-10 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-[#828282]">
                                Generando cotización...
                            </p>
                        </div>
                    )}
                    {!cargando && error && (
                        <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                <XMarkIcon className="w-6 h-6 text-red-600" />
                            </div>
                            <p className="text-sm text-red-700 font-medium">
                                {error}
                            </p>
                            <button
                                onClick={onClose}
                                className="px-4 py-2.5 bg-[#1A0087] text-white rounded-xl text-sm font-semibold"
                            >
                                Cerrar
                            </button>
                        </div>
                    )}
                    {!cargando && pdfUrl && (
                        <iframe
                            src={pdfUrl}
                            title="Vista previa cotización"
                            className="w-full h-full border-0"
                        />
                    )}
                </div>
            </div>
        </div>
    )
}