import type { Metadata, Viewport } from "next";
import { Archivo_Black, Newsreader, Poppins } from "next/font/google";
import { FondoPanorama } from "@/components/fondo-panorama";
import "./globals.css";

/**
 * Las tres voces del diario, sacadas del impreso real (edición de agosto de
 * 2026, escaneada en `Miguelino.pdf`).
 *
 * El impreso es **sans para todo lo que titula y serif sólo para lo que se lee
 * corrido**. Antes teníamos lo contrario: Playfair, una didona de alto
 * contraste, en la bandera y en los titulares. Se ve linda y no es este diario.
 */

/** Bandera. En el papel es una grotesca ultra-negra en versales, con el
 *  tracking tan cerrado que las letras casi se tocan: más cuadrada y más
 *  compacta que una geométrica. Archivo Black es lo más cercano que hay libre.
 *  Trae un solo peso, que es todo lo que hace falta para dos palabras. */
const archivo = Archivo_Black({
  variable: "--font-bandera",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Titulares, bajadas, volantas, epígrafes, foliado y también la interfaz.
 *
 * En el impreso el titular es una geométrica pura: la "a" es de un solo piso y
 * sin cola, los bols son circulares y la "y" baja con una diagonal recta.
 * Poppins es el match libre más cercano.
 *
 * Va también en la interfaz, reemplazando a Inter. Dos sans distintas
 * conviviendo no se leen como una decisión, se leen como un descuido: el papel
 * usa una sola para todo lo que no es cuerpo.
 */
const poppins = Poppins({
  variable: "--font-titular",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

/** Cuerpo de nota: en el papel es serif, justificada y con guionado. Newsreader
 *  ya cumplía, así que se queda. Tiene itálica real para epígrafes y citas
 *  (nada de oblicua sintética) y eje óptico. */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "El Sanmiguelino",
    template: "%s · El Sanmiguelino",
  },
  description:
    "El diario digital mensual de la Municipalidad de San Miguel de Tucumán. Exclusivo para usuarios de Cidituc.",
};

/** La barra del navegador acompaña al papel en claro y a la edición nocturna
 *  en oscuro. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ece7db" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0d13" },
  ],
};

/** Aplica el tema guardado (o la preferencia del sistema) antes del primer
 *  paint para evitar el destello de tema incorrecto. */
const themeInit = `(function(){try{var t=localStorage.getItem("sm-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      suppressHydrationWarning
      className={`${archivo.variable} ${poppins.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {/* La ciudad de fondo, en todo el sitio y en todo momento. Va primero
            y fija: el resto del contenido se apoya encima. */}
        <FondoPanorama />
        {children}
      </body>
    </html>
  );
}
