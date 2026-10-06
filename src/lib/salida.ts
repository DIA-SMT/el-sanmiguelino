/**
 * "Recién se cerró la sesión", de `UserChip` a `EnlaceIngresar`.
 *
 * Al cerrar sesión el lector se queda en la página, y el botón que tenía el
 * foco desaparece. El "Ingresar" que aparece en su lugar lee esto al montarse,
 * toma el foco y anuncia que se salió. Es una variable del módulo y no estado
 * de React porque el chip y el enlace no conviven: uno reemplaza al otro en el
 * mismo render del `router.refresh()`.
 */
export const salida = { reciente: false };
