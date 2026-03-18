import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portfolio Rebalancer",
  description: "Track and rebalance your investment portfolio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} ${dmSerif.variable} antialiased`}>
        <div className="mx-auto min-h-screen max-w-[1200px] px-6 py-8">
          <nav className="mb-8 flex items-center gap-3 border-b border-border pb-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-primary transition-colors hover:text-primary/80"
            >
              <TrendingUp className="h-5 w-5" />
              <span className="font-serif text-lg">Portfolio Rebalancer</span>
            </Link>
          </nav>
          {children}
        </div>
        <Toaster />
      </body>
    </html>
  );
}
