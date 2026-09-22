'use client'

import { UserIcon, PhoneIcon, ShoppingBagIcon } from '@heroicons/react/24/outline'
import type { Cliente } from '@/types/clientes'

interface Props {
    cliente: Cliente
    pedidosCount: number
    onVerHistorial: () => void
    onContinuar: () => void
}

export function ClienteCard({ cliente, pedidosCount, onVerHistorial, onContinuar }: Props) {
    return (
        <div className="border border-green-200 bg-green-50/50 rounded-xl p-4 mt-3">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-green-600 text-sm font-semibold">✓ Cliente encontrado</span>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1A0087]/10 flex items-center justify-center flex-shrink-0">
                        <UserIcon className="w-5 h-5 text-[#1A0087]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#232323] truncate">{cliente.nombre}</p>
                        <p className="text-xs text-gray-500 mt-0.5">CC/NIT: {cliente.cc_nit}</p>
                        {cliente.telefono && (
                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                <PhoneIcon className="w-3 h-3" /> {cliente.telefono}
                            </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <ShoppingBagIcon className="w-3 h-3" />
                            {pedidosCount} {pedidosCount === 1 ? 'pedido anterior' : 'pedidos anteriores'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 mt-3">
                <button
                    type="button"
                    onClick={onVerHistorial}
                    className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                    Ver historial
                </button>
                <button
                    type="button"
                    onClick={onContinuar}
                    className="flex-1 px-4 py-2 text-sm bg-[#1A0087] text-white rounded-lg hover:bg-[#130066] transition-colors font-medium"
                >
                    Continuar con pedido
                </button>
            </div>
        </div>
    )
}