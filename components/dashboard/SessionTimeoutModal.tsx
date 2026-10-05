'use client'

import { ClockIcon } from '@heroicons/react/24/outline'

interface Props {
    onContinuar: () => void
    onSalir: () => void
    segundosRestantes: number
}

export function SessionTimeoutModal({ onContinuar, onSalir, segundosRestantes }: Props) {
    return (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ClockIcon className="w-8 h-8 text-yellow-600" />
                </div>

                <h3 className="text-lg font-bold text-[#232323] mb-2">
                    Tu sesión está por expirar
                </h3>

                <p className="text-sm text-[#828282] mb-4">
                    Por seguridad, cerraremos tu sesión por inactividad.
                </p>

                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-5">
                    <p className="text-xs text-yellow-700 font-medium mb-1">
                        Tiempo restante
                    </p>
                    <p className="text-2xl font-bold text-yellow-600 font-mono">
                        {Math.floor(segundosRestantes / 60).toString().padStart(2, '0')}:
                        {(segundosRestantes % 60).toString().padStart(2, '0')}
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={onSalir}
                        className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 text-[#232323] bg-white hover:bg-gray-50 active:scale-[0.98] font-medium text-sm transition-all"
                    >
                        Cerrar sesión
                    </button>
                    <button
                        onClick={onContinuar}
                        className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1A0087] text-white hover:bg-[#130066] active:scale-[0.98] font-medium text-sm transition-all"
                    >
                        Continuar conectado
                    </button>
                </div>
            </div>
        </div>
    )
}