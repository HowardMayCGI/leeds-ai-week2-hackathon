'use client';

import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import {
  DOSE_UNITS, FOOD_TIMINGS, FREQUENCIES, needsDetails, parseQuantity, recommendedTiming, searchMedicines, timingConflict, unitForForm,
  type DoseUnit, type FoodTiming, type Frequency, type MedicineOption, type PatientAddition, type RecordMedicine, type SearchResult,
} from '@hackathon/medicines';
import { useJourney } from '../context';
import type { Language, MessageKey } from '../i18n';
import { nextPendingDetails } from '../state';
import {
  BackLink, Button, Caption, DoseAmount, Entered, ErrorMessage, ErrorSummary, InsetText, Latin, LinkButton, NavLink, PageHeading,
  RecordText, T, Tag, TName, UntranslatedNote, WarningCallout,
} from './ui';

export function MedicineName({ name, strength }: { name: string; strength?: string }) {
  return <Latin>{name}{strength ? ` ${strength}` : ''}</Latin>;
}

/** A patient addition's name: suggested names in Latin script, entered names as typed. */
export function AdditionName({ addition }: { addition: PatientAddition }) {
  return addition.medicine ? <MedicineName name={addition.medicine.name} strength={addition.medicine.strength} /> : <Entered>{addition.name}</Entered>;
}

/** How often the record says to take a medicine, worded in the interface language. */
export function RecordFrequencyText({ medicine }: { medicine: RecordMedicine }) {
  const { frequency } = medicine;
  switch (frequency.kind) {
    case 'daily': return <T k={`frequencies.${(['once-daily', 'twice-daily', 'three-times-daily', 'four-times-daily'] as const)[frequency.timesPerDay - 1]}`} />;
    case 'as-needed': return <T k="frequencies.as-needed" />;
    case 'every-days': return <T k="record.everyDays" params={{ count: frequency.days }} />;
    case 'every-hours': return <T k="record.everyHours" params={{ count: frequency.hours }} />;
    case 'missing': return <T k="record.frequencyMissing" />;
  }
}

const numberText = (value: number, lang: Language) => new Intl.NumberFormat(lang === 'en' ? 'en-GB' : lang, { maximumFractionDigits: 2, useGrouping: false }).format(value);

/** NHS checkboxes for the record's medicines, with an exclusive "None of these" option. */
export function SelectMedicines() {
  const { state, record, go, updateDraft, next, back, t } = useJourney();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { selected, noneSelected } = state.draft;
  const toggle = (id: string, checked: boolean) => {
    updateDraft(draft => ({
      ...draft,
      // Keep record order so the selection reads the same everywhere.
      selected: record.map(medicine => medicine.id).filter(other => (other === id ? checked : draft.selected.includes(other))),
      noneSelected: false,
    }));
    setError(false);
  };
  const toggleNone = (checked: boolean) => {
    updateDraft(draft => ({ ...draft, selected: checked ? [] : draft.selected, noneSelected: checked }));
    setError(false);
  };
  const submit = () => {
    setAttempt(count => count + 1);
    if (!selected.length && !noneSelected) { setError(true); return; }
    // Ask about each ticked medicine the record cannot be scheduled from, before moving on.
    const pending = nextPendingDetails(state.draft, record);
    if (pending) go('record-details', { editingRecordId: pending });
    else next('medicines', 'additions');
  };
  const firstId = record.length ? `medicine-${record[0].id}` : 'medicine-none';
  return (
    <>
      <BackLink to={back('medicines', 'meal-times')} />
      <ErrorSummary attempt={attempt} errors={error ? [{ href: `#${firstId}`, text: t('select.error') }] : []} />
      <div className={`nhsuk-form-group${error ? ' nhsuk-form-group--error' : ''}`}>
        <fieldset className="nhsuk-fieldset" aria-describedby={`medicines-hint${error ? ' medicines-error' : ''}`}>
          <legend className="nhsuk-fieldset__legend nhsuk-fieldset__legend--l">
            <span className="nhsuk-caption-l"><Caption /><span className="nhsuk-u-visually-hidden"> – </span></span>
            <h1 className="nhsuk-fieldset__heading" id="page-heading" tabIndex={-1}><T k="select.title" /></h1>
          </legend>
          <div className="nhsuk-hint" id="medicines-hint"><T k={record.length ? 'select.hint' : 'select.emptyRecord'} /></div>
          <UntranslatedNote />
          {error && <ErrorMessage id="medicines-error"><T k="select.error" /></ErrorMessage>}
          <div className="nhsuk-checkboxes">
            {record.map(medicine => {
              const id = `medicine-${medicine.id}`;
              return (
                <div className="nhsuk-checkboxes__item" key={medicine.id}>
                  <input className="nhsuk-checkboxes__input" id={id} name="medicines" type="checkbox" value={medicine.id}
                    checked={selected.includes(medicine.id)} aria-describedby={`${id}-hint`}
                    onChange={event => toggle(medicine.id, event.target.checked)} />
                  <label className="nhsuk-label nhsuk-checkboxes__label" htmlFor={id}>
                    <MedicineName name={medicine.medicine.name} strength={medicine.medicine.strength} />
                  </label>
                  <div className="nhsuk-hint nhsuk-checkboxes__hint app-record-hint" id={`${id}-hint`}>
                    <span className="app-record-hint__line">
                      {medicine.dose ? <DoseAmount dose={medicine.dose} strength={medicine.medicine.strength} /> : <T k="record.doseMissing" />}
                    </span>
                    <span className="app-record-hint__line"><RecordFrequencyText medicine={medicine} /></span>
                    {medicine.instructions.map(text => <span className="app-record-hint__line" key={text}><RecordText text={text} language={medicine.language} /></span>)}
                    {needsDetails(medicine) && <span className="app-record-hint__line app-record-hint__ask"><T k="record.willAsk" /></span>}
                  </div>
                </div>
              );
            })}
            {record.length > 0 && <div className="nhsuk-checkboxes__divider"><T k="common.or" /></div>}
            <div className="nhsuk-checkboxes__item">
              <input className="nhsuk-checkboxes__input" id="medicine-none" name="medicines" type="checkbox" value="none"
                data-checkbox-exclusive="" checked={noneSelected} onChange={event => toggleNone(event.target.checked)} />
              <label className="nhsuk-label nhsuk-checkboxes__label" htmlFor="medicine-none"><T k="select.none" /></label>
            </div>
          </div>
        </fieldset>
      </div>
      <InsetText><p><T k="select.inset" /></p></InsetText>
      <Button onClick={submit}><T k="common.continue" /></Button>
    </>
  );
}

/** Radios for how often, shared by the record details and add medicine forms. */
function FrequencyRadios({ id, value, onChange, error }: { id: string; value?: Frequency; onChange: (frequency: Frequency) => void; error?: boolean }) {
  return (
    <div className={`nhsuk-form-group${error ? ' nhsuk-form-group--error' : ''}`}>
      <fieldset className="nhsuk-fieldset" aria-describedby={error ? `${id}-error` : undefined}>
        <legend className="nhsuk-fieldset__legend nhsuk-fieldset__legend--s"><T k="addForm.frequencyLegend" /></legend>
        {error && <ErrorMessage id={`${id}-error`}><T k="addForm.errors.frequency" /></ErrorMessage>}
        <div className="nhsuk-radios nhsuk-radios--small">
          {FREQUENCIES.map((frequency, index) => (
            <div className="nhsuk-radios__item" key={frequency}>
              <input className="nhsuk-radios__input" id={index === 0 ? id : `${id}-${frequency}`} name={id} type="radio" value={frequency}
                checked={value === frequency} onChange={() => onChange(frequency)} />
              <label className="nhsuk-label nhsuk-radios__label" htmlFor={index === 0 ? id : `${id}-${frequency}`}><T k={`frequencies.${frequency}`} /></label>
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/**
 * "How do you take it?" for a ticked record medicine whose record has no
 * dose or frequency. One medicine per page, in record order.
 */
export function RecordDetailsScreen() {
  const { state, record, go, updateDraft, next, t, lang } = useJourney();
  const medicine = record.find(item => item.id === state.editingRecordId);
  const saved = medicine ? state.draft.recordDetails[medicine.id] : undefined;
  const startDose = saved?.dose ?? medicine?.dose;
  const [quantity, setQuantity] = useState(startDose ? numberText(startDose.quantity, lang) : '');
  const [frequency, setFrequency] = useState<Frequency | undefined>(saved?.frequency);
  const [errors, setErrors] = useState<('quantity' | 'frequency')[]>([]);
  const [attempt, setAttempt] = useState(0);
  if (!medicine) return null;
  const unit: DoseUnit = medicine.dose?.unit ?? unitForForm(medicine.medicine.form);
  const fromCheck = state.changeFlow?.end === 'record-details';

  const save = () => {
    const amount = parseQuantity(quantity);
    const found = [...(amount === null ? ['quantity' as const] : []), ...(!frequency ? ['frequency' as const] : [])];
    setErrors(found);
    setAttempt(count => count + 1);
    if (found.length) return;
    const draft = { ...state.draft, recordDetails: { ...state.draft.recordDetails, [medicine.id]: { dose: { quantity: amount!, unit }, frequency: frequency! } } };
    updateDraft(() => draft);
    if (fromCheck) { go('check', { changeFlow: undefined, editingRecordId: undefined }); return; }
    const pending = nextPendingDetails(draft, record, medicine.id) ?? nextPendingDetails(draft, record);
    if (pending) go('record-details', { editingRecordId: pending });
    else next('medicines', 'additions');
  };
  const leave = () => go(fromCheck ? 'check' : 'medicines', { editingRecordId: undefined, ...(fromCheck ? { changeFlow: undefined } : {}) });
  const reason = medicine.frequency.kind === 'every-hours' ? 'recordDetails.everyHours' : !medicine.dose && medicine.frequency.kind === 'daily' ? 'recordDetails.doseMissing' : 'recordDetails.missing';
  const errorText = (field: 'quantity' | 'frequency') => t(`addForm.errors.${field}`);

  return (
    <>
      <BackLink onClick={leave} />
      <ErrorSummary attempt={attempt} errors={errors.map(field => ({ href: field === 'quantity' ? '#details-quantity' : '#details-frequency', text: errorText(field) }))} />
      <PageHeading caption={<Caption />}><TName k="recordDetails.title" name={medicine.medicine.name} /></PageHeading>
      <InsetText>
        <p><T k={reason} params={medicine.frequency.kind === 'every-hours' ? { count: medicine.frequency.hours } : undefined} /></p>
      </InsetText>
      <dl className="nhsuk-summary-list app-compact-summary">
        <div className="nhsuk-summary-list__row">
          <dt className="nhsuk-summary-list__key"><T k="schedule.recordedAs" /></dt>
          <dd className="nhsuk-summary-list__value"><RecordText text={medicine.medicine.recordName} language={medicine.language} /></dd>
        </div>
        {medicine.instructions.length > 0 && (
          <div className="nhsuk-summary-list__row">
            <dt className="nhsuk-summary-list__key"><T k="common.instructions" /></dt>
            <dd className="nhsuk-summary-list__value">{medicine.instructions.map(text => <RecordText key={text} text={text} language={medicine.language} />)}</dd>
          </div>
        )}
      </dl>
      <div className={`nhsuk-form-group${errors.includes('quantity') ? ' nhsuk-form-group--error' : ''}`}>
        <label className="nhsuk-label nhsuk-label--s" htmlFor="details-quantity"><T k="addForm.doseLegend" /></label>
        <div className="nhsuk-hint" id="details-quantity-hint"><T k="addForm.quantityHint" /></div>
        {errors.includes('quantity') && <ErrorMessage id="details-quantity-error">{errorText('quantity')}</ErrorMessage>}
        <div className="nhsuk-input-wrapper">
          <input className={`nhsuk-input nhsuk-input--width-3${errors.includes('quantity') ? ' nhsuk-input--error' : ''}`} id="details-quantity" type="text" inputMode="decimal" autoComplete="off" dir="ltr"
            value={quantity} aria-describedby={`details-quantity-hint${errors.includes('quantity') ? ' details-quantity-error' : ''}`} onChange={event => setQuantity(event.target.value)} />
          <div className="nhsuk-input-wrapper__suffix" aria-hidden="true"><T k={`unitNames.${unit}`} /></div>
        </div>
      </div>
      <FrequencyRadios id="details-frequency" value={frequency} onChange={setFrequency} error={errors.includes('frequency')} />
      <Button onClick={save}><T k={fromCheck ? 'addForm.saveEdit' : 'common.continue'} /></Button>
    </>
  );
}

/** "With or just after food", and a tag when the patient kept a timing against the rules. */
export function TimingValue({ addition }: { addition: PatientAddition }) {
  const flagged = addition.medicine && addition.keepOwnTiming && timingConflict(addition.medicine.ingredients, addition.timing);
  return <><T k={`timings.${addition.timing}`} />{flagged && <> <Tag colour="orange"><T k="flag.tag" /></Tag></>}</>;
}

function AdditionSummary({ addition }: { addition: PatientAddition }) {
  return (
    <dl className="nhsuk-summary-list app-compact-summary">
      <div className="nhsuk-summary-list__row">
        <dt className="nhsuk-summary-list__key"><T k="common.dose" /></dt>
        <dd className="nhsuk-summary-list__value"><DoseAmount dose={addition.dose} strength={addition.medicine?.strength ?? addition.strength} entered={!addition.medicine} /></dd>
      </div>
      <div className="nhsuk-summary-list__row">
        <dt className="nhsuk-summary-list__key"><T k="common.howOften" /></dt>
        <dd className="nhsuk-summary-list__value"><T k={`frequencies.${addition.frequency}`} /></dd>
      </div>
      <div className="nhsuk-summary-list__row">
        <dt className="nhsuk-summary-list__key"><T k="common.whenTaken" /></dt>
        <dd className="nhsuk-summary-list__value"><TimingValue addition={addition} /></dd>
      </div>
      {addition.instructions && (
        <div className="nhsuk-summary-list__row">
          <dt className="nhsuk-summary-list__key"><T k="common.instructions" /></dt>
          <dd className="nhsuk-summary-list__value"><Entered>{addition.instructions}</Entered></dd>
        </div>
      )}
    </dl>
  );
}


export function Additions() {
  const { state, go, updateDraft, next, back, t } = useJourney();
  const [removed, setRemoved] = useState('');
  const additions = state.draft.additions;
  const remove = (addition: PatientAddition) => {
    updateDraft(draft => ({ ...draft, additions: draft.additions.filter(other => other.id !== addition.id) }));
    setRemoved(t('additions.removed', { name: addition.name }));
    document.getElementById('page-heading')?.focus();
  };
  return (
    <>
      <BackLink to={back('additions', 'medicines')} />
      <PageHeading caption={<Caption />}><T k="additions.title" /></PageHeading>
      <p className="nhsuk-body"><T k="additions.lede" /></p>
      <InsetText><p><T k="additions.notRecord" /></p></InsetText>
      <p className="nhsuk-u-visually-hidden" role="status">{removed}</p>
      {additions.length ? (
        <>
          <h2 className="nhsuk-heading-m"><T k="additions.listTitle" /></h2>
          <ul className="nhsuk-list app-cards">
            {additions.map(addition => (
              <li className="nhsuk-card app-card" key={addition.id}>
                <div className="nhsuk-card__content">
                  <h3 className="nhsuk-card__heading nhsuk-heading-s"><AdditionName addition={addition} /></h3>
                  <p className="app-tags">
                    <Tag colour="blue"><T k="common.addedByYou" /></Tag>
                    {!addition.medicine && <Tag colour="orange"><T k="common.notMatched" /></Tag>}
                  </p>
                  <AdditionSummary addition={addition} />
                  <ul className="app-card-actions">
                    <li><NavLink onClick={() => go('addition-form', { editingAdditionId: addition.id })}><T k="common.change" /><span className="nhsuk-u-visually-hidden"> {addition.name}</span></NavLink></li>
                    <li><LinkButton onClick={() => remove(addition)}><T k="common.remove" /><span className="nhsuk-u-visually-hidden"> {addition.name}</span></LinkButton></li>
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : <p className="nhsuk-body app-empty"><T k="additions.empty" /></p>}
      <Button secondary onClick={() => go('addition-form', { editingAdditionId: undefined })}>
        <T k={additions.length ? 'additions.addAnother' : 'additions.add'} />
      </Button>
      <div>
        <Button onClick={() => next('additions', 'check')}><T k={additions.length ? 'common.continue' : 'additions.nothingToAdd'} /></Button>
      </div>
    </>
  );
}

interface FormState {
  query: string;
  medicine?: MedicineOption;
  manual: boolean;
  manualName: string;
  strength: string;
  quantity: string;
  unit?: DoseUnit;
  frequency?: Frequency;
  timing?: FoodTiming;
  instructions: string;
}

type FormField = 'name' | 'manualName' | 'strength' | 'quantity' | 'unit' | 'frequency' | 'timing';
const FIELD_IDS: Record<FormField, string> = {
  name: 'addition-name', manualName: 'addition-manual-name', strength: 'addition-strength', quantity: 'addition-quantity', unit: 'addition-unit', frequency: 'addition-frequency', timing: 'addition-timing',
};

function SearchOption({ option, alias }: { option: MedicineOption; alias?: SearchResult['matchedAlias'] }) {
  return (
    <>
      <span className="app-option__name"><Latin>{option.name}</Latin></span>
      <span className="app-option__detail">{option.strength && <><Latin>{option.strength}</Latin>{' '}</>}<T k={`forms.${option.form}`} /></span>
      {alias && (
        <span className="app-option__alias">
          <T k={alias.type === 'brand' ? 'addForm.brand' : 'addForm.alsoKnownAs'} params={{ name: alias.name }} />
        </span>
      )}
    </>
  );
}

/** Where to go once an addition is saved: back to check answers from a change, otherwise the list. */
function afterAddition(changeEnd: string | undefined) {
  return changeEnd === 'addition-form' ? 'check' : 'additions';
}

export function AdditionForm() {
  const { state, options, record, go, updateDraft, back, t, lang } = useJourney();
  const editing = state.draft.additions.find(addition => addition.id === state.editingAdditionId);
  const [form, setForm] = useState<FormState>(() => ({
    query: '',
    medicine: editing?.medicine,
    manual: Boolean(editing && !editing.medicine),
    manualName: editing && !editing.medicine ? editing.name : '',
    strength: editing && !editing.medicine ? editing.strength : '',
    quantity: editing ? numberText(editing.dose.quantity, lang) : '',
    unit: editing && !editing.medicine ? editing.dose.unit : undefined,
    frequency: editing?.frequency,
    timing: editing?.timing,
    instructions: editing?.instructions ?? '',
  }));
  const [errors, setErrors] = useState<FormField[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const results = useMemo(() => searchMedicines(options, form.query), [options, form.query]);
  const medicine = form.medicine;
  const recommended = medicine ? recommendedTiming(medicine.ingredients) : undefined;
  // The same active ingredient on the record, such as a second strength of naproxen.
  const sameIngredient = medicine && record.find(other => other.medicine.ingredients.some(ingredient => medicine.ingredients.includes(ingredient)));
  const change = (changes: Partial<FormState>) => setForm(current => ({ ...current, ...changes }));

  const errorText = (field: FormField) => t(`addForm.errors.${field}` as MessageKey);
  const fieldError = (field: FormField) => (errors.includes(field) ? <ErrorMessage id={`${FIELD_IDS[field]}-error`}>{errorText(field)}</ErrorMessage> : null);
  const groupClass = (field: FormField) => `nhsuk-form-group${errors.includes(field) ? ' nhsuk-form-group--error' : ''}`;

  const choose = (result: SearchResult) => {
    change({ medicine: result.option, query: '', manual: false });
    setOpen(false);
    setActive(-1);
    setErrors(current => current.filter(field => field !== 'name'));
    requestAnimationFrame(() => document.getElementById('addition-selected')?.focus());
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive(current => (event.key === 'ArrowDown' ? (current + 1) % results.length : (current <= 0 ? results.length - 1 : current - 1)));
    } else if (event.key === 'Enter' && open && active >= 0) {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const save = () => {
    const found: FormField[] = [];
    if (!medicine && !form.manual) found.push('name');
    if (form.manual && !form.manualName.trim()) found.push('manualName');
    if (form.manual && !form.strength.trim()) found.push('strength');
    const quantity = parseQuantity(form.quantity);
    if (quantity === null) found.push('quantity');
    if (!medicine && !form.unit) found.push('unit');
    if (!form.frequency) found.push('frequency');
    if (!form.timing) found.push('timing');
    setErrors(found);
    setAttempt(count => count + 1);
    if (found.length) return;
    const conflict = medicine ? timingConflict(medicine.ingredients, form.timing!) : undefined;
    const addition: PatientAddition = {
      id: editing?.id ?? `added-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      medicine,
      name: medicine ? medicine.name : form.manualName.trim(),
      strength: medicine ? medicine.strength ?? '' : form.strength.trim(),
      dose: { quantity: quantity!, unit: medicine ? unitForForm(medicine.form) : form.unit! },
      frequency: form.frequency!,
      timing: form.timing!,
      // A kept timing stays kept only while the medicine and timing are unchanged.
      keepOwnTiming: conflict && editing?.keepOwnTiming && editing.medicine?.id === medicine?.id && editing.timing === form.timing ? true : undefined,
      instructions: form.instructions.trim() || undefined,
    };
    updateDraft(draft => ({
      ...draft,
      additions: editing ? draft.additions.map(other => (other.id === editing.id ? addition : other)) : [...draft.additions, addition],
    }));
    // A timing that goes against the medicine's instructions is checked with the patient first.
    if (conflict && !addition.keepOwnTiming) go('addition-timing', { editingAdditionId: addition.id });
    else go(afterAddition(state.changeFlow?.end), { editingAdditionId: undefined });
  };
  const leave = back('addition-form', 'additions');

  const showList = open && form.query.trim().length >= 2 && !medicine && !form.manual;
  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <>
      <BackLink onClick={() => go(leave, { editingAdditionId: undefined })} />
      <ErrorSummary attempt={attempt} errors={errors.map(field => ({ href: `#${FIELD_IDS[field]}`, text: errorText(field) }))} />
      <PageHeading caption={<Caption />}><T k={editing ? 'addForm.titleEdit' : 'addForm.titleAdd'} /></PageHeading>

      {medicine ? (
        <div className="nhsuk-form-group">
          <p className="nhsuk-label nhsuk-label--s"><T k="addForm.selected" /></p>
          <div className="app-selected" id="addition-selected" tabIndex={-1}>
            <SearchOption option={medicine} />
          </div>
          {sameIngredient && (
            <div className="nhsuk-inset-text" id="addition-same-ingredient">
              <p><TName k="addForm.alreadyOnRecord" name={[sameIngredient.medicine.name, sameIngredient.medicine.strength].filter(Boolean).join(' ')} /></p>
            </div>
          )}
          <LinkButton onClick={() => { change({ medicine: undefined }); requestAnimationFrame(() => document.getElementById('addition-name')?.focus()); }}>
            <T k="addForm.chooseDifferent" />
          </LinkButton>
        </div>
      ) : form.manual ? (
        <>
          <div className={groupClass('manualName')}>
            <label className="nhsuk-label nhsuk-label--s" htmlFor="addition-manual-name"><T k="addForm.manualLabel" /></label>
            <div className="nhsuk-hint" id="addition-manual-name-hint"><T k="addForm.manualHint" /></div>
            {fieldError('manualName')}
            <p className="app-tags"><Tag colour="orange"><T k="common.notMatched" /></Tag></p>
            <input className={`nhsuk-input${errors.includes('manualName') ? ' nhsuk-input--error' : ''}`} id="addition-manual-name" type="text" dir="auto" autoComplete="off" spellCheck={false}
              value={form.manualName} aria-describedby="addition-manual-name-hint" onChange={event => change({ manualName: event.target.value })} />
            <p><LinkButton onClick={() => { change({ manual: false, query: form.manualName }); requestAnimationFrame(() => document.getElementById('addition-name')?.focus()); }}>
              <T k="addForm.chooseDifferent" />
            </LinkButton></p>
          </div>
          <div className={groupClass('strength')}>
            <label className="nhsuk-label nhsuk-label--s" htmlFor="addition-strength"><T k="addForm.strengthLabel" /></label>
            <div className="nhsuk-hint" id="addition-strength-hint"><T k="addForm.strengthHint" /></div>
            {fieldError('strength')}
            <input className={`nhsuk-input nhsuk-input--width-10${errors.includes('strength') ? ' nhsuk-input--error' : ''}`} id="addition-strength" type="text" dir="auto" autoComplete="off"
              value={form.strength} aria-describedby="addition-strength-hint" onChange={event => change({ strength: event.target.value })} />
          </div>
        </>
      ) : (
        <div className={groupClass('name')}>
          <label className="nhsuk-label nhsuk-label--s" htmlFor="addition-name"><T k="addForm.nameLabel" /></label>
          <div className="nhsuk-hint" id="addition-name-hint"><T k="addForm.nameHint" /></div>
          {fieldError('name')}
          <div className="app-combobox">
            <input
              className={`nhsuk-input${errors.includes('name') ? ' nhsuk-input--error' : ''}`}
              id="addition-name" type="text" role="combobox" autoComplete="off" spellCheck={false} dir="auto"
              aria-autocomplete="list" aria-expanded={showList} aria-controls={listId}
              aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
              aria-describedby={`addition-name-hint${errors.includes('name') ? ' addition-name-error' : ''}`}
              value={form.query}
              onChange={event => { change({ query: event.target.value }); setOpen(true); setActive(-1); }}
              onKeyDown={onKeyDown}
            />
            <ul className="app-combobox__list" id={listId} role="listbox" aria-label={t('addForm.nameLabel')} hidden={!showList}>
              {showList && results.map((result, index) => (
                <li key={result.option.id} id={optionId(index)} role="option" aria-selected={index === active}
                  className={`app-option${index === active ? ' app-option--active' : ''}`}
                  onMouseDown={event => event.preventDefault()} onClick={() => choose(result)}>
                  <SearchOption option={result.option} alias={result.matchedAlias} />
                </li>
              ))}
              {showList && !results.length && <li className="app-option app-option--empty" role="option" aria-selected={false} aria-disabled="true"><T k="addForm.noResults" /></li>}
            </ul>
          </div>
          <p className="nhsuk-u-visually-hidden" role="status" aria-live="polite">
            {form.query.trim().length >= 2 ? (results.length ? t('addForm.results', { count: results.length }) : t('addForm.noResults')) : ''}
          </p>
          <p className="app-cannot-find">
            <LinkButton onClick={() => { change({ manual: true, manualName: form.query }); requestAnimationFrame(() => document.getElementById('addition-manual-name')?.focus()); }}>
              <T k="addForm.cannotFind" />
            </LinkButton>
          </p>
        </div>
      )}

      {medicine && (
        <div className="nhsuk-form-group">
          <p className="nhsuk-label nhsuk-label--s"><T k="common.strength" /></p>
          <p className="nhsuk-body app-readonly-value"><Latin>{medicine.strength || '—'}</Latin></p>
          <div className="nhsuk-hint"><T k="addForm.strengthFromProduct" /></div>
        </div>
      )}

      <div className={`nhsuk-form-group${errors.includes('quantity') || errors.includes('unit') ? ' nhsuk-form-group--error' : ''}`}>
        <fieldset className="nhsuk-fieldset" aria-describedby="addition-quantity-hint">
          <legend className="nhsuk-fieldset__legend nhsuk-fieldset__legend--s"><T k="addForm.doseLegend" /></legend>
          <div className="nhsuk-hint" id="addition-quantity-hint"><T k="addForm.quantityHint" /></div>
          {fieldError('quantity')}
          <div className="nhsuk-form-group app-quantity">
            <label className="nhsuk-label" htmlFor="addition-quantity"><T k="addForm.quantityLabel" /></label>
            <div className="nhsuk-input-wrapper">
              <input className={`nhsuk-input nhsuk-input--width-3${errors.includes('quantity') ? ' nhsuk-input--error' : ''}`} id="addition-quantity" type="text" inputMode="decimal" autoComplete="off" dir="ltr"
                value={form.quantity} aria-describedby={errors.includes('quantity') ? 'addition-quantity-error' : undefined} onChange={event => change({ quantity: event.target.value })} />
              {medicine && <div className="nhsuk-input-wrapper__suffix" aria-hidden="true"><T k={`unitNames.${unitForForm(medicine.form)}`} /></div>}
            </div>
          </div>
          {!medicine && (
            <div className="app-unit">
              <p className="nhsuk-label" id="addition-unit-legend"><T k="addForm.unitLegend" /></p>
              {fieldError('unit')}
              <div className="nhsuk-radios nhsuk-radios--small" role="radiogroup" aria-labelledby="addition-unit-legend">
                {DOSE_UNITS.map((unit, index) => (
                  <div className="nhsuk-radios__item" key={unit}>
                    <input className="nhsuk-radios__input" id={index === 0 ? 'addition-unit' : `addition-unit-${unit}`} name="addition-unit" type="radio" value={unit}
                      checked={form.unit === unit} onChange={() => change({ unit })} />
                    <label className="nhsuk-label nhsuk-radios__label" htmlFor={index === 0 ? 'addition-unit' : `addition-unit-${unit}`}><T k={`unitNames.${unit}`} /></label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </fieldset>
      </div>

      <FrequencyRadios id="addition-frequency" value={form.frequency} onChange={frequency => change({ frequency })} error={errors.includes('frequency')} />

      <div className={groupClass('timing')}>
        <fieldset className="nhsuk-fieldset" aria-describedby={`addition-timing-hint${errors.includes('timing') ? ' addition-timing-error' : ''}`}>
          <legend className="nhsuk-fieldset__legend nhsuk-fieldset__legend--s"><T k="addForm.timingLegend" /></legend>
          <div className="nhsuk-hint" id="addition-timing-hint">
            {recommended ? <TName k={`addForm.timingRecommended.${recommended}`} name={medicine!.name} /> : <T k="addForm.timingHint" />}
          </div>
          {fieldError('timing')}
          <div className="nhsuk-radios nhsuk-radios--small">
            {FOOD_TIMINGS.map((timing, index) => (
              <div className="nhsuk-radios__item" key={timing}>
                <input className="nhsuk-radios__input" id={index === 0 ? 'addition-timing' : `addition-timing-${timing}`} name="addition-timing" type="radio" value={timing}
                  checked={form.timing === timing} onChange={() => change({ timing })} />
                <label className="nhsuk-label nhsuk-radios__label" htmlFor={index === 0 ? 'addition-timing' : `addition-timing-${timing}`}><T k={`timings.${timing}`} /></label>
              </div>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="nhsuk-form-group">
        <label className="nhsuk-label nhsuk-label--s" htmlFor="addition-instructions"><T k="addForm.instructionsLabel" /></label>
        <div className="nhsuk-hint" id="addition-instructions-hint"><T k="addForm.instructionsHint" /></div>
        <textarea className="nhsuk-textarea" id="addition-instructions" rows={3} dir="auto" value={form.instructions}
          aria-describedby="addition-instructions-hint" onChange={event => change({ instructions: event.target.value })} />
      </div>

      <Button onClick={save}><T k={editing ? 'addForm.saveEdit' : 'addForm.saveAdd'} /></Button>
      <p><NavLink onClick={() => go(leave, { editingAdditionId: undefined })}><T k="common.cancel" /></NavLink></p>
    </>
  );
}

/**
 * Shown when a patient says they take an added medicine at a time that goes
 * against its instructions, such as naproxen before food. It recommends the
 * usual timing; the patient can keep their own, which is then flagged.
 */
export function AdditionTiming() {
  const { state, go, updateDraft, t } = useJourney();
  const addition = state.draft.additions.find(item => item.id === state.editingAdditionId);
  const conflict = addition?.medicine ? timingConflict(addition.medicine.ingredients, addition.timing) : undefined;
  const [choice, setChoice] = useState<'change' | 'keep' | undefined>(addition?.keepOwnTiming ? 'keep' : undefined);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (!addition || !conflict) return null;
  const name = addition.medicine!.name;

  const save = () => {
    setAttempt(count => count + 1);
    if (!choice) { setError(true); return; }
    updateDraft(draft => ({
      ...draft,
      additions: draft.additions.map(item => (item.id === addition.id
        ? (choice === 'change' ? { ...item, timing: conflict.recommended, keepOwnTiming: undefined } : { ...item, keepOwnTiming: true })
        : item)),
    }));
    go(afterAddition(state.changeFlow?.end), { editingAdditionId: undefined });
  };

  return (
    <>
      <BackLink onClick={() => go('addition-form', { editingAdditionId: addition.id })} />
      <ErrorSummary attempt={attempt} errors={error ? [{ href: '#timing-choice', text: t('timingCheck.error') }] : []} />
      <PageHeading caption={<Caption />}><TName k="timingCheck.title" name={name} /></PageHeading>
      <WarningCallout heading={<T k="timingCheck.callout" />}>
        <p className="nhsuk-body"><TName k={`timingCheck.body.${conflict.recommended}`} name={name} /></p>
        <p className="nhsuk-body"><T k={`timingCheck.why.${conflict.recommended}`} /></p>
      </WarningCallout>
      <div className={`nhsuk-form-group${error ? ' nhsuk-form-group--error' : ''}`}>
        <fieldset className="nhsuk-fieldset" aria-describedby={error ? 'timing-choice-error' : undefined}>
          <legend className="nhsuk-fieldset__legend nhsuk-fieldset__legend--m"><h2 className="nhsuk-fieldset__heading"><T k="timingCheck.legend" /></h2></legend>
          {error && <ErrorMessage id="timing-choice-error"><T k="timingCheck.error" /></ErrorMessage>}
          <div className="nhsuk-radios">
            <div className="nhsuk-radios__item">
              <input className="nhsuk-radios__input" id="timing-choice" name="timing-choice" type="radio" value="change"
                checked={choice === 'change'} onChange={() => { setChoice('change'); setError(false); }} />
              <label className="nhsuk-label nhsuk-radios__label" htmlFor="timing-choice"><T k={`timingCheck.change.${conflict.recommended}`} /></label>
            </div>
            <div className="nhsuk-radios__item">
              <input className="nhsuk-radios__input" id="timing-choice-keep" name="timing-choice" type="radio" value="keep" aria-describedby="timing-choice-keep-hint"
                checked={choice === 'keep'} onChange={() => { setChoice('keep'); setError(false); }} />
              <label className="nhsuk-label nhsuk-radios__label" htmlFor="timing-choice-keep"><T k={`timingCheck.keep.${conflict.chosen}`} /></label>
              <div className="nhsuk-hint nhsuk-radios__hint" id="timing-choice-keep-hint"><T k="timingCheck.keepHint" /></div>
            </div>
          </div>
        </fieldset>
      </div>
      <Button onClick={save}><T k="common.continue" /></Button>
    </>
  );
}
