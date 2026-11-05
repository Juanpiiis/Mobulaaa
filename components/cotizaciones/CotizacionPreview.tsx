'use client'

import { useEffect, useRef, useState } from 'react'
import {
    XMarkIcon,
    ArrowDownTrayIcon,
    DocumentTextIcon,
} from '@heroicons/react/24/outline'

interface Props {
    pedidoId: string
    onClose: () => void
}

declare global {
    interface Window {
        pdfjsLib?: any
    }
}

// Carga PDF.js desde TU propio dominio (/public/pdf.min.js)
function cargarPdfJs(): Promise<any> {
    return new Promise((resolve, reject) => {
        if (window.pdfjsLib) return resolve(window.pdfjsLib)
        const s = document.createElement('script')
        s.src = '/pdf.min.js'
        s.onload = () => {
            if (window.pdfjsLib) resolve(window.pdfjsLib)
            else reject(new Error('pdf.min.js cargó pero pdfjsLib no existe'))
        }
        s.onerror = () => reject(new Error('No se pudo cargar /pdf.min.js'))
        document.head.appendChild(s)
    })
}

function base64ToBytes(b64: string) {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
}

export function CotizacionPreview({ pedidoId, onClose }: Props) {
    const [pdfData, setPdfData] = useState<string | null>(null)
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [nombreArchivo, setNombreArchivo] = useState('cotizacion.pdf')
    const [cargando, setCargando] = useState(true)
    const [renderizando, setRenderizando] = useState(false)
    const [error, setError] = useState('')

    // null = aún no sabemos; true = celular/WebView (canvas); false = escritorio (iframe)
    const [usarCanvas, setUsarCanvas] = useState<boolean | null>(null)

    // Solo contiene los canvas. React NO administra sus hijos.
    const paginasRef = useRef<HTMLDivElement>(null)

    // 0. Detectar si hace falta el visor por canvas
    useEffect(() => {
        setUsarCanvas(/Android|iPhone|iPad|iPod|\bwv\b/i.test(navigator.userAgent))
    }, [])

    // 1. Obtener el PDF en Base64
    useEffect(() => {
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
                setPdfData(json.pdfBase64)
                setNombreArchivo(json.nombreArchivo || 'cotizacion.pdf')
            } catch (e: any) {
                if (!cancelado) setError(e?.message || 'Error al cargar PDF')
            } finally {
                if (!cancelado) setCargando(false)
            }
        }
        cargar()
        return () => { cancelado = true }
    }, [pedidoId])

    // 2a. Escritorio: blob URL para el iframe
    useEffect(() => {
        if (!pdfData || usarCanvas !== false) return
        const blob = new Blob([base64ToBytes(pdfData)], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        setPdfUrl(url)
        return () => URL.revokeObjectURL(url)
    }, [pdfData, usarCanvas])

    // 2b. Celular / WebView: dibujar con PDF.js en canvas
    useEffect(() => {
        if (!pdfData || usarCanvas !== true) return
        let cancelado = false
        let pdfDoc: any = null

        const renderizar = async () => {
            setRenderizando(true)
            try {
                const pdfjs = await cargarPdfJs()
                pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

                pdfDoc = await pdfjs.getDocument({ data: base64ToBytes(pdfData) }).promise
                const cont = paginasRef.current
                if (!cont || cancelado) return
                cont.innerHTML = ''

                const ancho = cont.clientWidth || window.innerWidth - 32
                const dpr = Math.min(window.devicePixelRatio || 1, 2)

                for (let i = 1; i <= pdfDoc.numPages; i++) {
                    if (cancelado) return
                    const page = await pdfDoc.getPage(i)
                    const base = page.getViewport({ scale: 1 })
                    const viewport = page.getViewport({ scale: (ancho / base.width) * dpr })

                    const canvas = document.createElement('canvas')
                    canvas.width = Math.floor(viewport.width)
                    canvas.height = Math.floor(viewport.height)
                    canvas.style.width = '100%'
                    canvas.style.height = 'auto'
                    canvas.className = 'mb-4 shadow-md rounded-lg border border-gray-200 bg-white'

                    const ctx = canvas.getContext('2d')
                    if (!ctx) throw new Error('Canvas 2D no disponible')
                    cont.appendChild(canvas)

                    await page.render({ canvasContext: ctx, viewport }).promise
                    page.cleanup()
                }
            } catch (e: any) {
                console.error('Error renderizando PDF:', e)
                if (!cancelado) {
                    setError(`No se pudo mostrar el PDF (${e?.message || e})`)
                }
            } finally {
                if (!cancelado) setRenderizando(false)
            }
        }

        renderizar()
        return () => {
            cancelado = true
            pdfDoc?.destroy?.()
        }
    }, [pdfData, usarCanvas])

    const descargar = () => {
        if (!pdfData) return
        const blob = new Blob([base64ToBytes(pdfData)], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = nombreArchivo
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    const urlLimpia = pdfUrl ? `${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH` : ''
    const mostrandoCarga = cargando || renderizando || usarCanvas === null

    return (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-4xl h-full sm:h-[90vh] rounded-none sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden">

                {/* HEADER */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3 shrink-0 bg-[#F7F7FB]">
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
                            disabled={!pdfData}
                            className="h-10 px-3 sm:px-4 flex items-center gap-2 rounded-lg bg-[#1A0087] text-white text-sm font-semibold hover:bg-[#130066] disabled:opacity-40 transition-colors"
                        >
                            <ArrowDownTrayIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">Descargar</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* VISOR */}
                <div className="flex-1 relative bg-gray-200 min-h-0">

                    {/* Celular / WebView: canvas */}
                    {usarCanvas === true && (
                        <div className="absolute inset-0 overflow-y-auto p-4 bg-gray-100">
                            <div ref={paginasRef} />
                        </div>
                    )}

                    {/* Escritorio: iframe como antes */}
                    {usarCanvas === false && !cargando && pdfUrl && (
                        <iframe
                            src={urlLimpia}
                            title="Vista previa de cotización"
                            className="w-full h-full border-0 bg-white"
                        />
                    )}

                    {mostrandoCarga && !error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#F7F7FB] z-10">
                            <div className="w-10 h-10 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-[#828282]">
                                {cargando ? 'Generando cotización...' : 'Dibujando páginas...'}
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-[#F7F7FB] z-10">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                <XMarkIcon className="w-6 h-6 text-red-600" />
                            </div>
                            <p className="text-sm text-red-700 font-medium max-w-xs break-words">{error}</p>
                            <button
                                onClick={onClose}
                                className="px-4 py-2.5 bg-[#1A0087] text-white rounded-xl text-sm font-semibold"
                            >
                                Cerrar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
