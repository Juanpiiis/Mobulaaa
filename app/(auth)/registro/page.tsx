'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function RegistroPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleRegistro = async () => {
    setError('')
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signUp({ email, password })
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: dbError } = await supabase.from('usuarios').insert({
        id: data.user.id,
        nombre,
        email,
        rol: 'vendedor'
      })

      if (dbError) {
        setError('Error al guardar datos: ' + dbError.message)
        setLoading(false)
        return
      }
    }
    router.push('/vendedor')
  }

  return (
    <div className="login-page-bg">
      <div className="login-card">
        {/* Aquí puedes colocar el logo igual que en login */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img 
            src="/logo-mobulaa.png" 
            alt="Logo Mobulaa" 
            style={{ width: '200px', height: 'auto', display: 'inline-block' }} 
          />
        </div>

        <h1 className="text-2xl font-bold mb-6 text-center" style={{ color: '#232323' }}>
          Crear cuenta
        </h1>

        {error && <p className="text-red-500 mb-4 text-sm text-center">{error}</p>}

        <input 
          className="input-mobulaa" 
          type="text" 
          placeholder="Nombre completo" 
          value={nombre} 
          onChange={e => setNombre(e.target.value)} 
        />
        
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

        <button 
          onClick={handleRegistro} 
          disabled={loading}
          className="btn-mobulaa"
        >
          {loading ? 'Registrando...' : 'Registrarse'}
        </button>

        <p className="text-center mt-4 text-sm">
          ¿Ya tienes cuenta? <a href="/login" className="text-[#1A0087] font-bold">Inicia sesión</a>
        </p>
      </div>
    </div>
  )
}