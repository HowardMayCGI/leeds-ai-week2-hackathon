import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './nhs.scss';
import './styles.css';
import '../medicines/medicines.css';

export const metadata: Metadata = {
  title: 'LAI App',
  description: 'The Leeds Artificial Intelligence hackathon demo.',
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
        <a className="nhsuk-skip-link" href="#maincontent" lang="en" dir="ltr">Skip to main content</a>
        <div className="showcase">
          <aside className="showcase-intro" aria-label="About this demonstration" lang="en" dir="ltr">
            <p className="showcase-intro__eyebrow">Leeds AI Week <span aria-hidden="true">/</span> Hackathon 2026</p>
            <p className="showcase-intro__title">Leeds Artificial<br />Intelligence<span className="showcase-intro__stop">.</span></p>
            <div className="showcase-intro__rule" />
            <p className="showcase-intro__description">Schedule my medicines.<br />Fitted around your day.</p>
            <p className="showcase-intro__detail">A proof of concept in the style of the NHS App, built for the Leeds AI Week hackathon. Synthetic patient data only. Not for clinical use.</p>
            <p className="showcase-intro__note"><span aria-hidden="true" /> Interactive demo</p>
          </aside>

          <div className="phone-frame">
            <div className="phone-screen">
              <div className="phone-status" aria-hidden="true">
                <span>9:41</span>
                <div className="phone-status__icons">
                  <svg width="17" height="13" viewBox="0 0 17 13" fill="currentColor"><rect x="0" y="9" width="3" height="4" rx=".7" /><rect x="4.5" y="6" width="3" height="7" rx=".7" /><rect x="9" y="3" width="3" height="10" rx=".7" /><rect x="13.5" width="3" height="13" rx=".7" /></svg>
                  <svg width="17" height="13" viewBox="0 0 20 15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M2 4a13 13 0 0 1 16 0M5 7.5a8 8 0 0 1 10 0M8 11a3 3 0 0 1 4 0" /><circle cx="10" cy="14" r="1" fill="currentColor" stroke="none" /></svg>
                  <svg width="25" height="13" viewBox="0 0 27 14" fill="none"><rect x=".5" y=".5" width="23" height="13" rx="3" stroke="currentColor" strokeOpacity=".5" /><rect x="2.5" y="2.5" width="19" height="9" rx="1" fill="currentColor" /><path d="M25 4.5v5c2 0 2-5 0-5Z" fill="currentColor" fillOpacity=".5" /></svg>
                </div>
              </div>
              {children}
              <div className="phone-home-indicator" aria-hidden="true"><span /></div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
