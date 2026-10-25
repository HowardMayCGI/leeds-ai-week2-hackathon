# AI help in Schedule my medicines

The app uses AI in four places, plus interaction warnings that use rules rather than AI. In every case AI only fills in answers or explains what the app already decided. The deterministic scheduler still chooses every time, its independent checker still verifies every schedule, and the patient confirms anything that changes their answers.

| Feature                                    | Where in the app                        | What AI does                                                                                                                                       | What the app checks                                                                                                                                                                                                                                                             |
| ------------------------------------------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add a medicine from a photo or description | Add a medicine or supplement            | Reads the name, strength, form, amount, how often, food timing and any instructions from a photo of the box or label, or from the patient's words. | The name is matched against the medicines list by the app's own search, not by AI. Only form fields are filled; anything not read is listed for the patient. A range such as "1 or 2 tablets" is left for the patient. The usual timing and same-ingredient checks still apply. |
| Describe your usual day                    | First routine page                      | Reads wake, meal and sleep times, or that a meal is skipped, from the patient's words.                                                             | Times are filled into the usual questions on this page and the next, for the patient to check. Anything not read is listed. The Questionnaire's own validation still applies.                                                                                                   |
| Explain my schedule                        | Proposed and saved schedule             | Writes a short "Why at this time" under each dose.                                                                                                 | It only gets the facts the scheduler used: the routine, each dose and the NHS-sourced reason for each rule. Any explanation with a number not in its facts, a link, markup or a safety claim is dropped. Shown with a "Written by AI" tag.                                      |
| Ask about your schedule                    | Saved schedule, then **Ask a question** | Answers one question at a time from the saved schedule.                                                                                            | Emergencies and requests for medical advice get fixed NHS wording before any model sees them, in English, Polish and Urdu. Answers must cite the facts they use, which are listed under "Based on", and pass the same checks as explanations.                                   |
| Interaction warnings (rules, not AI)       | Proposed and saved schedule             | None.                                                                                                                                              | `POST /api/interactions` checks the schedule's medicines against the API's interaction rules. "No match" is never shown as safe. When the rules say to keep two medicines apart and the schedule does, the app says so; otherwise it warns.                                     |

If AI is off, slow or returns anything that fails a check, the app shows its own wording and the patient fills in the form as before. Nothing else in the journey depends on AI.

## Data and safety

- **What is sent to the model.** A photo, resized in the browser to at most 1280 pixels and sent as a JPEG, or the patient's description; the description of their day; and, for explanations and questions, short English facts built from the schedule (times, medicine names and rule reasons). The app never sends the patient's name, NHS number or date of birth. A pharmacy label in a photo may show the patient's name, so the model is told never to copy personal details into its answer.
- **What is kept.** The API stores nothing. It logs only the task, the mode, the outcome and how long it took, never the patient's words, photo or schedule. Questions and explanations stay in the app until the page is closed or a new schedule is saved.
- **Where it runs.** When `OPENAI_API_KEY` is set, the API calls OpenAI's Responses API (`gpt-6-luna` unless `OPENAI_MODEL` says otherwise) with `store: false`. OpenAI does not train on API data by default, but may keep requests for up to 30 days for abuse monitoring and may process them outside the UK. The key stays on the server: in the gitignored root `.env` locally, and in encrypted Pulumi stack config for the Lambda. Otherwise the deployed API calls Claude Haiku 5.5 through Claude in Amazon Bedrock (the `bedrock-mantle` endpoint) from `eu-west-2`, inside the team's AWS account. The default endpoint can route requests to other regions. London has no single-region option for Claude, so for EU-only processing choose an EU inference profile in the Bedrock console and set it with `pulumi config set aiModelId <id>`.
- **Structured answers.** Every request asks for JSON that matches a schema, and the API validates the result again before using it.
- **Checks on every answer** (`apps/api/src/ai/guards.ts`). Numbers must come from the facts (times are compared in 12 and 24-hour forms, and Urdu digits are read too). Links, markup and claims that medicines are safe together are rejected. Answers that fail are not shown.
- **Fixed wording for risky questions.** Mentions of chest pain, overdose, self-harm, breathing problems and similar get the 999, A&E and 111 message. Questions about missed doses, side effects, alcohol, pregnancy, driving or changing a dose get "speak to a pharmacist or your GP". A false match only points the patient to help.
- **Labelled.** AI text carries a "Written by AI" tag. Explanations and answers that are only available in English say so in Polish and Urdu.
- **Limits.** Requests are size-limited per route, API Gateway throttling applies, and each live call has 24 seconds in total, including one retry.

## Running it

**Test mode** is the default locally and needs no AWS access:

```sh
pnpm nx run-many -t dev -p web api
```

Answers come from built-in rules in `apps/api/src/ai/stand-in.ts`, in English only. Every photo reads as the same pharmacy label (ferrous sulfate 325mg), and descriptions are read with simple patterns. The web page beside the phone says which mode is running.

**Live mode with OpenAI** needs `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) in the root `.env`, then the same command. With a key, AI uses OpenAI unless `AI_PROVIDER` says otherwise, so run the browser tests with `AI_PROVIDER=test`.

**Live mode with Claude** calls Bedrock with your SSO session:

```sh
pnpm nx run infra:login
AI_PROVIDER=bedrock AWS_PROFILE=st-prod AWS_REGION=eu-west-2 pnpm nx run-many -t dev -p web api
```

`AI_MODEL_ID` changes the model (default `anthropic.claude-haiku-5-5`). `AI_PROVIDER=off` hides every AI feature.

## Deploying

When the stack has an `openaiApiKey` secret (`pulumi config set --secret openaiApiKey <key> --stack <stack>`), the Lambda uses OpenAI and nothing below is needed apart from the timeout. Otherwise it uses Claude on Bedrock. The infrastructure change needs the team's approval:

- The Lambda role gets one new inline policy allowing `bedrock-mantle:CreateInference`. It is within the existing `PowerUserAccess` boundary, so the builder role policy does not change.
- The Lambda has 512 MB of memory and a 29-second timeout (was 128 MB and 5 seconds), so a photo can be read within API Gateway's 30-second limit.
- The Lambda gets `AI_PROVIDER=bedrock` and `AI_MODEL_ID=anthropic.claude-haiku-5-5`. Override them with `pulumi config set aiProvider off` or `pulumi config set aiModelId <id>`.

Before deploying, enable Claude Haiku 5.5 in [Amazon Bedrock model access](https://console.aws.amazon.com/bedrock/home#/modelaccess) for account `322517362875` in `eu-west-2`. Claude Haiku 5.5 is not open to every account, so check the criteria shown there. If access is not ready in time, use Claude Sonnet 5, which every Bedrock account can use: `pulumi config set aiModelId anthropic.claude-sonnet-5`, or `AI_MODEL_ID=anthropic.claude-sonnet-5` locally.

## Code

| Where                                | What                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `apps/api/src/ai/`                   | The AI service: Claude engine, test stand-ins, prompts and JSON schemas, validation and answer checks. |
| `apps/api/src/handler.ts`            | `GET /api/ai/status`, `POST /api/ai/{medicine,routine,explain,ask}` and `POST /api/interactions`.      |
| `packages/api-contract/src/index.ts` | Request and response types, limits and runtime checks shared by the web app and API.                   |
| `packages/medicines/src/reading.ts`  | Turns a medicine reading into form answers, matching it against the medicines list.                    |
| `apps/web/src/medicines/facts.ts`    | Builds the facts that explanations and answers may use from a schedule.                                |
| `apps/web/src/medicines/components/` | `Readers.tsx`, `Explain.tsx`, `AskScreen.tsx` and `Interactions.tsx`.                                  |
| `apps/web/e2e/ai-features.spec.ts`   | Browser tests for every feature in test mode, including failures, AI off and accessibility checks.     |
