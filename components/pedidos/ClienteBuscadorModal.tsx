'use client'

import { useState, useEffect } from 'react'
import {
    XMarkIcon,
    MagnifyingGlassIcon,
    UserIcon,
    PhoneIcon,
    ShoppingBagIcon,
    UserPlusIcon,
} from '@heroicons/react/24/outline'
import { useBuscarCliente } from '@/lib/hooks/useBuscarCliente'
import { ClienteNuevoForm } from './ClienteNuevoForm'
import type { Cliente } from '@/types/clientes'

interface Props {
    abierto: boolean
    onClose: () => void
    onSeleccionar: (cliente: Cliente) => void
    onVerHistorial: (cliente: Cliente) => void
}

export function ClienteBuscadorModal({ abierto, onClose, onSeleccionar, onVerHistorial }: Props) {
    const [ccNit, setCcNit] = useState('')
    const [modoRegistro, setModoRegistro] = useState(false)
    const { cliente, estado, error } = useBuscarCliente(ccNit)

    // Reset al abrir/cerrar
    useEffect(() => {
        if (abierto) {
            setCcNit('')
            setModoRegistro(false)
        }
    }, [abierto])

    if (!abierto) return null

    const handleCCChange = (valor: string) => {
        const soloNumeros = valor.replace(/\D/g, '')
        setCcNit(soloNumeros)
        setModoRegistro(false)
    }

    const handleCreado = (nuevo: Cliente) => {
        setModoRegistro(false)
        onSeleccionar(nuevo)
    }

    return (
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">

                {/* HEADER */}
                <div className="shrink-0 flex items-center justify-between p-5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-[#1A0087]/10 flex items-center justify-center">
                            <UserIcon className="w-4 h-4 text-[#1A0087]" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[#232323]">Buscar cliente</h2>
                            <p className="text-[11px] text-[#828282]">Por CC o NIT</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                        aria-label="Cerrar"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">

                    {/* Input CC/NIT */}
                    <div>
                        <label className="block text-xs font-semibold text-[#828282] uppercase tracking-wide mb-2">
                            CC / NIT
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={ccNit}
                                onChange={(e) => handleCCChange(e.target.value)}
                                placeholder="Escribe la cédula o NIT"
                                className="w-full pl-4 pr-10 py-3 border border-gray-200 rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#1A0087]/20 focus:border-[#1A0087]"
                                autoFocus
                                onKeyDown={(e) => {
                                    const permitidas = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
                                    if (permitidas.includes(e.key)) return
                                    if (e.ctrlKey || e.metaKey) return
                                    if (!/^\d$/.test(e.key)) e.preventDefault()
                                }}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {estado === 'buscando' ? (
                                    <div className="w-5 h-5 border-2 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Estados */}
                    {estado === 'escribiendo' && ccNit.length >= 3 && (
                        <p className="text-xs text-[#828282] text-center py-4">Escribiendo…</p>
                    )}
                    {estado === 'buscando' && (
                        <p className="text-xs text-[#828282] text-center py-4">Buscando…</p>
                    )}
                    {estado === 'error' && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                            <p className="text-xs text-red-700">{error || 'Error al buscar'}</p>
                        </div>
                    )}

                    {/* Encontrado */}
                    {estado === 'encontrado' && cliente && !modoRegistro && (
                        <div className="space-y-3">
                            <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center gap-2">
                                <span className="text-green-600 text-sm font-semibold">✓ Cliente encontrado</span>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-12 h-12 rounded-full bg-[#1A0087]/10 flex items-center justify-center flex-shrink-0">
                                        <UserIcon className="w-6 h-6 text-[#1A0087]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-[#232323] truncate">
                                            {cliente.nombre}
                                        </p>
                                        <p className="text-xs text-[#828282] mt-0.5">
                                            CC/NIT: {cliente.cc_nit}
                                        </p>
                                        {cliente.telefono && (
                                            <p className="text-xs text-[#828282] mt-0.5 flex items-center gap-1">
                                                <PhoneIcon className="w-3 h-3" /> {cliente.telefono}
                                            </p>
                                        )}
                                        <p className="text-xs text-[#828282] mt-1 flex items-center gap-1">
                                            <ShoppingBagIcon className="w-3 h-3" />
                                            Cliente registrado
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => onVerHistorial(cliente)}
                                        className="flex-1 min-h-[44px] px-4 py-2.5 text-sm border border-gray-300 rounded-xl text-[#232323] hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium"
                                    >
                                        Ver historial
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onSeleccionar(cliente)}
                                        className="flex-1 min-h-[44px] px-4 py-2.5 text-sm bg-[#1A0087] text-white rounded-xl hover:bg-[#130066] active:scale-[0.98] transition-all font-medium"
                                    >
                                        Continuar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* No encontrado */}
                    {estado === 'no_encontrado' && !modoRegistro && ccNit.trim().length >= 3 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                            <p className="text-sm font-semibold text-yellow-800">
                                ⚠️ Cliente no encontrado
                            </p>
                            <p className="text-xs text-[#828282] mt-1">
                                No hay ningún cliente con la CC/NIT{' '}
                                <span className="font-medium">{ccNit}</span>
                            </p>
                            <button
                                type="button"
                                onClick={() => setModoRegistro(true)}
                                className="mt-3 w-full min-h-[44px] px-4 py-2.5 text-sm bg-[#1A0087] text-white rounded-xl hover:bg-[#130066] active:scale-[0.98] font-medium transition-all flex items-center justify-center gap-2"
                            >
                                <UserPlusIcon className="w-4 h-4" />
                                Registrar nuevo cliente
                            </button>
                        </div>
                    )}

                    {/* Formulario de registro */}
                    {modoRegistro && (
                        <ClienteNuevoForm
                            ccNit={ccNit}
                            onCreado={handleCreado}
                            onCancelar={() => setModoRegistro(false)}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}