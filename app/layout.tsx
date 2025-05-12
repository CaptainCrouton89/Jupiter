import { AuthProvider } from "@/components/auth/AuthProvider";
import { Toaster } from "@/components/ui/sonner";
import { getServerSession } from "@/lib/auth/server";
import { StoreProvider } from "@/lib/store/provider";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Jupiter Email Client",
  description: "An AI-empowered mail client built with Next.js",
  icons: [{ rel: "icon", url: "/logo.svg", type: "image/svg+xml" }],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getServerSession();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("antialiased overscroll-y-none", inter.className)}>
        <StoreProvider>
          <AuthProvider initialUser={user}>
            {children}
            <Toaster />
          </AuthProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
