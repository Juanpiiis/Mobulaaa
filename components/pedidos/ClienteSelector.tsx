'use client'

import { useState } from 'react'
import {
    MagnifyingGlassIcon,
    UserPlusIcon,
    UserIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline'
import { ClienteBuscadorModal } from './ClienteBuscadorModal'
import type { Cliente } from '@/types/clientes'

interface Props {
    clienteSeleccionado: Cliente | null
    onClienteSeleccionado: (cliente: Cliente) => void
    onLimpiar: () => void
    onVerHistorial: (cliente: Cliente) => void
}

export function ClienteSelector({
    clienteSeleccionado,
    onClienteSeleccionado,
    onLimpiar,
    onVerHistorial,
}: Props) {
    const [modalAbierto, setModalAbierto] = useState(false)

    // Si ya hay cliente seleccionado → mostrar tarjeta compacta con opción de cambiar
    if (clienteSeleccionado) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-11 h-11 shrink-0 rounded-full bg-green-500 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#232323] truncate">
                        {clienteSeleccionado.nombre}
                    </p>
                    <p className="text-xs text-[#828282] truncate">
                        CC/NIT: {clienteSeleccionado.cc_nit}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onLimpiar}
                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-white active:bg-gray-100 transition-colors"
                    aria-label="Cambiar cliente"
                >
                    <XMarkIcon className="w-4 h-4" />
                </button>
            </div>
        )
    }

    // Si no hay cliente → botón grande para abrir el modal
    return (
        <>
            <button
                type="button"
                onClick={() => setModalAbierto(true)}
                className="w-full text-left bg-white border border-gray-200 rounded-2xl p-4 hover:border-[#1A0087] hover:bg-[#1A0087]/5 active:scale-[0.99] transition-all group"
            >
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 shrink-0 rounded-full bg-[#1A0087]/10 flex items-center justify-center group-hover:bg-[#1A0087]/20 transition-colors">
                        <MagnifyingGlassIcon className="w-5 h-5 text-[#1A0087]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#232323]">
                            Buscar cliente
                        </p>
                        <p className="text-xs text-[#828282] mt-0.5">
                            Por CC/NIT · También puedes registrar uno nuevo
                        </p>
                    </div>
                    <UserPlusIcon className="w-5 h-5 text-gray-400 shrink-0 group-hover:text-[#1A0087] transition-colors" />
                </div>
            </button>

            <ClienteBuscadorModal
                abierto={modalAbierto}
                onClose={() => setModalAbierto(false)}
                onSeleccionar={(c) => {
                    onClienteSeleccionado(c)
                    setModalAbierto(false)
                }}
                onVerHistorial={(c) => {
                    setModalAbierto(false)
                    onVerHistorial(c)
                }}
            />
        </>
    )
}