export function EmptyState({ msg = 'Sin datos para el periodo' }: { msg?: string }) {
    return <p className="text-gray-400 text-sm py-6 text-center">{msg}</p>
}