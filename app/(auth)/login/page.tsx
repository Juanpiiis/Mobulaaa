'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return setError(error.message)
    
    const { data: profile } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', data.user.id)
      .single()

    if (profile?.rol === 'admin') router.push('/admin')
    else if (profile?.rol === 'bodeguero') router.push('/bodeguero')
    else router.push('/vendedor')
  }

  return (
    <div className="login-page-bg">
      <div className="login-card">
        {/* Etiqueta img estándar para evitar errores de pre-carga en Codespaces */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img 
            src="/logo-mobulaa.png" 
            alt="Logo Mobulaa" 
            style={{ width: '200px', height: 'auto', display: 'inline-block' }} 
          />
        </div>
        
        <h1 className="text-2xl font-bold mb-6 text-center" style={{ color: '#232323' }}>
          Inicio de Sesión
        </h1>
        
        {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}
        
        <input 
          className="input-mobulaa" 
          type="email" 
          placeholder="Correo" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
        />
        
        <input 
          className="input-mobulaa" 
          type="password" 
          placeholder="Contraseña" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
        />
        
        <button onClick={handleLogin} className="btn-mobulaa">
          Ingresar
        </button>
        
        <p className="text-center mt-4 text-sm">
          ¿No tienes cuenta? <a href="/registro" className="text-[#1A0087] font-bold">Regístrate</a>
        </p>
      </div>
    </div>
  )
}