# leeds-ai-week2-hackathon
Leeds AI Week2 Hackathon repository

## Schedule my medicines (proof of concept)

The home page (`/`) is the **Schedule my medicines** journey agreed in the 24 October design session, in the style of the NHS App. It uses NHS.UK frontend and NHS App frontend (`nhsapp-frontend`) components, the test patient records in `test_data/` (served by the API) and proof-of-concept timing rules; it is not for clinical use.

The page has two parts. The **web page** introduces the app and holds the view options: the patient whose record the app shows, the app language (English, Polish or Urdu), the app height (a fixed phone screen where only the content scrolls, with NHS App bottom navigation, or full length) and **Start again as a new user**. The **app** is everything inside the phone.

**Prescriptions → Introduction → Routine (2 screens) → Select medicines → How do you take it? (only for record medicines with no dose or frequency) → Add anything missing (with a timing check) → Check answers → Proposed schedule → Save → Reminders.** Returning users go straight to their saved schedule, where they can view dose details, change their routine or medicines (creating a new proposal that only replaces the saved one when saved), manage the single reminder switch and request a pharmacist review.

| Where | What |
| --- | --- |
| `packages/medicines` | Framework-free domain code with unit tests: the versioned FHIR R4 routine `Questionnaire` (static JSON with FHIR translation extensions), a small renderer model (`enableWhen`, validation, `QuestionnaireResponse`), medicine options and fuzzy search built from the patient records, structured doses, reading record medicines, administration rules from NHS guidance, the deterministic scheduler, an independent checker and the day timeline. |
| `apps/web/src/medicines` | The web page and client-side journey, English/Polish/Urdu interface catalogues and right-to-left styling. It reads `/api/patients`, `/api/patients/{nhsNumber}/medications` and `/api/medicines`. |
| `apps/api` | Reads `test_data/`. `/api/medicines` lists every distinct medicine across all patients, which search suggests from. |
| `apps/web/e2e/medicines.spec.ts` | Browser walkthrough of the design doc's checks, with axe accessibility scans in English and Urdu. |

Behaviour worth knowing:

- Routine questions, hints and translations come from the Questionnaire. Times are entered as hour, minutes and am or pm, and stored as FHIR `time` values. A skipped meal is recorded as a boolean and its stale time is dropped; sleeping after midnight is supported.
- Record medicines are NHS checkboxes that start unchecked, with an exclusive **None of these** option. Each shows its dose with the size of each tablet, for example "1 tablet (10mg)", how often, and any recorded instructions. Recorded wording is read-only, untranslated and labelled as such in Polish and Urdu. If the record has no dose or frequency for a checked medicine, the app asks how the patient takes it.
- Added items are searched by partial, misspelt, generic or brand name and must be explicitly selected. Suggestions come only from medicines in the patient records; anything else, such as a supplement, can be typed in. If an added medicine shares an active ingredient with one on the record, the form says so.
- The patient also says when they take an added medicine (before food, with food, does not matter, not sure). If that goes against the guidance, such as naproxen before food, a check page recommends the usual timing. The patient can keep their own timing; it is then flagged in the schedule for a pharmacist to check.
- Food and timing rules are in `packages/medicines/src/rules.ts`, each linked to its NHS source: for example alendronic acid first thing, at least 30 minutes before other tablets; levothyroxine before breakfast and 4 hours from iron; naproxen, metformin and insulin with food; simvastatin in the evening. Unmatched items can be entered manually with their strength, amount and form; they are scheduled by how often they are taken, with a note that they were not checked against the list.
- Every daily medicine gets times, using as few separate times as possible. Medicines taken only when needed, or less often than daily (such as a 3-day patch), are listed separately.
- The schedule is an NHS App timeline of the patient's day: waking, meals and going to sleep, with each time's medicines.
- Every answer on Check your answers has its own Change link that returns straight there.
- The scheduler never relaxes a rule. If no valid schedule exists (for example, naproxen with food twice a day when only one meal is eaten) the page explains why and offers no save. Every proposal is re-verified by the independent checker before it is shown.
- Reminders default to ON, and notification permission is a separate state asked for with a device-style prompt.
- The saved schedule is kept in this browser's local storage, separately for each patient, until API persistence is added. **Start again as a new user** on the web page clears the selected patient's schedule. The patient, language and height preferences are also remembered on the device.
- Everything runs in the static UI, so no infrastructure changed. Moving schedule generation behind the API would need `POST` allowed on the CloudFront `/api/*` behaviour, which requires approval.

The original random number generator is now at `/random/`.

The API also exposes `GET /api/patients/:nhsNumber/interactions`: potential interactions from the patient's current medicines, with spacing constraints and separate prescriber/dose-review guidance. It uses a labelled, incomplete hackathon dataset mapping all 36 supplied products, with 10 sourced example rules. See [the interaction model, JSON examples, API contract and demo patients](docs/drug-interactions.md). This endpoint is not yet connected to the web scheduler and is not for clinical use.

For combined scheduling inputs, use `GET /api/patients/:nhsNumber/schedule-inputs`. It adds original prescription instructions, structured timing and administration requirements, interaction assessments and explicit confirmation/review issues. Four sourced demo administration rules cover six products; missing coverage is flagged. See [the scheduler contract, production data sources and frontend integration steps](docs/scheduler-inputs.md). The patient routine and current medicine use still require confirmation.

## Random number website

A minimal TypeScript application. The Next.js UI exports static pages and requests an integer from **1 to 100 inclusive** from a Lambda API when you select **Generate number**. Repeated numbers are possible.

```text
Browser → CloudFront (*.cloudfront.net)
            ├─ /*       → private S3 bucket (Next.js static export)
            └─ /api/*   → API Gateway HTTP API → Lambda
```

Each environment has its own resources and CloudFront URL. Both use AWS account `322517362875`, region `eu-west-2` and SSO profile `st-prod`. No domain or custom certificate is provisioned.

| Directory | Purpose |
| --- | --- |
| `apps/web` | Next.js App Router UI and browser tests |
| `apps/api` | Lambda handler, local HTTP adapter and API tests |
| `packages/api-contract` | Shared response type and runtime response validation |
| `infra` | TypeScript Pulumi project, `staging` and `prod` stacks, deployment commands |

### Install and run locally

Use Node.js **24.13.0** and pnpm **10.28.2** (also pinned in `.tool-versions`). Install dependencies once, then use Nx for all development and operational tasks:

```sh
pnpm install --frozen-lockfile
pnpm nx run-many -t dev -p web api
```

Open **http://127.0.0.1:3000**. The API listens on loopback port `3001`; Next.js proxies `/api/*` to it. Both servers watch for changes. Stop them together with Ctrl+C. Everyday development requires no AWS credentials or deployed resources.

The UI uses the official [NHS.UK frontend library](https://service-manual.nhs.uk/design-system/production) with an [NHS App-inspired](https://design-system.nhsapp.service.nhs.uk/) layout and custom **LAI App** branding for Leeds Artificial Intelligence. On desktop, the generator sits inside a decorative phone frame beside a short project introduction on a neutral background. At viewport widths of 700px and below, and on touch devices up to 1000px wide (including landscape phones), the frame, simulated status bar and introduction disappear so the app fills the mobile browser, including safe-area spacing. It uses Arial, NHS colours and a rounded primary button. Results and progress are announced to assistive technology, and errors allow a keyboard retry.

### Build and check

```sh
pnpm nx run-many -t build typecheck test
pnpm nx run infra:test:prod
pnpm nx run web:install-browser
pnpm nx run web:e2e
```

The API bundle is written to `dist/apps/api`; exported HTML, CSS and JavaScript are written to `apps/web/out`. Infrastructure tests use Pulumi mocks and do not contact AWS. Browser tests start and stop both local servers and include automated WCAG accessibility checks. Stop any existing local servers before running them.

### AWS setup and deployment

Install AWS CLI v2 and the [Pulumi CLI](https://www.pulumi.com/docs/install/) before deployment. Configure SSO using the instructions below, then sign in and verify the account:

```sh
pnpm nx run infra:login
pnpm nx run infra:identity
```

Create the Pulumi state bucket once:

```sh
pnpm nx run infra:bootstrap-state
```

This idempotent command creates `leeds-ai-week2-hackathon-322517362875-pulumi-state` and enables versioning, encryption, public-access blocking and a policy requiring HTTPS. It is a shared prerequisite outside the two application stacks.

The S3 backend uses a passphrase to encrypt Pulumi secrets, including the generated CloudFront origin secret. Choose a strong passphrase and make it available in your shell; keep it for subsequent preview, deployment and output commands:

```sh
export PULUMI_CONFIG_PASSPHRASE='replace-with-your-own-strong-passphrase'
pnpm nx run infra:preview:staging
pnpm nx run infra:deploy:staging
pnpm nx run infra:outputs:staging
```

The first preview/deploy initializes the selected stack if needed. Commit any encryption metadata Pulumi adds to `infra/Pulumi.staging.yaml` or `infra/Pulumi.prod.yaml`; keep the passphrase out of Git. Deploy commands build both applications and run Pulumi's preview and interactive confirmation. The `websiteUrl` and `apiUrl` outputs contain the CloudFront URLs.

Use the corresponding explicit commands for production:

```sh
pnpm nx run infra:preview:prod
pnpm nx run infra:deploy:prod
pnpm nx run infra:outputs:prod
```

CloudFront adds a different generated secret header for each stack; Lambda denies requests without it. The API Gateway address is publicly reachable, but direct requests without that secret receive `403`. The secret is never sent to the browser. API responses are not cached. Static HTML is revalidated; fingerprinted Next.js assets have long-lived caching. Lambda and API access logs have a 14-day retention period.

CloudFront serves S3 content using Origin Access Control. The application needs no database, VPC or user sign-in, and no CI/CD is configured.

### Let Pulumi manage application IAM roles

For this dedicated team hackathon account, an IAM Identity Center administrator can configure `HackathonBuilders` once and let Pulumi manage application roles thereafter:

1. Open **IAM Identity Center → Permission sets → HackathonBuilders** using an administrator session in the account where Identity Center is managed. Check the existing policies and any permissions boundary first.
2. Attach the AWS managed **PowerUserAccess** policy if equivalent service permissions are not already present. This is broad access to services across this dedicated account, including AI services, with most IAM administration excluded. It is a sandbox convenience rather than a production least-privilege policy.
3. Add the statements in [builder-role-management.json](infra/policies/builder-role-management.json) to the permission set's inline policy. Preserve any existing statements: a permission set has one inline policy, so merge rather than overwrite it. Alternatively, create a customer-managed IAM policy from the file in account `322517362875` and reference that policy in the permission set.
4. Provision/update the permission set for account `322517362875` and wait for completion. Use Identity Center rather than editing the generated `AWSReservedSSO_...` role directly. An existing permission-set boundary or organization policy can still limit the new grants.
5. Run `pnpm nx run infra:login`, then `pnpm nx run infra:preview:staging` and `pnpm nx run infra:deploy:staging`, keeping the existing stack and state bucket.

The added IAM policy allows role management only under `/leeds-ai-week2/`, requires the AWS managed `PowerUserAccess` permissions boundary when creating roles, prevents removing or replacing that boundary, and permits passing these roles to Lambda only. The initial roles are `leeds-random-staging-api` and `leeds-random-prod-api` under that path. Pulumi creates the role and its logging policy; no runtime role needs manual creation.

The boundary is a broad ceiling and does not grant the runtime role its permissions. This Lambda's actual policy still permits only writes to its own log group. Add specific AI API permissions to the relevant runtime role in Pulumi when needed. Interactive AI experiments from your terminal use the builder's permissions; AI calls from a Lambda use that Lambda's execution role. AI jobs that require another service role will need explicit additions to `iam:PassRole` and potentially the boundary. Some models also require account-level activation, marketplace access or service quota changes, separate from IAM invocation permissions.

References: [PowerUserAccess](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/PowerUserAccess.html), [permission sets](https://docs.aws.amazon.com/singlesignon/latest/userguide/permissionsetcustom.html), [permissions boundaries](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html).

## Leeds AI Week 2026

Leeds AI Week runs from **19–25 October 2026**. This student-led initiative brings together people from industry, academia and the AI community for events exploring AI in business, education, technology, the environment, engineering and healthcare.

The programme includes panel discussions, a seminar and an engineering showcase. Events are hosted at University of Leeds venues, and the programme page lists some sessions as free and open to all.

### AI in Healthcare Hackathon

The weekend programme is focused on AI in healthcare, including applications in patient care, drug discovery and diagnostics. The official Leeds AI Week page lists a full-day hackathon for **24–25 October**, but currently marks its time and venue as **TBA**.

An event listing describes the hackathon as an overnight, team-based event pairing healthcare students with technical students to work on clinical problems. It lists teams of four, mentoring, workshops and judging on creativity, technical sophistication, impact, and user experience. Confirm these details with the organisers, as the official programme has not yet published them.

- [Leeds AI Week programme](https://www.leedsaiweek.co.uk/2nd)
- [AI in Healthcare Hackathon listing](https://allai.events/event/ai-in-healthcare-hackathon--leeds-ai-society)

## AWS SSO setup

Install [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) and make sure you have SSO access to the hackathon AWS account.

### Configure your profile (once)

Run the configuration wizard:

```sh
pnpm nx run infra:sso-configure
```

Use these values when prompted (press Enter to accept a matching default):

| Setting | Value |
| --- | --- |
| SSO session name | `st-prod` |
| SSO start URL | `https://ssoins-7535ba8fae31f511.portal.eu-west-2.app.aws` |
| SSO region | `eu-west-2` |
| SSO registration scopes | `sso:account:access` |
| AWS account | `322517362875` |
| Role | `HackathonBuilders` |
| Default client Region | `eu-west-2` |
| CLI default output format | `json` |
| Profile name | `st-prod` |

This Nx target runs the AWS SSO wizard for profile `st-prod` with device authorization and automatic browser opening disabled. Open the printed URL in a browser, on another device if needed, and enter the current code. This avoids the `gio: ... Operation not supported` browser-opening error. Complete authorization, then return to the terminal and finish the wizard. The profile name is already supplied by the command. If only one account or role is available, it is selected automatically. If asked whether to configure AWS skills and the AWS MCP server, choose `n` for this setup.

### Sign in and verify access

After configuration, and whenever your SSO session expires, run:

```sh
pnpm nx run infra:login
```

The login target also uses device authorization without automatically opening a browser. Open the printed URL and enter the current code. Once login succeeds, verify your identity:

```sh
pnpm nx run infra:identity
```

Check that `Account` is `322517362875` and `Arn` contains `assumed-role/AWSReservedSSO_HackathonBuilders_`. The user-specific parts of the response will vary.

The Nx infrastructure commands select `st-prod` automatically and verify the account before bootstrap, preview or deployment. If you see `The config profile (nondev) could not be found` when running an older command, use the Nx targets above. If `st-prod` itself is missing, complete the configuration wizard first.

See the [AWS CLI SSO documentation](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html) for more details about profile configuration and device authorization.
