import { NextResponse } from "next/server";
import { ciditucAdapter } from "@/lib/auth/cidituc";
import { SESSION_COOKIE, crearToken } from "@/lib/auth/session";

/** Login vía Cidituc. Hoy usa el adapter mock; cuando se confirme el SSO real
 *  este endpoint pasa a iniciar el flujo OAuth2/OIDC (redirect a authorize). */
export async function POST() {
  const usuario = await ciditucAdapter.login();
  const res = NextResponse.json({ usuario });
  res.cookies.set(SESSION_COOKIE, crearToken(usuario), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
