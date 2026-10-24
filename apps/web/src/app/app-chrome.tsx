import type { ReactNode } from 'react';

/** The app header, main content area and footer inside the phone frame. */
export function AppChrome({ children, headerExtra, footer }: { children: ReactNode; headerExtra?: ReactNode; footer?: ReactNode }) {
  return (
    <>
      <header className="app-header">
        <div className="app-brand" role="img" aria-label="LAI App — Leeds Artificial Intelligence">
          <span className="app-brand__logo" aria-hidden="true">LAI</span>
          <span className="app-brand__name" aria-hidden="true">App</span>
        </div>
        {headerExtra ?? <span className="app-header__tag">Hackathon demo</span>}
      </header>
      <main className="app-main" id="maincontent" tabIndex={-1}>{children}</main>
      <footer className="app-footer">
        <p>Leeds Artificial Intelligence</p>
        <p className="app-footer__detail">{footer ?? 'Leeds AI Week hackathon'}</p>
      </footer>
    </>
  );
}
