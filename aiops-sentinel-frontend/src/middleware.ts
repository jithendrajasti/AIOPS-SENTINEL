import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/register"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!isLoggedIn && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon\\.ico|favicon\\.png|logo.*\\.png).*)",
  ],
};
