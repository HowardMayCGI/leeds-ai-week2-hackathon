# leeds-ai-week2-hackathon
Leeds AI Week2 Hackathon repository

## Leeds AI Week 2026

Leeds AI Week runs from **19–25 October 2026**. This student-led initiative brings together people from industry, academia and the AI community for events exploring AI in business, education, technology, the environment, engineering and healthcare.

The programme includes panel discussions, a seminar and an engineering showcase. Events are hosted at University of Leeds venues, and the programme page lists some sessions as free and open to all.

### AI in Healthcare Hackathon

The weekend programme is focused on AI in healthcare, including applications in patient care, drug discovery and diagnostics. The official Leeds AI Week page lists a full-day hackathon for **24–25 October**, but currently marks its time and venue as **TBA**.

An event listing describes the hackathon as an overnight, team-based event pairing healthcare students with technical students to work on clinical problems. It lists teams of four, mentoring, workshops and judging on creativity, technical sophistication, impact, and user experience. Confirm these details with the organisers, as the official programme has not yet published them.

- [Leeds AI Week programme](https://www.leedsaiweek.co.uk/2nd)
- [AI in Healthcare Hackathon listing](https://allai.events/event/ai-in-healthcare-hackathon--leeds-ai-society)

## AWS SSO setup

Install [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) and make sure you have SSO access to the hackathon AWS account. Check your installation with `aws --version`.

### Configure your profile (once)

Run the configuration wizard:

```sh
aws configure sso
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

The wizard opens a browser for sign-in before asking for the account, role and profile settings. Complete the browser authorization, then return to the terminal. If only one account or role is available, it is selected automatically. If asked whether to configure AWS skills and the AWS MCP server, choose `n` for this setup.

If the browser cannot open, for example with `gio: ... Operation not supported`, rerun the wizard using device authorization:

```sh
aws configure sso --use-device-code
```

Open the URL printed by the CLI in a browser, on another device if needed, and enter the code from that command. Wait for authorization to complete, then finish the wizard.

### Sign in and verify access

After configuration, and whenever your SSO session expires, run:

```sh
aws sso login --profile st-prod
```

If the browser cannot open or you are working in a remote terminal, use:

```sh
aws sso login --profile st-prod --use-device-code
```

Open the printed URL and enter the current code. Once login succeeds, verify your identity:

```sh
aws sts get-caller-identity --profile st-prod
```

Check that `Account` is `322517362875` and `Arn` contains `assumed-role/AWSReservedSSO_HackathonBuilders_`. The user-specific parts of the response will vary.

Use `--profile st-prod` with subsequent AWS commands. If you see `The config profile (nondev) could not be found`, use `st-prod`, the profile created above. If `st-prod` itself is missing, complete the configuration wizard first.

See the [AWS CLI SSO documentation](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html) for more details about profile configuration and device authorization.
