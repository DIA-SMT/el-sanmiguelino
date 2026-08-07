import type { Usuario } from "@/lib/types";

/**
 * Adapter de autenticación Cidituc.
 *
 * PENDIENTE DE CONFIRMAR con el equipo: endpoints/credenciales de Cidituc y si
 * existe una integración SSO reutilizable (OAuth2/OIDC) en otro sistema del
 * municipio. Cuando esté definido, se implementa `CiditucSsoAdapter` con el
 * flujo real (authorize → callback → token → perfil) sin tocar el resto de la
 * app: todo pasa por esta interfaz.
 */
export interface CiditucAuthAdapter {
  /** Inicia el flujo de login y devuelve el usuario autenticado. */
  login(): Promise<Usuario>;
}

/** Mock para desarrollo: simula un login exitoso con un usuario Cidituc. */
export const mockCiditucAdapter: CiditucAuthAdapter = {
  async login() {
    return { id: "cidituc-demo-001", nombre: "María González" };
  },
};

export const ciditucAdapter: CiditucAuthAdapter = mockCiditucAdapter;
