import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { StoreProvider } from '@/lib/store';
import { Toasts } from '@/components/toasts';
import { brand } from '@/lib/brand';
import './brand-fonts.css';
import './globals.css';

/**
 * فونت‌ها: Estedad برای رابط و Parastoo برای متن رسمی — هر دو رایگان (OFL) و
 * روی همین سرور (public/fonts، تعریف در brand-fonts.css)؛ هیچ درخواستی به CDN نمی‌رود.
 */
export const metadata: Metadata = {
  title: { default: `${brand.product} · سایپا استوار`, template: `%s · ${brand.product}` },
  description: brand.tagline,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0D2041',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen font-sans print:bg-white">
        <StoreProvider>
          {children}
          <Toasts />
        </StoreProvider>
      </body>
    </html>
  );
}
