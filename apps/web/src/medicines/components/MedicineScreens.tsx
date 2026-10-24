'use client';

import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import {
  DOSE_UNITS, findProduct, formatStrength, FREQUENCIES, parseQuantity, PATIENT_RECORD, searchCatalogue, unitForForm,
  type CatalogueProduct, type DoseUnit, type Frequency, type PatientAddition, type SearchResult,
} from '@hackathon/medicines';
import { useJourney } from '../context';
import type { MessageKey } from '../i18n';
import {
  BackLink, Button, Caption, DoseAmount, Entered, ErrorMessage, ErrorSummary, InsetText, Latin, LinkButton, NavLink, PageHeading,
  RecordText, T, Tag, UntranslatedNote,
} from './ui';

export function MedicineName({ name, strength }: { name: string; strength?: string }) {
  return <Latin>{name}{strength ? ` ${strength}` : ''}</Latin>;
}

/** A patient addition's name: catalogue names in Latin script, entered names as typed. */
export function AdditionName({ addition }: { addition: PatientAddition }) {
  const product = findProduct(addition.productId);
  return product ? <MedicineName name={product.name} strength={formatStrength(product)} /> : <Entered>{addition.name}</Entered>;
}

/** NHS checkboxes for the record's medicines, with an exclusive "None of these" option. */
export function SelectMedicines() {
  const { state, updateDraft, next, back, t } = useJourney();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { selected, noneSelected } = state.draft;
  const toggle = (id: string, checked: boolean) => {
    updateDraft(draft => ({
      ...draft,
      // Keep record order so the selection reads the same everywhere.
      selected: PATIENT_RECORD.map(medicine => medicine.id).filter(other => (other === id ? checked : draft.selected.includes(other))),
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
    next('medicines', 'additions');
  };
  const firstId = `medicine-${PATIENT_RECORD[0].id}`;
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
          <div className="nhsuk-hint" id="medicines-hint"><T k="select.hint" /></div>
          <UntranslatedNote />
          {error && <ErrorMessage id="medicines-error"><T k="select.error" /></ErrorMessage>}
          <div className="nhsuk-checkboxes">
            {PATIENT_RECORD.map(medicine => {
              const id = `medicine-${medicine.id}`;
              return (
                <div className="nhsuk-checkboxes__item" key={medicine.id}>
                  <input className="nhsuk-checkboxes__input" id={id} name="medicines" type="checkbox" value={medicine.id}
                    checked={selected.includes(medicine.id)} aria-describedby={`${id}-hint`}
                    onChange={event => toggle(medicine.id, event.target.checked)} />
                  <label className="nhsuk-label nhsuk-checkboxes__label" htmlFor={id}>
                    <MedicineName name={medicine.name} strength={medicine.strength} />
                  </label>
                  <div className="nhsuk-hint nhsuk-checkboxes__hint app-record-hint" id={`${id}-hint`}>
                    <span className="app-record-hint__line"><DoseAmount dose={medicine.dose} strength={medicine.strength} /></span>
                    <span className="app-record-hint__line"><RecordText text={medicine.frequencyText} language={medicine.language} /></span>
                    {medicine.instructionText && <span className="app-record-hint__line"><RecordText text={medicine.instructionText} language={medicine.language} /></span>}
                  </div>
                </div>
              );
            })}
            <div className="nhsuk-checkboxes__divider"><T k="common.or" /></div>
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

function productLabel(product: CatalogueProduct, t: (key: MessageKey) => string) {
  const strength = formatStrength(product);
  return { name: product.name, strength, form: t(`forms.${product.form}` as MessageKey) };
}

function AdditionSummary({ addition }: { addition: PatientAddition }) {
  const product = findProduct(addition.productId);
  return (
    <dl className="nhsuk-summary-list app-compact-summary">
      <div className="nhsuk-summary-list__row">
        <dt className="nhsuk-summary-list__key"><T k="common.dose" /></dt>
        <dd className="nhsuk-summary-list__value"><DoseAmount dose={addition.dose} strength={product ? formatStrength(product) : addition.strength} entered={!product} /></dd>
      </div>
      <div className="nhsuk-summary-list__row">
        <dt className="nhsuk-summary-list__key"><T k="common.howOften" /></dt>
        <dd className="nhsuk-summary-list__value"><T k={`frequencies.${addition.frequency}`} /></dd>
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
                    {!addition.productId && <Tag colour="orange"><T k="common.notMatched" /></Tag>}
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
  productId?: string;
  manual: boolean;
  manualName: string;
  strength: string;
  quantity: string;
  unit?: DoseUnit;
  frequency?: Frequency;
  instructions: string;
}

type FormField = 'name' | 'manualName' | 'strength' | 'quantity' | 'unit' | 'frequency';
const FIELD_IDS: Record<FormField, string> = {
  name: 'addition-name', manualName: 'addition-manual-name', strength: 'addition-strength', quantity: 'addition-quantity', unit: 'addition-unit', frequency: 'addition-frequency',
};

function SearchOption({ result }: { result: SearchResult }) {
  const { t } = useJourney();
  const label = productLabel(result.product, t);
  return (
    <>
      <span className="app-option__name"><Latin>{label.name}</Latin></span>
      <span className="app-option__detail">{label.strength && <><Latin>{label.strength}</Latin>{' '}</>}{label.form} · <T k={`kinds.${result.product.kind}`} /></span>
      {result.matchedAlias && (
        <span className="app-option__alias">
          <T k={result.matchedAlias.type === 'brand' ? 'addForm.brand' : 'addForm.alsoKnownAs'} params={{ name: result.matchedAlias.name }} />
        </span>
      )}
    </>
  );
}

export function AdditionForm() {
  const { state, go, updateDraft, back, t, lang } = useJourney();
  const editing = state.draft.additions.find(addition => addition.id === state.editingAdditionId);
  const [form, setForm] = useState<FormState>(() => ({
    query: '',
    productId: editing?.productId,
    manual: Boolean(editing && !editing.productId),
    manualName: editing && !editing.productId ? editing.name : '',
    strength: editing && !editing.productId ? editing.strength : '',
    quantity: editing ? new Intl.NumberFormat(lang === 'en' ? 'en-GB' : lang, { maximumFractionDigits: 2, useGrouping: false }).format(editing.dose.quantity) : '',
    unit: editing && !editing.productId ? editing.dose.unit : undefined,
    frequency: editing?.frequency,
    instructions: editing?.instructions ?? '',
  }));
  const [errors, setErrors] = useState<FormField[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const results = useMemo(() => searchCatalogue(form.query), [form.query]);
  const product = findProduct(form.productId);
  const change = (changes: Partial<FormState>) => setForm(current => ({ ...current, ...changes }));

  const errorText = (field: FormField) => t(`addForm.errors.${field}` as MessageKey);
  const fieldError = (field: FormField) => (errors.includes(field) ? <ErrorMessage id={`${FIELD_IDS[field]}-error`}>{errorText(field)}</ErrorMessage> : null);
  const groupClass = (field: FormField) => `nhsuk-form-group${errors.includes(field) ? ' nhsuk-form-group--error' : ''}`;

  const choose = (result: SearchResult) => {
    change({ productId: result.product.id, query: '', manual: false });
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
    if (!product && !form.manual) found.push('name');
    if (form.manual && !form.manualName.trim()) found.push('manualName');
    if (form.manual && !form.strength.trim()) found.push('strength');
    const quantity = parseQuantity(form.quantity);
    if (quantity === null) found.push('quantity');
    if (!product && !form.unit) found.push('unit');
    if (!form.frequency) found.push('frequency');
    setErrors(found);
    setAttempt(count => count + 1);
    if (found.length) return;
    const addition: PatientAddition = {
      id: editing?.id ?? `added-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      productId: product?.id,
      name: product ? product.name : form.manualName.trim(),
      strength: product ? formatStrength(product) : form.strength.trim(),
      dose: { quantity: quantity!, unit: product ? unitForForm(product.form) : form.unit! },
      frequency: form.frequency!,
      instructions: form.instructions.trim() || undefined,
    };
    updateDraft(draft => ({
      ...draft,
      additions: editing ? draft.additions.map(other => (other.id === editing.id ? addition : other)) : [...draft.additions, addition],
    }));
    // From check answers, a change returns there; otherwise to the list of additions.
    go(state.changeFlow?.end === 'addition-form' ? 'check' : 'additions', { editingAdditionId: undefined });
  };
  const leave = back('addition-form', 'additions');

  const showList = open && form.query.trim().length >= 2 && !product && !form.manual;
  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <>
      <BackLink onClick={() => go(leave, { editingAdditionId: undefined })} />
      <ErrorSummary attempt={attempt} errors={errors.map(field => ({ href: `#${FIELD_IDS[field]}`, text: errorText(field) }))} />
      <PageHeading caption={<Caption />}><T k={editing ? 'addForm.titleEdit' : 'addForm.titleAdd'} /></PageHeading>

      {product ? (
        <div className="nhsuk-form-group">
          <p className="nhsuk-label nhsuk-label--s"><T k="addForm.selected" /></p>
          <div className="app-selected" id="addition-selected" tabIndex={-1}>
            <SearchOption result={{ product, score: 0 }} />
          </div>
          <LinkButton onClick={() => { change({ productId: undefined }); requestAnimationFrame(() => document.getElementById('addition-name')?.focus()); }}>
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
                <li key={result.product.id} id={optionId(index)} role="option" aria-selected={index === active}
                  className={`app-option${index === active ? ' app-option--active' : ''}`}
                  onMouseDown={event => event.preventDefault()} onClick={() => choose(result)}>
                  <SearchOption result={result} />
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

      {product && (
        <div className="nhsuk-form-group">
          <p className="nhsuk-label nhsuk-label--s"><T k="common.strength" /></p>
          <p className="nhsuk-body app-readonly-value"><Latin>{formatStrength(product) || '—'}</Latin></p>
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
              {product && <div className="nhsuk-input-wrapper__suffix" aria-hidden="true"><T k={`unitNames.${unitForForm(product.form)}`} /></div>}
            </div>
          </div>
          {!product && (
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

      <div className={groupClass('frequency')}>
        <fieldset className="nhsuk-fieldset" aria-describedby={errors.includes('frequency') ? 'addition-frequency-error' : undefined}>
          <legend className="nhsuk-fieldset__legend nhsuk-fieldset__legend--s"><T k="addForm.frequencyLegend" /></legend>
          {fieldError('frequency')}
          <div className="nhsuk-radios nhsuk-radios--small">
            {FREQUENCIES.map((frequency, index) => (
              <div className="nhsuk-radios__item" key={frequency}>
                <input className="nhsuk-radios__input" id={index === 0 ? 'addition-frequency' : `addition-frequency-${frequency}`} name="addition-frequency" type="radio" value={frequency}
                  checked={form.frequency === frequency} onChange={() => change({ frequency })} />
                <label className="nhsuk-label nhsuk-radios__label" htmlFor={index === 0 ? 'addition-frequency' : `addition-frequency-${frequency}`}><T k={`frequencies.${frequency}`} /></label>
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
