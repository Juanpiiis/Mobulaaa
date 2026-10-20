export function MargenTab() {
    return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-sm text-yellow-800">
            <p className="font-bold mb-2">⚠️ Margen y utilidad — pendiente</p>
            <p>La tabla <code>productos</code> aún no tiene campo de <strong>costo</strong>. Cuando se agregue (vía script de carga de costos), aquí se mostrarán:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>Margen por producto</li>
                <li>Más y menos rentables (top / bottom 5)</li>
                <li>Margen por vendedor, cliente o categoría</li>
            </ul>
        </div>
    )
}