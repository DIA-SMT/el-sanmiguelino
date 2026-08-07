import type { Metadata } from "next";
import { Inter, Playfair_Display, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "El Sanmiguelino",
    template: "%s · El Sanmiguelino",
  },
  description:
    "El diario digital mensual de la Municipalidad de San Miguel de Tucumán. Exclusivo para usuarios de Cidituc.",
};

/** Aplica el tema guardado (o la preferencia del sistema) antes del primer
 *  paint para evitar el destello de tema incorrecto. */
const themeInit = `(function(){try{var t=localStorage.getItem("sm-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      suppressHydrationWarning
      className={`${playfair.variable} ${sourceSerif.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col paper-grain">
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {children}
      </body>
    </html>
  );
}
