'use client';

import { useJourney } from '../context';
import { CardLink } from './AppNav';
import { BackLink, Button, Caption, PageHeading, T } from './ui';

export function Prescriptions() {
  const { state, go } = useJourney();
  const open = () => {
    if (state.saved) go('schedule', { updating: false, proposal: undefined, changeFlow: undefined });
    else go('intro');
  };
  return (
    <>
      <PageHeading><T k="prescriptions.title" /></PageHeading>
      <p className="nhsuk-body"><T k="prescriptions.lede" /></p>
      <ul className="nhsapp-cards nhsapp-cards--stacked">
        <CardLink
          title={<T k="prescriptions.schedule" />}
          description={state.saved ? <T k="prescriptions.scheduleSaved" /> : <T k="prescriptions.scheduleNew" />}
          onSelect={open}
        />
      </ul>
    </>
  );
}

export function Intro() {
  const { next } = useJourney();
  return (
    <>
      <BackLink to="prescriptions" />
      <PageHeading caption={<Caption />}><T k="intro.title" /></PageHeading>
      <p className="nhsuk-body-l"><T k="intro.lede" /></p>
      <h2 className="nhsuk-heading-m"><T k="intro.needTitle" /></h2>
      <ul className="nhsuk-list nhsuk-list--bullet">
        <li><T k="intro.need1" /></li>
        <li><T k="intro.need2" /></li>
        <li><T k="intro.need3" /></li>
      </ul>
      <p><T k="intro.time" /></p>
      <div className="nhsuk-card nhsuk-card--warning">
        <div className="nhsuk-card__content">
          <h2 className="nhsuk-card__heading"><T k="intro.warningTitle" /></h2>
          <p className="nhsuk-card__description"><T k="intro.warning" /></p>
        </div>
      </div>
      <Button onClick={() => next('intro', 'waking-sleeping')}><T k="intro.start" /></Button>
    </>
  );
}
