import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"
import Link from "next/link"

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
})
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
})

export const metadata: Metadata = {
  title: "Anki AI Assistant",
  description: "AI-powered Anki card generator and reviewer",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex h-screen`}
      >
        <aside className="w-64 bg-blue-700 text-white p-6">
          <nav className="space-y-4">
            <Link href="/" className="block">
              Decks
            </Link>
          </nav>
        </aside>
        <main className="flex-1 bg-gray-100 p-8">{children}</main>
      </body>
    </html>
  )
}
