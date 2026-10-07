'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Cliente } from '@/types/clientes'

interface Props {
    ccNit: string
    nombreInicial?: string
    telefonoInicial?: string
    onCreado: (cliente: Cliente) => void
    onCancelar: () => void
}

const inputClass =
    'w-full border border-gray-200 px-3 py-2.5 rounded-xl text-base min-h-[44px] focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 transition-colors'

export function ClienteNuevoForm({
    ccNit,
    nombreInicial = '',
    telefonoInicial = '',
    onCreado,
    onCancelar,
}: Props) {
    const supabase = createClient()
    const [nombre, setNombre] = useState(nombreInicial)
    const [telefono, setTelefono] = useState(telefonoInicial)
    const [direccion, setDireccion] = useState('')
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Si cambian los valores iniciales, actualizamos
    useEffect(() => {
        setNombre(nombreInicial)
    }, [nombreInicial])

    useEffect(() => {
        setTelefono(telefonoInicial)
    }, [telefonoInicial])

    // ─────────────────────────────────────────────────────
    // Validaciones
    // ─────────────────────────────────────────────────────
    const validar = (): string | null => {
        const ccLimpio = ccNit.trim()
        const nombreLimpio = nombre.trim()
        const telefonoLimpio = telefono.trim()

        if (!ccLimpio) {
            return 'El CC/NIT es obligatorio'
        }

        if (!/^\d+$/.test(ccLimpio)) {
            return 'El CC/NIT debe contener solo números'
        }

        if (ccLimpio.length < 5) {
            return 'El CC/NIT debe tener al menos 5 dígitos'
        }

        if (ccLimpio.length > 15) {
            return 'El CC/NIT no puede tener más de 15 dígitos'
        }

        if (!nombreLimpio) {
            return 'El nombre es obligatorio'
        }

        if (nombreLimpio.length < 3) {
            return 'El nombre debe tener al menos 3 caracteres'
        }

        if (nombreLimpio.length > 100) {
            return 'El nombre no puede tener más de 100 caracteres'
        }

        if (/^\d+$/.test(nombreLimpio)) {
            return 'El nombre no puede ser solo números'
        }

        if (telefonoLimpio) {
            const telNumeros = telefonoLimpio.replace(/\D/g, '')
            if (telNumeros.length < 7) {
                return 'El teléfono debe tener al menos 7 dígitos'
            }
            if (telNumeros.length > 15) {
                return 'El teléfono no puede tener más de 15 dígitos'
            }
        }

        if (direccion.trim().length > 200) {
            return 'La dirección no puede tener más de 200 caracteres'
        }

        return null
    }

    const handleCrear = async () => {
        if (guardando) return

        const errorValidacion = validar()
        if (errorValidacion) {
            setError(errorValidacion)
            return
        }

        setGuardando(true)
        setError(null)

        try {
            const { data, error: err } = await supabase
                .from('clientes')
                .insert({
                    cc_nit: ccNit.trim(),
                    nombre: nombre.trim(),
                    telefono: telefono.trim() || null,
                    email: null, // ← Ya no se pide
                    direccion: direccion.trim() || null,
                    activo: true,
                })
                .select()
                .single()

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
                console.error('Error creando cliente:', err)
                setError('No se pudo crear el cliente. Intenta de nuevo.')
                return
            }

            if (data) {
                onCreado(data as Cliente)
            }
        } catch (e: any) {
            console.error(e)
            setError('Error inesperado. Intenta de nuevo.')
        } finally {
            setGuardando(false)
        }
    }

    const tieneCC = ccNit.trim().length > 0

    return (
        <div className="border border-yellow-200 bg-yellow-50/50 rounded-2xl p-4 mt-3">
            <div className="mb-3">
                <p className="text-sm font-semibold text-yellow-700">⚠️ Cliente no encontrado</p>
                <p className="text-xs text-[#828282] mt-1">
                    {tieneCC ? 'Registra los datos para continuar' : 'Registra los datos del nuevo cliente'}
                </p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-3">
                <div>
                    <label className="block text-xs text-[#828282] mb-1">
                        CC / NIT <span className="text-red-500">*</span>
                    </label>
                    <input
                        className={`${inputClass} ${tieneCC ? 'bg-gray-50 text-gray-600' : ''}`}
                        value={ccNit}
                        disabled
                        placeholder={tieneCC ? '' : 'Sin CC/NIT'}
                    />
                </div>
                <div>
                    <label className="block text-xs text-[#828282] mb-1">
                        Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                        className={inputClass}
                        placeholder="Nombre completo"
                        value={nombre}
                        onChange={(e) => {
                            setNombre(e.target.value)
                            setError(null)
                        }}
                        disabled={guardando}
                        autoFocus={!nombreInicial}
                        maxLength={100}
                    />
                </div>
                <div>
                    <label className="block text-xs text-[#828282] mb-1">Teléfono</label>
                    <input
                        className={inputClass}
                        placeholder="300 123 4567"
                        value={telefono}
                        onChange={(e) => {
                            setTelefono(e.target.value)
                            setError(null)
                        }}
                        inputMode="tel"
                        disabled={guardando}
                        maxLength={20}
                    />
                </div>
                <div>
                    <label className="block text-xs text-[#828282] mb-1">Dirección</label>
                    <input
                        className={inputClass}
                        placeholder="Dirección"
                        value={direccion}
                        onChange={(e) => {
                            setDireccion(e.target.value)
                            setError(null)
                        }}
                        disabled={guardando}
                        maxLength={200}
                    />
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                        <p className="text-xs text-red-700 font-medium">⚠️ {error}</p>
                    </div>
                )}
            </div>

            <div className="flex gap-2 mt-3">
                <button
                    type="button"
                    onClick={onCancelar}
                    disabled={guardando}
                    className="flex-1 min-h-[44px] px-4 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50 transition-all"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={handleCrear}
                    disabled={guardando || !nombre.trim() || !ccNit.trim()}
                    className="flex-1 min-h-[44px] px-4 py-2.5 text-sm bg-[#1A0087] text-white rounded-xl hover:bg-[#130066] active:scale-[0.98] disabled:opacity-50 font-semibold transition-all"
                >
                    {guardando ? 'Creando...' : 'Crear y continuar'}
                </button>
            </div>
        </div>
    )
}