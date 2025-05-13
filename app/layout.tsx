import { Toaster } from "@/components/ui/sonner";
import { StoreProvider } from "@/lib/store/provider";
import { cn } from "@/lib/utils";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Jupiter Email Client",
  icons: [{ rel: "icon", url: "/logo.svg", type: "image/svg+xml" }],
  description:
    "Jupiter Mail tames your chaotic inbox with AI-powered automation. Reclaim your focus.",
  openGraph: {
    title: "Finally. Inbox Zero, Effortlessly.",
    description:
      "Jupiter Mail tames your chaotic inbox with AI-powered automation. Reclaim your focus.",
    url: "https://jupiter.cosmo.it.com",
    siteName: "Jupiter Mail",
    images: [
      {
        url: "https://jupiter.cosmo.it.com/main.png", // replace with the uploaded image URL
        width: 1200,
        height: 630,
        alt: "Finally. Inbox Zero, Effortlessly.",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Finally. Inbox Zero, Effortlessly.",
    description:
      "Jupiter Mail tames your chaotic inbox with AI-powered automation. Reclaim your focus.",
    images: ["https://jupiter.cosmo.it.com/main.png"], // same image as above
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("antialiased overscroll-y-none", inter.className)}>
        <StoreProvider>
          {children}
          <Toaster />
        </StoreProvider>
      </body>
    </html>
  );
}
