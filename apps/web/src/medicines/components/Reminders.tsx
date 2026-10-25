'use client';

import { useRef, useState } from 'react';
import { useJourney } from '../context';
import type { Permission } from '../state';
import { DevicePrompt } from './DevicePrompt';
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
    <div className="app-reminder-status" role={live ? 'status' : undefined} id={live ? 'reminder-status' : undefined} tabIndex={live ? -1 : undefined}
      data-status={statusOf(reminders.enabled, reminders.permission)}>
      <p className="app-tags"><span className="nhsuk-u-visually-hidden"><T k="reminders.statusLabel" />: </span><Tag colour={status.colour}><T k={status.title} /></Tag></p>
      <p className="nhsuk-body-s"><T k={status.body} /></p>
    </div>
  );
}

/**
 * One switch for every medicine in the schedule, defaulted to ON when first saved.
 * Notification permission is asked for with the device's own style of prompt,
 * shown on the phone screen.
 */
export function RemindersPanel({ headingLevel }: { headingLevel: 2 | null }) {
  const { state, setState } = useJourney();
  const [asking, setAsking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const reminders = state.saved?.reminders;
  if (!reminders) return null;
  const status = statusOf(reminders.enabled, reminders.permission);

  const update = (changes: Partial<typeof reminders>) => setState(current => (current.saved
    ? { ...current, saved: { ...current.saved, reminders: { ...current.saved.reminders, ...changes } } }
    : current));

  const answer = (permission: Permission) => {
    setAsking(false);
    update({ permission });
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
        <button type="button" ref={trigger} className="nhsuk-button nhsuk-button--secondary" onClick={() => setAsking(true)}><T k="reminders.allow" /></button>
      )}
      <DevicePrompt
        open={asking}
        title={<T k="reminders.dialogTitle" />}
        body={<T k="reminders.dialogBody" />}
        actions={[
          { label: <T k="reminders.dialogDeny" />, onClick: () => answer('denied') },
          { label: <T k="reminders.dialogAllow" />, onClick: () => answer('granted'), primary: true },
        ]}
        onDismiss={() => setAsking(false)}
        // The button goes once permission is granted, so focus then moves to the new status.
        returnFocus={() => (trigger.current?.isConnected ? trigger.current : document.getElementById('reminder-status'))}
      />
    </section>
  );
}
