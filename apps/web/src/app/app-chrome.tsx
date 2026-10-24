import type { ReactNode } from 'react';

/**
 * The app inside the phone: header, scrolling content and bottom navigation.
 * The app's language and direction apply here only, never to the web page.
 */
export function AppChrome({ children, nav, lang = 'en', dir = 'ltr' }: { children: ReactNode; nav?: ReactNode; lang?: string; dir?: 'ltr' | 'rtl' }) {
  return (
    <div className="app-root" lang={lang} dir={dir}>
      <header className="app-header">
        <div className="app-brand" role="img" aria-label="LAI App">
          <span className="app-brand__logo" aria-hidden="true">LAI</span>
          <span className="app-brand__name" aria-hidden="true">App</span>
        </div>
      </header>
      <main className="app-main" id="maincontent" tabIndex={-1}>{children}</main>
      {nav}
    </div>
  );
}
