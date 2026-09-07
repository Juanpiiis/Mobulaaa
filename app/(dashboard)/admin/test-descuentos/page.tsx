'use client'
import { useState } from 'react'
import { calcularDescuento, DESCUENTOS } from '@/types/index'

export default function TestDescuentosPage() {
  const [valor, setValor] = useState('')

  const subtotal = parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0
  const porcentaje = calcularDescuento(subtotal)
  const descuento = subtotal * (porcentaje / 100)
  const total = subtotal - descuento

  const formatCOP = (value: number) => new Intl.NumberFormat('es-CO', { 
    style: 'currency', currency: 'COP', minimumFractionDigits: 0 
  }).format(value)

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-2">Test Descuentos</h1>
      <p className="text-gray-500 text-sm mb-6">Simula el cálculo de descuentos por valor de factura</p>

      {/* Tabla de reglas */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <p className="font-medium mb-3">Reglas de descuento:</p>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Valor mínimo</th>
              <th className="p-2 text-left">Descuento</th>
            </tr>
          </thead>
          <tbody>
            {DESCUENTOS.map((d, i) => (
              <tr key={i} className={`border-t ${subtotal >= d.minimo ? 'bg-green-50 text-green-700 font-medium' : ''}`}>
                <td className="p-2">{formatCOP(d.minimo)}</td>
                <td className="p-2">{d.porcentaje}%</td>
              </tr>
            ))}
            <tr className={`border-t ${subtotal < 1000000 ? 'bg-green-50 text-green-700 font-medium' : ''}`}>
              <td className="p-2">Menos de {formatCOP(1000000)}</td>
              <td className="p-2">Sin descuento</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Calculadora */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <label className="block text-sm font-medium mb-2">Ingresa el valor del pedido:</label>
        <input
          className="w-full border p-3 rounded text-lg mb-4"
          type="number"
          placeholder="Ej: 1500000"
          value={valor}
          onChange={e => setValor(e.target.value)}
        />

        {subtotal > 0 && (
          <div className="border-t pt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatCOP(subtotal)}</span>
            </div>
            {porcentaje > 0 ? (
              <div className="flex justify-between text-sm mb-2 text-green-600">
                <span>Descuento ({porcentaje}%)</span>
                <span>- {formatCOP(descuento)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-sm mb-2 text-gray-400">
                <span>Descuento</span>
                <span>No aplica</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total</span>
              <span>{formatCOP(total)}</span>
            </div>

            {porcentaje > 0 && (
              <div className="mt-3 bg-green-50 text-green-700 p-3 rounded text-sm">
                ✅ Aplica descuento del {porcentaje}% por superar {formatCOP(DESCUENTOS.find(d => d.porcentaje === porcentaje)?.minimo || 0)}
              </div>
            )}
            {porcentaje === 0 && subtotal > 0 && (
              <div className="mt-3 bg-yellow-50 text-yellow-700 p-3 rounded text-sm">
                ⚠️ No aplica descuento. Necesita {formatCOP(1000000 - subtotal)} más para el primer descuento
              </div>
            )}
          </div>
        )}
      </div>

      {/* Casos de prueba rápidos */}
      <div className="bg-white rounded-lg shadow p-4">
        <p className="font-medium mb-3">Casos de prueba rápidos:</p>
        <div className="flex flex-wrap gap-2">
          {[500000, 1000000, 1500000, 2000000, 3000000, 5000000, 8000000].map(v => (
            <button
              key={v}
              onClick={() => setValor(String(v))}
              className="bg-gray-100 hover:bg-blue-50 hover:text-blue-600 px-3 py-1 rounded text-sm border"
            >
              {formatCOP(v)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}