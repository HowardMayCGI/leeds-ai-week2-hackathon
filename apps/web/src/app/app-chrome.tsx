import type { ReactNode } from 'react';

/**
 * The app inside the phone: header, scrolling content and bottom navigation.
 * The app's language and direction apply here only, never to the web page.
 */
export function AppChrome({ children, nav, lang = 'en', dir = 'ltr' }: { children: ReactNode; nav?: ReactNode; lang?: string; dir?: 'ltr' | 'rtl' }) {
  return (
    <div className="app-root" lang={lang} dir={dir}>
      <header className="app-header">
        <div className="app-brand" role="img" aria-label="NHS App">
          {/* The NHS logo, as in the NHS.UK frontend header */}
          <svg className="app-brand__logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" aria-hidden="true" focusable="false">
            <path fill="currentcolor" d="M200 0v80H0V0h200Zm-27.5 5.5c-14.5 0-29 5-29 22 0 10.2 7.7 13.5 14.7 16.3l.7.3c5.4 2 10.1 3.9 10.1 8.4 0 6.5-8.5 7.5-14 7.5s-12.5-1.5-16-3.5L135 70c5.5 2 13.5 3.5 20 3.5 15.5 0 32-4.5 32-22.5 0-19.5-25.5-16.5-25.5-25.5 0-5.5 5.5-6.5 12.5-6.5a35 35 0 0 1 14.5 3l4-13.5c-4.5-2-12-3-20-3Zm-131 2h-22l-14 65H22l9-45h.5l13.5 45h21.5l14-65H64l-9 45h-.5l-13-45Zm63 0h-18l-13 65h17l6-28H117l-5.5 28H129l13.5-65H125L119.5 32h-20l5-24.5Z" />
          </svg>
          <span className="app-brand__name" aria-hidden="true">App</span>
        </div>
      </header>
      <main className="app-main" id="maincontent" tabIndex={-1}>{children}</main>
      {nav}
    </div>
  );
}
