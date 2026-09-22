export interface Cliente {
  id: string
  cc_nit: string
  nombre: string
  telefono: string | null
  email: string | null
  direccion: string | null
  activo: boolean | null
  fecha_registro: string | null
}

export interface PedidoHistorial {
  id: string
  fecha: string
  estado: string
  total: number
  numero_factura: string | null
}

export type EstadoBusquedaCliente =
  | 'idle'
  | 'escribiendo'
  | 'buscando'
  | 'encontrado'
  | 'no_encontrado'
  | 'error'