import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Legacy Line | Noblesville Schools',
  description:
    'Noblesville seniors pass the torch — leaving a voice message for the next generation of Millers.',
  openGraph: {
    title: 'Legacy Line | Noblesville Schools',
    description: 'Seniors leave a lasting audio legacy for the next generation of Noblesville Millers.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-miller-black text-white antialiased min-h-screen">{children}</body>
    </html>
  )
}
