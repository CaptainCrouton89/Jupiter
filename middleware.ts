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
