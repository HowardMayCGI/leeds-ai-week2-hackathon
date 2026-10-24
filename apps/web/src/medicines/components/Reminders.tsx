'use client';

import { useRef } from 'react';
import { useJourney } from '../context';
import type { Permission } from '../state';
import { T, Tag } from './ui';

type Status = 'on' | 'pending' | 'denied' | 'off';

function statusOf(enabled: boolean, permission: Permission): Status {
  if (!enabled) return 'off';
  return permission === 'granted' ? 'on' : permission === 'denied' ? 'denied' : 'pending';
}

const STATUS = {
  on: { colour: 'green', title: 'reminders.granted', body: 'reminders.grantedBody' },
  pending: { colour: 'yellow', title: 'reminders.pending', body: 'reminders.pendingBody' },
  denied: { colour: 'red', title: 'reminders.denied', body: 'reminders.deniedBody' },
  off: { colour: 'grey', title: 'reminders.offStatus', body: 'reminders.offBody' },
} as const;

/** The reminder state in words. Preference and permission are separate: ON alone never means reminders work. */
export function ReminderSummary({ live = false }: { live?: boolean }) {
  const { state } = useJourney();
  const reminders = state.saved?.reminders;
  if (!reminders) return null;
  const status = STATUS[statusOf(reminders.enabled, reminders.permission)];
  return (
    <div className="app-reminder-status" role={live ? 'status' : undefined} data-status={statusOf(reminders.enabled, reminders.permission)}>
      <p className="app-tags"><span className="nhsuk-u-visually-hidden"><T k="reminders.statusLabel" />: </span><Tag colour={status.colour}><T k={status.title} /></Tag></p>
      <p className="nhsuk-body-s"><T k={status.body} /></p>
    </div>
  );
}

/**
 * One switch for every medicine in the schedule, defaulted to ON when first saved.
 * Notification permission is asked for with the device's own style of prompt.
 */
export function RemindersPanel({ headingLevel }: { headingLevel: 2 | null }) {
  const { state, setState } = useJourney();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const reminders = state.saved?.reminders;
  if (!reminders) return null;
  const status = statusOf(reminders.enabled, reminders.permission);

  const update = (changes: Partial<typeof reminders>) => setState(current => (current.saved
    ? { ...current, saved: { ...current.saved, reminders: { ...current.saved.reminders, ...changes } } }
    : current));

  const askPermission = (button: HTMLButtonElement) => {
    trigger.current = button;
    // Centre the prompt on the phone screen, as the device would show it.
    const screen = document.querySelector('.phone-screen')?.getBoundingClientRect();
    if (dialog.current && screen) {
      dialog.current.style.left = `${screen.left + screen.width / 2}px`;
      dialog.current.style.top = `${screen.top + Math.min(screen.height, window.innerHeight - screen.top) / 2}px`;
    }
    dialog.current?.showModal();
  };
  const answer = (permission: Permission) => {
    dialog.current?.close();
    update({ permission });
    trigger.current?.focus();
  };

  return (
    <section className="app-reminders" aria-labelledby={headingLevel ? 'reminders-title' : undefined}>
      {headingLevel && <h2 className="nhsuk-heading-m" id="reminders-title"><T k="reminders.title" /></h2>}
      <div className="app-switch-row">
        <span className="app-switch-row__text">
          <span className="nhsuk-label nhsuk-label--s" id="reminders-switch-label"><T k="reminders.switchLabel" /></span>
          <span className="nhsuk-hint" id="reminders-switch-hint"><T k="reminders.switchHint" /></span>
        </span>
        <button type="button" role="switch" className="app-switch" aria-checked={reminders.enabled}
          aria-labelledby="reminders-switch-label" aria-describedby="reminders-switch-hint"
          onClick={() => update({ enabled: !reminders.enabled })}>
          <span className="app-switch__track" aria-hidden="true"><span className="app-switch__thumb" /></span>
          <span className="app-switch__state" aria-hidden="true"><T k={reminders.enabled ? 'reminders.on' : 'reminders.off'} /></span>
        </button>
      </div>
      <ReminderSummary live />
      {(status === 'pending' || status === 'denied') && (
        <button type="button" className="nhsuk-button nhsuk-button--secondary" onClick={event => askPermission(event.currentTarget)}><T k="reminders.allow" /></button>
      )}
      <dialog ref={dialog} className="app-permission" aria-labelledby="permission-title" aria-describedby="permission-body" onCancel={() => trigger.current?.focus()}>
        <div className="app-permission__body">
          <h2 className="app-permission__title" id="permission-title"><T k="reminders.dialogTitle" /></h2>
          <p className="app-permission__text" id="permission-body"><T k="reminders.dialogBody" /></p>
        </div>
        <div className="app-permission__actions">
          <button type="button" className="app-permission__action" onClick={() => answer('denied')}><T k="reminders.dialogDeny" /></button>
          <button type="button" className="app-permission__action app-permission__action--primary" onClick={() => answer('granted')}><T k="reminders.dialogAllow" /></button>
        </div>
      </dialog>
    </section>
  );
}
