"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A short slide deck for the 4-minute hackathon pitch, opened from the web
 * page beside the app. It is not part of the app inside the phone.
 */

type Slide = { label: string; title: string; body: ReactNode };

const SLIDES: Slide[] = [
  {
    label: "Where the idea came from",
    title: "A conversation on a flight to Sicily",
    body: (
      <>
        <blockquote className="pitch-quote">
          <p>
            “I take 10 different medicines. Some must be taken with meals, some can’t be taken with
            others. So I asked ChatGPT to make me a schedule.”
          </p>
          <footer>A 72-year-old fellow passenger</footer>
        </blockquote>
        <p className="pitch-lead">
          A great idea. But why should a safe daily routine depend on being enterprising enough to
          ask a chatbot?
        </p>
      </>
    ),
  },
  {
    label: "The problem",
    title: "More medicines, harder routines",
    body: (
      <>
        <div className="pitch-stats">
          <div className="pitch-stat">
            <strong>9.5 → 19.9</strong>
            <span>prescription items per person per year in England, 1994 to 2019</span>
          </div>
          <div className="pitch-stat">
            <strong>+109%</strong>
            <span>increase in prescribing over 25 years</span>
          </div>
          <div className="pitch-stat">
            <strong>5+</strong>
            <span>
              medicines at once is called polypharmacy, common with several long-term conditions
            </span>
          </div>
        </div>
        <ul className="pitch-list">
          <li>
            <strong>Food and timing rules</strong>: before breakfast, with food, in the evening.
          </li>
          <li>
            <strong>Spacing between medicines</strong>: some stop others from working.
          </li>
          <li>
            <strong>Routines change</strong> whenever a prescription changes, so doses get missed or
            doubled.
          </li>
        </ul>
        <p className="pitch-source">
          Sources: DHSC National Overprescribing Review (2021); NHS App market research.
        </p>
      </>
    ),
  },
  {
    label: "Why the NHS App",
    title: "It already knows your prescriptions",
    body: (
      <>
        <div className="pitch-stats">
          <div className="pitch-stat">
            <strong>39.3 million</strong>
            <span>registered NHS App users</span>
          </div>
          <div className="pitch-stat">
            <strong>7.78 million</strong>
            <span>repeat prescription orders in one month</span>
          </div>
        </div>
        <ul className="pitch-list">
          <li>
            <strong>No retyping</strong>: start from the medicines on your record.
          </li>
          <li>
            <strong>No new app</strong> to download, learn and trust.
          </li>
          <li>
            <strong>Built with the NHS App design system</strong>, so it is familiar, accessible and
            quicker to deliver.
          </li>
        </ul>
        <p className="pitch-source">
          Source: NHS App statistics, September 2026. Concept prototype, not an NHS-approved
          service.
        </p>
      </>
    ),
  },
  {
    label: "Our approach",
    title: "Schedule my medicines",
    body: (
      <>
        <ol className="pitch-flow">
          <li>
            <strong>Your medicines</strong>
            <span>Confirm what you take from your record. Add extras from a photo of the box</span>
          </li>
          <li>
            <strong>Your day</strong>
            <span>When you wake, eat and sleep, in your own words if you like</span>
          </li>
          <li>
            <strong>The rules</strong>
            <span>Food, timing and spacing from NHS guidance, each with its source</span>
          </li>
          <li>
            <strong>Your schedule</strong>
            <span>As few times a day as possible, checked again before it is shown</span>
          </li>
          <li>
            <strong>Reminders</strong>
            <span>And a pharmacist review for anything uncertain</span>
          </li>
        </ol>
        <p className="pitch-lead">
          If no safe schedule exists, it explains why instead of bending a rule.
        </p>
      </>
    ),
  },
  {
    label: "How AI helps",
    title: "AI where it helps, rules where it matters",
    body: (
      <>
        <div className="pitch-columns pitch-columns--four">
          <div className="pitch-card">
            <h3>Snap the box</h3>
            <p>Add a medicine from a photo of its box or label, or by describing it.</p>
          </div>
          <div className="pitch-card">
            <h3>Describe your day</h3>
            <p>“I get up at 7 and skip lunch” fills in your routine, for you to check.</p>
          </div>
          <div className="pitch-card">
            <h3>Why at this time?</h3>
            <p>A plain-English reason under each dose, from the rules the scheduler used.</p>
          </div>
          <div className="pitch-card">
            <h3>Ask a question</h3>
            <p>Answers about your saved schedule, showing the facts they are based on.</p>
          </div>
        </div>
        <p className="pitch-lead">
          AI fills in forms and explains. It never chooses a time: rules and an independent checker
          do. In one study a general LLM found the interacting drug pair only 54.7% of the time.
        </p>
        <p className="pitch-source">
          Behind the app, AI also researched the problem, wrote all the code and tests, and made our
          UK test data.
        </p>
      </>
    ),
  },
  {
    label: "Responsible by design",
    title: "Let’s see it",
    body: (
      <>
        <ul className="pitch-list">
          <li>
            <strong>Synthetic patients only</strong>: realistic UK records from Synthea, no real
            patient data.
          </li>
          <li>
            <strong>Guarded AI</strong>: no name or NHS number sent; answers checked against the
            schedule’s facts; emergencies get fixed NHS 999 and 111 advice; labelled “Written by
            AI”.
          </li>
          <li>
            <strong>Never changes a prescription</strong>: it only times what was prescribed.
          </li>
          <li>
            <strong>Flags, doesn’t guess</strong>: uncertain medicines and patient choices go to a
            pharmacist.
          </li>
          <li>
            <strong>Inclusive</strong>: English, Polish and Urdu (right to left), and checked
            against WCAG 2.1 AA.
          </li>
        </ul>
        <p className="pitch-lead">Over to the demo.</p>
      </>
    ),
  },
];

export function Pitch() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const last = SLIDES.length - 1;
  const go = useCallback((next: number) => setIndex(Math.max(0, Math.min(last, next))), [last]);

  const open = () => {
    setIndex(0);
    dialog.current?.showModal();
    // Focus the deck rather than its close button, so arrow keys and Next work straight away.
    dialog.current?.focus();
  };
  const close = () => dialog.current?.close();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        setIndex((current) => Math.min(last, current + 1));
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
      }
    };
    element.addEventListener("keydown", onKey);
    return () => element.removeEventListener("keydown", onKey);
  }, [last]);

  const slide = SLIDES[index];

  return (
    <>
      <button type="button" className="showcase-pitch-button" onClick={open}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        Present our pitch
      </button>
      <dialog
        ref={dialog}
        className="pitch"
        tabIndex={-1}
        aria-labelledby="pitch-title"
        aria-describedby="pitch-progress"
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
      >
        <div className="pitch__panel">
          <header className="pitch__header">
            <p className="pitch__brand">
              Schedule my medicines <span>· Team Double Helix · Helix 2026</span>
            </p>
            <button type="button" className="pitch__close" onClick={close} aria-label="Close pitch">
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>
          <section className="pitch__slide" key={index}>
            <p className="pitch__label">
              {String(index + 1).padStart(2, "0")} / {slide.label}
            </p>
            <h2 className="pitch__title" id="pitch-title">
              {slide.title}
            </h2>
            {slide.body}
          </section>
          <footer className="pitch__footer">
            <button
              type="button"
              className="pitch__nav"
              onClick={() => go(index - 1)}
              disabled={index === 0}
            >
              Previous
            </button>
            <p className="pitch__progress" id="pitch-progress" aria-live="polite">
              <span className="pitch__dots" aria-hidden="true">
                {SLIDES.map((item, position) => (
                  <span
                    key={item.label}
                    className={position === index ? "is-current" : undefined}
                  />
                ))}
              </span>
              <span className="pitch__count">
                Slide {index + 1} of {SLIDES.length}
              </span>
            </p>
            {index < last ? (
              <button
                type="button"
                className="pitch__nav pitch__nav--primary"
                onClick={() => go(index + 1)}
              >
                Next
              </button>
            ) : (
              <button type="button" className="pitch__nav pitch__nav--primary" onClick={close}>
                Start the demo
              </button>
            )}
          </footer>
        </div>
      </dialog>
    </>
  );
}
