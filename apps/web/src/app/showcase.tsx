'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * The web page around the app: a short introduction, the view options, and
 * the app itself on a phone. Web page content is always English and
 * left-to-right; the app sets its own language inside the phone.
 */

export type HeightMode = 'fixed' | 'full';

const HEIGHT_KEY = 'lai-app:view:height';

// An iPhone 16 Pro screen in CSS points, and the frame around it.
const SCREEN_HEIGHT = 852;
const FRAME_HEIGHT = SCREEN_HEIGHT + 2 * 14;
const PAGE_MARGIN = 48;

/** Shrinks the whole phone, keeping its true proportions, when the window is shorter than the phone. */
function usePhoneScale(height: HeightMode) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (height === 'full') { setScale(1); return; }
    const update = () => setScale(Math.min(1, Math.max(0.5, (window.innerHeight - PAGE_MARGIN) / FRAME_HEIGHT)));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [height]);
  return scale;
}

function loadHeight(): HeightMode {
  try {
    return window.localStorage.getItem(HEIGHT_KEY) === 'full' ? 'full' : 'fixed';
  } catch {
    return 'fixed';
  }
}

function storeHeight(mode: HeightMode) {
  try { window.localStorage.setItem(HEIGHT_KEY, mode); } catch { /* a per-visit preference is fine */ }
}

export function Showcase({ title, description, detail, controls, demo, children }: {
  title: ReactNode;
  description: ReactNode;
  detail?: ReactNode;
  /** Extra web page controls, shown with the height option. */
  controls?: ReactNode;
  demo?: ReactNode;
  children: ReactNode;
}) {
  const [height, setHeight] = useState<HeightMode>('fixed');
  useEffect(() => setHeight(loadHeight()), []);
  const scale = usePhoneScale(height);
  const changeHeight = (mode: HeightMode) => {
    setHeight(mode);
    storeHeight(mode);
  };

  return (
    <div className={`showcase showcase--${height}`}>
      <aside className="showcase-intro" aria-label="About this app">
        <div className="showcase-intro__text">
          <p className="showcase-intro__eyebrow">NHS App concept</p>
          <p className="showcase-intro__title">{title}<span className="showcase-intro__stop">.</span></p>
          <div className="showcase-intro__rule" />
          <p className="showcase-intro__description">{description}</p>
          {detail && <p className="showcase-intro__detail">{detail}</p>}
        </div>
        <p className="showcase-notice">
          <strong>Concept only.</strong> A proposed NHS App feature made for Leeds AI Week 2026. It is not a live NHS service and uses test patient records, not real people.
        </p>
        <section className="showcase-controls" aria-labelledby="view-options-title">
          <h2 className="showcase-controls__title" id="view-options-title">View options</h2>
          {controls}
          <fieldset className="showcase-control showcase-segmented">
            <legend className="showcase-control__label">App height</legend>
            <div className="showcase-segmented__options">
              {([['fixed', 'Phone screen'], ['full', 'Full length']] as const).map(([mode, label]) => (
                <label key={mode} className="showcase-segmented__option">
                  <input type="radio" name="app-height" value={mode} checked={height === mode} onChange={() => changeHeight(mode)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>
        {demo}
      </aside>

      <div className="phone-frame" style={{ '--phone-scale': scale } as CSSProperties}>
        <span className="phone-frame__power" aria-hidden="true" />
        <div className="phone-screen">
          <div className="phone-status" aria-hidden="true">
            <span className="phone-status__time">9:41</span>
            <span className="phone-status__island" />
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
  );
}
