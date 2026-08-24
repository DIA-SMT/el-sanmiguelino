import type { Metadata, Viewport } from "next";
import { Inter, Newsreader, Playfair_Display } from "next/font/google";
import { FondoPanorama } from "@/components/fondo-panorama";
import "./globals.css";

/** Bandera y titulares: didona de alto contraste, la voz del diario. */
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

/** Cuerpo de nota: tipografía de diario, variable y con eje óptico, con
 *  itálica real para epígrafes y citas (nada de oblicua sintética). */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

/** Interfaz: volantas, foliado, botones. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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
      className={`${playfair.variable} ${newsreader.variable} ${inter.variable} h-full antialiased`}
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
