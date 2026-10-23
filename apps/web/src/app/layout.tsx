import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './nhs.scss';
import './styles.css';

export const metadata: Metadata = {
  title: 'Random number generator | Leeds AI Week hackathon',
  description: 'Generate a random number from 1 to 100.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="nhsuk-skip-link" href="#maincontent">Skip to main content</a>
        <header className="demo-header">
          <div className="nhsuk-width-container">
            <span className="demo-header__title">Leeds AI Week hackathon</span>
          </div>
        </header>
        <div className="nhsuk-width-container">
          <main className="nhsuk-main-wrapper" id="maincontent" tabIndex={-1}>{children}</main>
        </div>
        <footer className="nhsuk-footer" role="contentinfo">
          <div className="nhsuk-width-container">
            <p className="nhsuk-body-s nhsuk-u-margin-bottom-0">A hackathon demonstration using NHS Design System styles.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
