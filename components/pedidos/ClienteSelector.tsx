'use client'

import { useState } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useBuscarCliente } from '@/lib/hooks/useBuscarCliente'
import { ClienteCard } from './ClienteCard'
import { ClienteNuevoForm } from './ClienteNuevoForm'
import type { Cliente } from '@/types/clientes'

interface Props {
    onClienteSeleccionado: (cliente: Cliente) => void
    onVerHistorial: (cliente: Cliente) => void
}

export function ClienteSelector({ onClienteSeleccionado, onVerHistorial }: Props) {
    const [ccNit, setCcNit] = useState('')
    const [modoRegistro, setModoRegistro] = useState(false)
    const { cliente, estado, error } = useBuscarCliente(ccNit)
    const [pedidosCount] = useState(0)

    const handleContinuar = () => {
        if (cliente) onClienteSeleccionado(cliente)
    }

    const handleClienteCreado = (nuevo: Cliente) => {
        setModoRegistro(false)
        onClienteSeleccionado(nuevo)
    }

    // Solo números
    const handleCCChange = (valor: string) => {
        const soloNumeros = valor.replace(/\D/g, '')
        setCcNit(soloNumeros)
        setModoRegistro(false)
    }

    return (
        <div>
            <label className="block text-sm font-medium text-[#232323] mb-2">
                CC / NIT <span className="text-red-500">*</span>
            </label>
            <div className="relative">
                <input
                    className="w-full border border-gray-200 p-3 pr-10 rounded-lg text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
                    placeholder="Escribe la cédula o NIT"
                    value={ccNit}
                    onChange={(e) => handleCCChange(e.target.value)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    onKeyDown={(e) => {
                        const teclasPermitidas = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
                        if (teclasPermitidas.includes(e.key)) return
                        if (e.ctrlKey || e.metaKey) return
                        if (!/^\d$/.test(e.key)) e.preventDefault()
                    }}
                    autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {estado === 'buscando' ? (
                        <div className="w-4 h-4 border-2 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />
                    )}
                </div>
            </div>

            {estado === 'escribiendo' && ccNit.length >= 3 && (
                <p className="text-xs text-gray-400 mt-2">Escribiendo…</p>
            )}
            {estado === 'buscando' && (
                <p className="text-xs text-gray-500 mt-2">Buscando…</p>
            )}
            {estado === 'error' && (
                <p className="text-xs text-red-500 mt-2">{error || 'Error al buscar'}</p>
            )}

            {estado === 'encontrado' && cliente && !modoRegistro && (
                <ClienteCard
                    cliente={cliente}
                    pedidosCount={pedidosCount}
                    onVerHistorial={() => onVerHistorial(cliente)}
                    onContinuar={handleContinuar}
                />
            )}

            {estado === 'no_encontrado' && !modoRegistro && ccNit.trim().length >= 3 && (
                <div className="border border-yellow-200 bg-yellow-50/50 rounded-xl p-4 mt-3">
                    <p className="text-sm font-semibold text-yellow-700">⚠️ Cliente no encontrado</p>
                    <p className="text-xs text-gray-500 mt-1">
                        No hay ningún cliente con la CC/NIT <span className="font-medium">{ccNit}</span>
                    </p>
                    <button
                        type="button"
                        onClick={() => setModoRegistro(true)}
                        className="mt-3 w-full px-4 py-2 text-sm bg-[#1A0087] text-white rounded-lg hover:bg-[#130066] font-medium"
                    >
                        + Registrar nuevo cliente
                    </button>
                </div>
            )}

            {modoRegistro && (
                <ClienteNuevoForm
                    ccNit={ccNit}
                    onCreado={handleClienteCreado}
                    onCancelar={() => setModoRegistro(false)}
                />
            )}
        </div>
    )
}