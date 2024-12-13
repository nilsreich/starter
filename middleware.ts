import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { NextRequest, NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

// Supported locales
const locales = ["en", "de"];

// Get the preferred locale from the request
function getLocale(request: NextRequest) {
  // Get locale from Accept-Language header
  const acceptLanguage = request.headers.get("accept-language");

  if (acceptLanguage) {
    // Parse the Accept-Language header and find the first matching locale
    const preferredLocale = acceptLanguage
      .split(",")
      .map((lang) => lang.split(";")[0].trim())
      .find((lang) => locales.includes(lang));

    if (preferredLocale) {
      return preferredLocale;
    }
  }

  // Default to en-US if no matching locale is found
  return "en";
}

// Wrap the middleware with NextAuth
export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // Check if there is any supported locale in the pathname
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  // Handle locale redirect if needed
  if (!pathnameHasLocale) {
    const locale = getLocale(req);
    nextUrl.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(nextUrl);
  }

  // Handle protected routes
  if (pathname.startsWith("/protected") && !req.auth) {
    // Get the current locale from the pathname
    const currentLocale =
      locales.find((locale) => pathname.startsWith(`/${locale}/`)) || "en";

    // Redirect to localized login page
    return NextResponse.redirect(new URL(`/${currentLocale}/login`, nextUrl));
  }

  // Allow the request
  return NextResponse.next();
});

// Combine both matchers
export const config = {
  matcher: [
    // Skip all internal paths (_next, api, static assets)
    "/((?!api|_next/static|_next/image|fonts|favicon\\.ico|.*\\.(?:css|js|json|png|jpg|jpeg|svg|ico|woff|woff2)$).*)",
  ],
};
