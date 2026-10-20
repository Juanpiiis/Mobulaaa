'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    CheckCircleIcon,
    XCircleIcon,
    LinkIcon,
    ArrowPathIcon,
    TrashIcon,
} from '@heroicons/react/24/outline'

export default function ConfiguracionPage() {
    const [connected, setConnected] = useState(false)
    const [email, setEmail] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [mensaje, setMensaje] = useState<string | null>(null)

    const supabase = createClient()

    const verificar = async () => {
        setLoading(true)
        // Buscamos el token global (sin importar qué usuario esté logueado)
        const { data } = await supabase
            .from('google_oauth_tokens')
            .select('email')
            .eq('config_key', 'global')
            .maybeSingle()

        if (data) {
            setConnected(true)
            setEmail(data.email)
        } else {
            setConnected(false)
            setEmail(null)
        }
        setLoading(false)
    }

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.get('google_connected') === 'true') {
            setMensaje('✅ Google Drive conectado correctamente a la empresa')
            window.history.replaceState({}, '', '/admin/configuracion')
        }
        if (params.get('google_error')) {
            setMensaje(`❌ Error: ${params.get('google_error')}`)
            window.history.replaceState({}, '', '/admin/configuracion')
        }

        verificar()
    }, [supabase])

    const handleDesconectar = async () => {
        if (!confirm('¿Estás seguro de desconectar Google Drive? Las cotizaciones ya no se subirán automáticamente.')) return

        setLoading(true)
        const { error } = await supabase
            .from('google_oauth_tokens')
            .delete()
            .eq('config_key', 'global')

        if (error) {
            setMensaje(`❌ Error al desconectar: ${error.message}`)
        } else {
            setMensaje('✅ Google Drive desconectado correctamente')
            setConnected(false)
            setEmail(null)
        }
        setLoading(false)
    }

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[#232323]">Configuración</h1>
                <p className="text-sm text-[#828282]">Conecta Google Drive para subir cotizaciones de toda la empresa</p>
            </div>

            {mensaje && (
                <div
                    className={`mb-6 p-4 rounded-xl text-sm ${mensaje.startsWith('✅')
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                        }`}
                >
                    {mensaje}
                </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-[#232323]">Google Drive (Global)</h2>
                        <p className="text-sm text-[#828282] mt-1">
                            Las cotizaciones de todas las bodegas y usuarios se subirán a esta cuenta
                        </p>
                    </div>
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
                    ) : connected ? (
                        <CheckCircleIcon className="w-6 h-6 text-green-600" />
                    ) : (
                        <XCircleIcon className="w-6 h-6 text-red-500" />
                    )}
                </div>

                {connected ? (
                    <div className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                            <p className="text-sm text-green-700 font-medium">
                                ✅ Conectado como:{' '}
                                <span className="font-mono break-all">{email}</span>
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <a
                                href="/api/auth/google"
                                className="flex-1 min-h-[44px] px-4 py-2.5 border border-gray-300 rounded-xl text-[#232323] bg-white hover:bg-gray-50 active:scale-[0.98] font-medium text-sm transition-all flex items-center justify-center gap-2"
                            >
                                <ArrowPathIcon className="w-4 h-4" />
                                Reconectar / Cambiar cuenta
                            </a>
                            <button
                                onClick={handleDesconectar}
                                className="flex-1 min-h-[44px] px-4 py-2.5 border border-red-200 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 active:scale-[0.98] font-medium text-sm transition-all flex items-center justify-center gap-2"
                            >
                                <TrashIcon className="w-4 h-4" />
                                Desconectar Drive
                            </button>
                        </div>
                    </div>
                ) : (
                    <a
                        href="/api/auth/google"
                        className="w-full min-h-[44px] px-4 py-2.5 bg-[#1A0087] rounded-xl text-white hover:bg-[#130066] active:scale-[0.98] font-medium text-sm transition-all flex items-center justify-center gap-2"
                    >
                        <LinkIcon className="w-4 h-4" />
                        Conectar Google Drive
                    </a>
                )}
            </div>
        </div>
    )
}