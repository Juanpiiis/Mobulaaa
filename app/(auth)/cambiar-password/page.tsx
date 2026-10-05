'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { EyeIcon, EyeSlashIcon, LockClosedIcon } from '@heroicons/react/24/outline'

export default function CambiarPasswordPage() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [userName, setUserName] = useState('')
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.replace('/login'); return }

            const { data: perfil } = await supabase
                .from('usuarios')
                .select('nombre, requiere_cambio_password')
                .eq('id', user.id)
                .single()

            if (!perfil) { router.replace('/login'); return }

            if (!perfil.requiere_cambio_password) {
                router.replace('/dashboard'); return
            }

            setUserName(perfil.nombre || 'Usuario')
        }
        checkUser()
    }, [router, supabase])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
        if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }
        if (!/[A-Z]/.test(password)) { setError('Debe tener al menos una mayúscula'); return }
        if (!/[a-z]/.test(password)) { setError('Debe tener al menos una minúscula'); return }
        if (!/\d/.test(password)) { setError('Debe tener al menos un número'); return }

        setLoading(true)

        try {
            const { error: authError } = await supabase.auth.updateUser({ password })

            if (authError) {
                setError('Error: ' + authError.message)
                setLoading(false)
                return
            }

            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                await supabase
                    .from('usuarios')
                    .update({ requiere_cambio_password: false })
                    .eq('id', user.id)

                const { data: perfil } = await supabase
                    .from('usuarios')
                    .select('rol')
                    .eq('id', user.id)
                    .single()

                if (perfil?.rol === 'admin') router.push('/admin')
                else if (perfil?.rol === 'bodeguero') router.push('/bodeguero')
                else if (perfil?.rol === 'vendedor') router.push('/vendedor')
                else if (perfil?.rol === 'cartera') router.push('/cartera')
                else router.push('/dashboard')
            }
        } catch (err: any) {
            setError('Error inesperado: ' + err.message)
            setLoading(false)
        }
    }

    return (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-10">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
                <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-[#1A0087]/10 flex items-center justify-center">
                        <LockClosedIcon className="w-8 h-8 text-[#1A0087]" />
                    </div>
                </div>

                <h1 className="text-xl sm:text-2xl font-bold mb-2 text-center text-[#232323]">
                    Cambia tu contraseña
                </h1>

                <p className="text-xs text-center text-[#828282] mb-6">
                    Hola <span className="font-semibold">{userName}</span>, por seguridad debes cambiar tu contraseña antes de continuar.
                </p>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2.5 rounded-xl mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Nueva contraseña
                        </label>
                        <div className="relative">
                            <input
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-11 text-base min-h-[44px] focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 transition-colors"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Mínimo 8 caracteres"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-xl text-gray-500 hover:text-gray-700 active:bg-gray-100 transition-colors"
                            >
                                {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Confirmar contraseña
                        </label>
                        <input
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base min-h-[44px] focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 transition-colors"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Repite la contraseña"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                        <p className="text-xs font-medium text-gray-600 mb-2">La contraseña debe tener:</p>
                        <div className={`text-xs flex items-center gap-2 ${password.length >= 8 ? 'text-green-600' : 'text-gray-400'}`}>
                            <span>{password.length >= 8 ? '✓' : '○'}</span> Al menos 8 caracteres
                        </div>
                        <div className={`text-xs flex items-center gap-2 ${/[A-Z]/.test(password) ? 'text-green-600' : 'text-gray-400'}`}>
                            <span>{/[A-Z]/.test(password) ? '✓' : '○'}</span> Una mayúscula
                        </div>
                        <div className={`text-xs flex items-center gap-2 ${/[a-z]/.test(password) ? 'text-green-600' : 'text-gray-400'}`}>
                            <span>{/[a-z]/.test(password) ? '✓' : '○'}</span> Una minúscula
                        </div>
                        <div className={`text-xs flex items-center gap-2 ${/\d/.test(password) ? 'text-green-600' : 'text-gray-400'}`}>
                            <span>{/\d/.test(password) ? '✓' : '○'}</span> Un número
                        </div>
                        <div className={`text-xs flex items-center gap-2 ${password && password === confirmPassword ? 'text-green-600' : 'text-gray-400'}`}>
                            <span>{password && password === confirmPassword ? '✓' : '○'}</span> Las contraseñas coinciden
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full min-h-[44px] bg-[#1A0087] hover:bg-[#130066] active:scale-[0.98] text-white font-medium rounded-xl px-4 py-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        {loading ? 'Cambiando...' : 'Cambiar contraseña'}
                    </button>
                </form>
            </div>
        </div>
    )
}