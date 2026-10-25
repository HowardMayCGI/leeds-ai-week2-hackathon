'use client';

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PHONE_OVERLAY_ID } from '../../app/showcase';
import { useJourney } from '../context';
import { languageInfo } from '../i18n';

export interface PromptAction {
  label: ReactNode;
  onClick: () => void;
  primary?: boolean;
}

/**
 * An alert in the phone's own style, such as a notification permission
 * request. It covers the phone screen and nothing else, as the device would,
 * makes the app behind it unreachable and keeps keyboard focus inside until
 * it is answered. Escape closes it without an answer.
 */
export function DevicePrompt({ open, title, body, actions, onDismiss, returnFocus }: {
  open: boolean;
  title: ReactNode;
  body: ReactNode;
  actions: PromptAction[];
  onDismiss: () => void;
  /** Where keyboard focus goes once the prompt closes, read after the app has updated. */
  returnFocus: () => HTMLElement | null | undefined;
}) {
  const { lang } = useJourney();
  const box = useRef<HTMLDivElement>(null);
  const focusAfter = useRef(returnFocus);
  focusAfter.current = returnFocus;

  useEffect(() => {
    if (!open) return;
    const app = document.querySelector('.phone-screen .app-root');
    app?.setAttribute('inert', '');
    box.current?.focus();
    return () => {
      app?.removeAttribute('inert');
      focusAfter.current()?.focus();
    };
  }, [open]);

  const host = typeof document === 'undefined' ? null : document.getElementById(PHONE_OVERLAY_ID);
  if (!open || !host) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onDismiss();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = [...(box.current?.querySelectorAll('button') ?? [])];
    if (!buttons.length) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.shiftKey ? (index <= 0 ? buttons.length - 1 : index - 1) : (index + 1) % buttons.length;
    event.preventDefault();
    buttons[next].focus();
  };

  return createPortal(
    <div className="app-device-prompt" lang={lang} dir={languageInfo(lang).dir}>
      <div className="app-permission" ref={box} role="alertdialog" aria-modal="true" aria-labelledby="device-prompt-title"
        aria-describedby="device-prompt-body" tabIndex={-1} onKeyDown={onKeyDown}>
        <div className="app-permission__body">
          <h2 className="app-permission__title" id="device-prompt-title">{title}</h2>
          <p className="app-permission__text" id="device-prompt-body">{body}</p>
        </div>
        <div className="app-permission__actions">
          {actions.map((action, index) => (
            <button type="button" key={index} className={`app-permission__action${action.primary ? ' app-permission__action--primary' : ''}`} onClick={action.onClick}>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    host,
  );
}
