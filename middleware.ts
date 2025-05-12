import { createClient } from "@/lib/auth/server";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  try {
    // Create a response object that we can modify
    const response = NextResponse.next();

    // Create a Supabase client using the server client helper
    const supabase = await createClient();

    // This will refresh the session if needed
    await supabase.auth.getUser();

    // Add CORS headers for any requests to the Google auth initiate endpoint
    if (request.nextUrl.pathname.includes("/api/auth/google/initiate")) {
      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
      );
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );

      // For preflight requests
      if (request.method === "OPTIONS") {
        return new NextResponse(null, {
          status: 200,
          headers: response.headers,
        });
      }
    }

    return response;
  } catch (e) {
    // If there's an error, proceed without modifying the response
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (e.g. robots.txt)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
