-- ============================================================
-- Migración: RLS específicas para productos y cortes
-- Fecha: 2026-10-09
-- Descripción:
--   - productos: SELECT para authenticated, ALL solo para admin
--   - cortes: eliminar "Acceso total cortes" para que valga cortes_admin_only
-- ============================================================

BEGIN;

-- ============================================================
-- 0. ELIMINAR POLÍTICAS ANÓNIMAS RESIDUALES
-- ============================================================

DROP POLICY IF EXISTS "Acceso anon productos" ON productos;
DROP POLICY IF EXISTS "Acceso anon cortes" ON cortes;

-- ============================================================
-- 1. PRODUCTOS: reemplazar políticas amplias
-- ============================================================

DROP POLICY IF EXISTS "Acceso total productos" ON productos;
DROP POLICY IF EXISTS "acceso total autenticados" ON productos;

-- SELECT para cualquier autenticado
CREATE POLICY "productos_select_authenticated" ON productos
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ALL solo para admin
CREATE POLICY "productos_admin_all" ON productos
  FOR ALL
  TO authenticated
  USING (es_admin())
  WITH CHECK (es_admin());

-- ============================================================
-- 2. CORTES: eliminar "Acceso total cortes"
-- ============================================================

DROP POLICY IF EXISTS "Acceso total cortes" ON cortes;

-- (cortes_admin_only ya existe y se mantiene: es_admin() para ALL)

-- ============================================================
-- 3. RECARGAR SCHEMA
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 4. VERIFICACIÓN
-- ============================================================
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('productos', 'cortes')
ORDER BY tablename, policyname;

COMMIT;