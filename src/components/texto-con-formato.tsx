import { Fragment } from "react";
import { tramosConFormato } from "@/lib/formato-en-linea";

/**
 * Un texto con su negrita y su cursiva (ver `formato-en-linea.ts`).
 *
 * Sin hooks: lo usan tanto el diario, del lado del servidor, como la vista
 * previa del editor. La negrita es `font-semibold` y no la `bold` del
 * navegador: en la serif del cuerpo, 700 empasta las letras chicas.
 */
export function TextoConFormato({ texto }: { texto: string }) {
  return (
    <>
      {tramosConFormato(texto).map((t, i) => {
        if (!t.negrita && !t.cursiva) return <Fragment key={i}>{t.texto}</Fragment>;
        const adentro = t.cursiva ? <em>{t.texto}</em> : t.texto;
        return t.negrita ? (
          <strong key={i} className="font-semibold">
            {adentro}
          </strong>
        ) : (
          <Fragment key={i}>{adentro}</Fragment>
        );
      })}
    </>
  );
}
