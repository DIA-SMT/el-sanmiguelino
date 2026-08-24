import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /* Lista blanca obligatoria desde Next 16: sin esto, cualquier `quality`
     * distinto del default es un 400. `remotePatterns` llega recién cuando
     * haya URLs remotas (etapa de imágenes), y `localPatterns` NO se define:
     * definirlo bloquea con 400 todo lo que no esté listado. */
    qualities: [75],
  },
};

export default nextConfig;
