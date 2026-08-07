/**
 * Gate de Cidituc: ACTIVO. La landing (/) y /login son públicas; el diario
 * completo requiere sesión. Mientras no esté la integración real, el login
 * usa el adapter mock (usuario común de prueba) — ver src/lib/auth/cidituc.ts.
 * Para desarrollo se puede apagar el gate con AUTH_CIDITUC=0.
 */
export const AUTH_CIDITUC_OBLIGATORIA = process.env.AUTH_CIDITUC !== "0";
