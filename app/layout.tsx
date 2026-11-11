import type { Metadata } from 'next'
import { IBM_Plex_Mono, Inter, Sora } from 'next/font/google'
import './globals.css'
import './report.css'

// The Insightive type system, as on insightive-ai.com: Sora for headings,
// Inter for body text, IBM Plex Mono for labels, dates and codes.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
})

const sora = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-head',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Substance Watch · Insightive',
  description: 'ECHA PT18 & PT19 biocidal active substances — approval status and assessment stage',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${sora.variable} ${plexMono.variable} font-sans min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
