'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const TIEMPO_INACTIVIDAD_MS = 30 * 60 * 1000  // 30 min
const TIEMPO_AVISO_MS = TIEMPO_INACTIVIDAD_MS - 5 * 60 * 1000

const EVENTOS_ACTIVIDAD = [
    'mousedown',
    'mousemove',
    'keydown',
    'scroll',
    'touchstart',
    'click',
    'wheel',
]

export function useInactivityLogout() {
    const router = useRouter()
    const supabase = createClient()
    const [mostrarAviso, setMostrarAviso] = useState(false)
    const [segundosRestantes, setSegundosRestantes] = useState(300)

    const timeoutRef = useRef<NodeJS.Timeout | null>(null)
    const avisoRef = useRef<NodeJS.Timeout | null>(null)
    const contadorRef = useRef<NodeJS.Timeout | null>(null)
    const avisoMostradoRef = useRef(false)

    const cerrarSesion = useCallback(async () => {
        setMostrarAviso(false)
        if (contadorRef.current) clearInterval(contadorRef.current)
        await supabase.auth.signOut()
        localStorage.removeItem('tienda_actual_id')
        router.push('/login?reason=timeout')
    }, [supabase, router])

    const resetTimer = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        if (avisoRef.current) clearTimeout(avisoRef.current)
        if (contadorRef.current) clearInterval(contadorRef.current)

        avisoMostradoRef.current = false
        setMostrarAviso(false)

        avisoRef.current = setTimeout(() => {
            avisoMostradoRef.current = true
            setMostrarAviso(true)
            setSegundosRestantes(300)

            contadorRef.current = setInterval(() => {
                setSegundosRestantes((s) => {
                    if (s <= 1) {
                        if (contadorRef.current) clearInterval(contadorRef.current)
                        return 0
                    }
                    return s - 1
                })
            }, 1000)
        }, TIEMPO_AVISO_MS)

        timeoutRef.current = setTimeout(() => {
            cerrarSesion()
        }, TIEMPO_INACTIVIDAD_MS)
    }, [cerrarSesion])

    const continuarSesion = useCallback(() => {
        resetTimer()
    }, [resetTimer])

    const salirAhora = useCallback(() => {
        cerrarSesion()
    }, [cerrarSesion])

    useEffect(() => {
        const handleActividad = () => {
            if (!avisoMostradoRef.current) {
                resetTimer()
            }
        }

        resetTimer()

        EVENTOS_ACTIVIDAD.forEach((evento) => {
            window.addEventListener(evento, handleActividad, { passive: true })
        })

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            if (avisoRef.current) clearTimeout(avisoRef.current)
            if (contadorRef.current) clearInterval(contadorRef.current)
            EVENTOS_ACTIVIDAD.forEach((evento) => {
                window.removeEventListener(evento, handleActividad)
            })
        }
    }, [resetTimer])

    return {
        mostrarAviso,
        continuarSesion,
        salirAhora,
        segundosRestantes,
    }
}