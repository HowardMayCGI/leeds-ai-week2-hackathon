import { useState, type KeyboardEvent, type ReactNode } from 'react'

const makeIcon = (symbol: string) =>
  function Icon(props: Record<string, unknown>) {
    return <span className="symbol" {...props}>{symbol}</span>
  }

const ArrowLeft = makeIcon('←')
const Bell = makeIcon('◔')
const CalendarDays = makeIcon('□')
const Check = makeIcon('✓')
const ChevronRight = makeIcon('›')
const CircleUserRound = makeIcon('○')
const Clock3 = makeIcon('◷')
const Home = makeIcon('⌂')
const Mail = makeIcon('▱')
const ShieldCheck = makeIcon('◇')
const Utensils = makeIcon('∥')

type Screen = 'medicines' | 'intro' | 'questions' | 'schedule' | 'done'

const medicines = [
  {
    name: 'Levothyroxine',
    dose: '50 micrograms · 1 tablet',
    timing: '7:00am',
    instruction: 'Take on an empty stomach, 30 minutes before breakfast',
    icon: Clock3,
  },
  {
    name: 'Metformin',
    dose: '500mg · 1 tablet',
    timing: '8:00am',
    instruction: 'Take with breakfast',
    icon: Utensils,
  },
  {
    name: 'Amlodipine',
    dose: '5mg · 1 tablet',
    timing: '6:00pm',
    instruction: 'Take at the same time each day',
    icon: Clock3,
  },
  {
    name: 'Atorvastatin',
    dose: '20mg · 1 tablet',
    timing: '9:00pm',
    instruction: 'Take in the evening',
    icon: Clock3,
  },
]

function Action({
  children,
  onClick,
  className = '',
  label,
}: {
  children: ReactNode
  onClick: () => void
  className?: string
  label?: string
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`action ${className}`}
    >
      {children}
    </div>
  )
}

function Title({ children }: { children: ReactNode }) {
  return <div role="heading" aria-level={1} className="title">{children}</div>
}

function Subheading({ children }: { children: ReactNode }) {
  return <div role="heading" aria-level={2} className="subheading">{children}</div>
}

function Header({ onBack }: { onBack?: () => void }) {
  return (
    <>
      <header className="header">
        <div className="nhs-logo" aria-label="NHS">NHS</div>
        <div className="app-help">App help</div>
      </header>
      {onBack && (
        <Action onClick={onBack} className="back">
          <ArrowLeft aria-hidden="true" />
          <span>Back</span>
        </Action>
      )}
    </>
  )
}

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <div className="nav-item active"><Home /><span>Home</span></div>
      <div className="nav-item"><Mail /><span>Messages</span></div>
      <div className="nav-item"><CircleUserRound /><span>Profile</span></div>
    </nav>
  )
}

function Shell({ children, back }: { children: ReactNode; back?: () => void }) {
  return (
    <main className="app-shell">
      <div className="page">
        <Header onBack={back} />
        <section className="content">{children}</section>
      </div>
      <BottomNav />
    </main>
  )
}

function Medicines({ next }: { next: () => void }) {
  return (
    <Shell>
      <Title>Medicines</Title>
      <div className="lede">Manage your prescriptions and understand when to take your medicines.</div>
      <div className="menu-card">
        <div className="menu-row">
          <div><strong>Order repeat prescriptions</strong><span>2 medicines available to order</span></div>
          <ChevronRight />
        </div>
        <div className="menu-row">
          <div><strong>Your medicines</strong><span>4 current medicines</span></div>
          <ChevronRight />
        </div>
        <Action onClick={next} className="menu-row highlighted">
          <div className="feature-icon"><CalendarDays /></div>
          <div><strong>Schedule my medicines</strong><span>Get a personalised daily plan</span></div>
          <ChevronRight />
        </Action>
      </div>
      <div className="safety-note"><ShieldCheck /><span>Your schedule is based on your NHS medicines record.</span></div>
    </Shell>
  )
}

function Intro({ next, back }: { next: () => void; back: () => void }) {
  return (
    <Shell back={back}>
      <div className="eyebrow">Schedule my medicines</div>
      <Title>Make medicines easier to manage</Title>
      <div className="intro-visual">
        <div className="time-pill"><Clock3 /> 7:00am</div>
        <div className="medicine-stack">
          <span>Before breakfast</span>
          <strong>Levothyroxine</strong>
          <small>1 tablet</small>
        </div>
        <div className="medicine-stack second">
          <span>With breakfast</span>
          <strong>Metformin</strong>
          <small>1 tablet</small>
        </div>
      </div>
      <div className="benefits">
        <div><Check /><span><strong>See everything in one plan</strong><small>We organise your medicines around meals and each other.</small></span></div>
        <div><Bell /><span><strong>Get reminders when you need them</strong><small>Choose notifications that fit your routine.</small></span></div>
        <div><ShieldCheck /><span><strong>Spot important instructions</strong><small>We highlight guidance from your medicines record.</small></span></div>
      </div>
      <div className="clinical-note">Always follow the instructions on your medicine label. Speak to a pharmacist if you are unsure.</div>
      <Action onClick={next} className="primary">Create my schedule</Action>
    </Shell>
  )
}

function Questions({ next, back }: { next: () => void; back: () => void }) {
  const [breakfast, setBreakfast] = useState('8:00am')
  const [dinner, setDinner] = useState('6:30pm')
  return (
    <Shell back={back}>
      <div className="step">Step 1 of 2</div>
      <Title>Tell us about your day</Title>
      <div className="lede">We’ll use your routine to suggest suitable times. You can change these later.</div>
      <div className="form-card">
        <label className="field-label" htmlFor="breakfast">When do you usually have breakfast?</label>
        <input id="breakfast" className="time-input" value={breakfast} onChange={(e) => setBreakfast(e.target.value)} />
        <label className="field-label" htmlFor="dinner">When do you usually have your evening meal?</label>
        <input id="dinner" className="time-input" value={dinner} onChange={(e) => setDinner(e.target.value)} />
        <div className="field-label">When do you usually go to bed?</div>
        <div className="choice-grid">
          {['Before 10pm', '10pm to midnight', 'After midnight'].map((choice, index) => (
            <div className={`choice ${index === 1 ? 'selected' : ''}`} key={choice}>{choice}{index === 1 && <Check />}</div>
          ))}
        </div>
      </div>
      <Action onClick={next} className="primary">Create my schedule</Action>
    </Shell>
  )
}

function Schedule({ next, back }: { next: () => void; back: () => void }) {
  return (
    <Shell back={back}>
      <div className="step">Step 2 of 2</div>
      <Title>Your daily schedule</Title>
      <div className="lede">We’ve spaced your medicines around your routine and their instructions.</div>
      <div className="timeline">
        {medicines.map(({ name, dose, timing, instruction, icon: Icon }, index) => (
          <div className="timeline-row" key={name}>
            <div className="timeline-time">{timing}</div>
            <div className="timeline-marker"><Icon /></div>
            <div className="medicine-card">
              <strong>{name}</strong>
              <span>{dose}</span>
              <small>{instruction}</small>
            </div>
            {index < medicines.length - 1 && <div className="timeline-line" />}
          </div>
        ))}
      </div>
      <div className="info-box"><ShieldCheck /><span><strong>We’ve kept these medicines apart</strong><small>Levothyroxine is scheduled before food and separately from your other morning medicine.</small></span></div>
      <Action onClick={next} className="primary">Use this schedule</Action>
      <Action onClick={back} className="secondary">Change my routine</Action>
    </Shell>
  )
}

function Done({ back }: { back: () => void }) {
  return (
    <Shell>
      <div className="success-mark"><Check /></div>
      <Title>Your schedule is ready</Title>
      <div className="lede centered">We’ll remind you when it’s time to take each medicine.</div>
      <div className="next-dose">
        <span>Next medicine</span>
        <div><Clock3 /><strong>Tomorrow at 7:00am</strong></div>
        <p>Levothyroxine · 1 tablet<br />30 minutes before breakfast</p>
      </div>
      <div className="info-box"><Bell /><span><strong>Reminders are on</strong><small>You can change them at any time in your schedule settings.</small></span></div>
      <Action onClick={back} className="primary">View my schedule</Action>
      <Action onClick={() => window.location.reload()} className="secondary">Back to medicines</Action>
    </Shell>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('medicines')
  if (screen === 'intro') return <Intro next={() => setScreen('questions')} back={() => setScreen('medicines')} />
  if (screen === 'questions') return <Questions next={() => setScreen('schedule')} back={() => setScreen('intro')} />
  if (screen === 'schedule') return <Schedule next={() => setScreen('done')} back={() => setScreen('questions')} />
  if (screen === 'done') return <Done back={() => setScreen('schedule')} />
  return <Medicines next={() => setScreen('intro')} />
}
