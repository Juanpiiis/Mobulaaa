'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Cliente } from '@/types/clientes'

interface Props {
    ccNit: string
    onCreado: (cliente: Cliente) => void
    onCancelar: () => void
}

export function ClienteNuevoForm({ ccNit, onCreado, onCancelar }: Props) {
    const supabase = createClient()
    const [nombre, setNombre] = useState('')
    const [telefono, setTelefono] = useState('')
    const [email, setEmail] = useState('')
    const [direccion, setDireccion] = useState('')
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleCrear = async () => {
        if (!nombre.trim()) {
            setError('El nombre es obligatorio')
            return
        }
        if (guardando) return

        setGuardando(true)
        setError(null)

        try {
            const { data, error: err } = await supabase
                .from('clientes')
                .insert({
                    cc_nit: ccNit.trim(),
                    nombre: nombre.trim(),
                    telefono: telefono.trim() || null,
                    email: email.trim() || null,
                    direccion: direccion.trim() || null,
                    activo: true,
                })
                .select()
                .single()

            // Manejo de UNIQUE (23505): otro usuario lo creó justo antes
            if (err && err.code === '23505') {
                const { data: existente } = await supabase
                    .from('clientes')
                    .select('*')
                    .eq('cc_nit', ccNit.trim())
                    .maybeSingle()

                if (existente) {
                    onCreado(existente as Cliente)
                    return
                }
                setError('Este cliente ya existe pero no se pudo recuperar')
                return
            }

            if (err) {
                setError('No se pudo crear el cliente. Intenta de nuevo.')
                return
            }

            if (data) {
                onCreado(data as Cliente)
            }
        } catch {
            setError('Error inesperado. Intenta de nuevo.')
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div className="border border-yellow-200 bg-yellow-50/50 rounded-xl p-4 mt-3">
            <div className="mb-3">
                <p className="text-sm font-semibold text-yellow-700">⚠️ Cliente no encontrado</p>
                <p className="text-xs text-gray-500 mt-1">Registra los datos para continuar</p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-100 space-y-3">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">CC / NIT</label>
                    <input
                        className="w-full border border-gray-200 p-2 rounded-lg text-sm bg-gray-50"
                        value={ccNit}
                        disabled
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
                    <input
                        className="w-full border border-gray-200 p-2 rounded-lg text-sm focus:border-[#1A0087] focus:outline-none"
                        placeholder="Nombre completo"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Teléfono</label>
                        <input
                            className="w-full border border-gray-200 p-2 rounded-lg text-sm focus:border-[#1A0087] focus:outline-none"
                            placeholder="300 123 4567"
                            value={telefono}
                            onChange={(e) => setTelefono(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Email</label>
                        <input
                            className="w-full border border-gray-200 p-2 rounded-lg text-sm focus:border-[#1A0087] focus:outline-none"
                            placeholder="cliente@email.com"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Dirección</label>
                    <input
                        className="w-full border border-gray-200 p-2 rounded-lg text-sm focus:border-[#1A0087] focus:outline-none"
                        placeholder="Dirección"
                        value={direccion}
                        onChange={(e) => setDireccion(e.target.value)}
                    />
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}
            </div>

            <div className="flex gap-2 mt-3">
                <button
                    type="button"
                    onClick={onCancelar}
                    disabled={guardando}
                    className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={handleCrear}
                    disabled={guardando || !nombre.trim()}
                    className="flex-1 px-4 py-2 text-sm bg-[#1A0087] text-white rounded-lg hover:bg-[#130066] disabled:opacity-50 font-medium"
                >
                    {guardando ? 'Creando...' : 'Crear y continuar'}
                </button>
            </div>
        </div>
    )
}