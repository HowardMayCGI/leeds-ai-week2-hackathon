import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource/noto-naskh-arabic/arabic-400.css';
import '@fontsource/noto-naskh-arabic/arabic-700.css';
import './nhs.scss';
import './styles.css';
import '../medicines/medicines.css';

export const metadata: Metadata = {
  title: 'NHS App concept',
  description: 'A concept for a new NHS App feature. Not a live NHS service.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="nhsuk-skip-link" href="#maincontent">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
