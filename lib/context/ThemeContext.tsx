'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Tema = 'light' | 'dark'

interface ThemeContextType {
    tema: Tema
    toggleTema: () => void
    setTema: (t: Tema) => void
}

const ThemeContext = createContext<ThemeContextType>({
    tema: 'light',
    toggleTema: () => { },
    setTema: () => { },
})

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [tema, setTemaState] = useState<Tema>('light')
    const [montado, setMontado] = useState(false)

    // Al montar: lee de localStorage o del sistema
    useEffect(() => {
        const stored = localStorage.getItem('mobulaa-tema') as Tema | null
        if (stored === 'light' || stored === 'dark') {
            setTemaState(stored)
        } else {
            const prefiereOscuro = window.matchMedia('(prefers-color-scheme: dark)').matches
            setTemaState(prefiereOscuro ? 'dark' : 'light')
        }
        setMontado(true)
    }, [])

    // Aplica la clase al <html> cada vez que cambia el tema
    useEffect(() => {
        if (!montado) return
        const root = document.documentElement
        if (tema === 'dark') {
            root.classList.add('dark')
        } else {
            root.classList.remove('dark')
        }
    }, [tema, montado])

    const setTema = (t: Tema) => {
        setTemaState(t)
        try {
            localStorage.setItem('mobulaa-tema', t)
        } catch { }
    }

    const toggleTema = () => {
        setTema(tema === 'dark' ? 'light' : 'dark')
    }

    return (
        <ThemeContext.Provider value={{ tema, toggleTema, setTema }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => useContext(ThemeContext)