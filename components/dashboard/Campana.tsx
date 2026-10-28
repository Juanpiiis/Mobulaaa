'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BellIcon } from '@heroicons/react/24/outline'
import { useNotificaciones } from '@/lib/context/NotificacionesContext'

export function Campana() {
    const { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas } = useNotificaciones()
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.campana-container')) setIsOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="campana-container relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-11 h-11 flex items-center justify-center rounded-xl active:scale-[0.98] relative"
            >
                <BellIcon className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                {/* 🔴 EL PUNTITO ROJO CON NÚMERO */}
                {noLeidas > 0 && (
                    <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[9px] text-white font-bold items-center justify-center">
                            {noLeidas > 9 ? '9+' : noLeidas}
                        </span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="z-50 w-80 max-w-[calc(100vw-1.5rem)] right-0 absolute mt-2 shadow-2xl rounded-xl border border-gray-200 bg-white overflow-hidden dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
                        <p className="font-bold text-[#232323] text-sm dark:text-white">Notificaciones</p>
                        {noLeidas > 0 && (
                            <button onClick={marcarTodasLeidas} className="text-xs text-[#1A0087] dark:text-blue-400 font-medium hover:underline">
                                Marcar todas
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {notificaciones.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-8">No tienes notificaciones</p>
                        ) : (
                            notificaciones.map(n => (
                                <Link
                                    key={n.id}
                                    href={n.link || '#'}
                                    onClick={() => { marcarLeida(n.id); setIsOpen(false) }}
                                    className={`block p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-700 ${!n.leida ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                                >
                                    <div className="flex items-start gap-3">
                                        {!n.leida && <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shrink-0" />}
                                        <div>
                                            <p className={`text-sm ${!n.leida ? 'font-semibold text-[#232323] dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                                {n.titulo}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">{n.mensaje}</p>
                                            {/* 🔥 CORREGIDO: created_at en lugar de fecha */}
                                            <p className="text-[10px] text-gray-400 mt-2">
                                                {new Date(n.created_at).toLocaleString('es-CO')}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}