'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { EnvelopeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'

export default function OlvidePasswordPage() {
    const [email, setEmail] = useState('')
    const [mensaje, setMensaje] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    // Si el callback detectó un enlace vencido o inválido
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.get('error') === 'link_invalido') {
            setError('El enlace venció o no es válido. Solicita uno nuevo y ábrelo en el mismo navegador.')
            window.history.replaceState({}, '', '/olvide-password')
        }
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setMensaje('')
        setLoading(true)

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                // Ahora apunta al callback que crea la sesión
                redirectTo: `${window.location.origin}/auth/callback`,
            })

            if (resetError) {
                setError('Error: ' + resetError.message)
            } else {
                setMensaje('Si el correo está registrado, recibirás las instrucciones para restablecer tu contraseña. Revisa también la carpeta de spam.')
            }
        } catch (err: any) {
            setError('Ocurrió un error inesperado.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-10">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
                <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-[#1A0087]/10 flex items-center justify-center">
                        <EnvelopeIcon className="w-8 h-8 text-[#1A0087]" />
                    </div>
                </div>

                <h1 className="text-xl sm:text-2xl font-bold mb-2 text-center text-[#232323]">
                    ¿Olvidaste tu contraseña?
                </h1>

                <p className="text-xs text-center text-[#828282] mb-6">
                    Ingresa tu correo electrónico y te enviaremos las instrucciones para recuperarla.
                </p>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2.5 rounded-xl mb-4 text-sm">
                        {error}
                    </div>
                )}

                {mensaje && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2.5 rounded-xl mb-4 text-sm">
                        {mensaje}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Correo electrónico
                        </label>
                        <input
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base min-h-[44px] focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 transition-colors"
                            type="email"
                            placeholder="tu@correo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full min-h-[44px] bg-[#1A0087] hover:bg-[#130066] active:scale-[0.98] text-white font-medium rounded-xl px-4 py-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        {loading ? 'Enviando...' : 'Enviar instrucciones'}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-2 text-xs font-medium text-[#1A0087] hover:underline"
                    >
                        <ArrowLeftIcon className="w-4 h-4" /> Volver al inicio de sesión
                    </Link>
                </div>
            </div>
        </div>
    )
}