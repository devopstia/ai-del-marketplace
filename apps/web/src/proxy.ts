import { NextResponse, type NextRequest } from "next/server";

// Protected areas need a session cookie. Role checks (instructor/admin) happen in the API and in the
// studio/admin layouts; this only stops signed-out visitors early with a redirect to log in.
const PROTECTED = ["/student", "/my-learning", "/learn", "/account", "/orders", "/cart", "/checkout", "/studio", "/admin", "/support"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (req.cookies.get("sid")?.value) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/student/:path*", "/student", "/my-learning/:path*", "/learn/:path*", "/account/:path*", "/orders/:path*", "/cart/:path*", "/checkout/:path*", "/studio/:path*", "/admin/:path*", "/support/:path*", "/support"],
};
