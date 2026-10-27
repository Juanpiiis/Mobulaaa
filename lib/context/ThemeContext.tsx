'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Tema = 'light' | 'dark'

interface ThemeContextType {
    tema: Tema
    toggleTema: () => void
}

const ThemeContext = createContext<ThemeContextType>({
    tema: 'light',
    toggleTema: () => { },
})

export function ThemeProvider({ children }: { children: ReactNode }) {
    // 🔥 Forzamos que el tema inicial SIEMPRE sea claro
    const [tema, setTema] = useState<Tema>('light')

    useEffect(() => {
        // Al cargar, revisamos si el usuario había guardado una preferencia
        const guardado = localStorage.getItem('mobulaa-tema') as Tema | null

        // Si guardó 'dark' explícitamente, respetamos su elección.
        // Si no hay nada, se queda en 'light' por defecto.
        if (guardado === 'dark') {
            setTema('dark')
        } else {
            setTema('light')
        }
    }, [])

    useEffect(() => {
        const root = window.document.documentElement
        // Aplicar clases al HTML
        if (tema === 'dark') {
            root.classList.add('dark')
        } else {
            root.classList.remove('dark')
        }
        // Guardar en memoria
        localStorage.setItem('mobulaa-tema', tema)
    }, [tema])

    const toggleTema = () => {
        setTema((prev) => (prev === 'light' ? 'dark' : 'light'))
    }

    return (
        <ThemeContext.Provider value={{ tema, toggleTema }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => useContext(ThemeContext)