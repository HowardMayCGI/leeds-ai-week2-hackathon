When making UI changes to App folow NHS App design system guidance here https://design-system.nhsapp.service.nhs.uk/
This is a proof of concept and does not need to be a complete product
The deployed architecture will be a Static UI and an API backend.
This will use AWS Cloudfront, API Gateway and Lambdas - new infrastructure needs approval.
Before committing or pushing, run `pnpm test` (typecheck, build/bundle, unit and infra tests for every project) and make sure it passes. Run `pnpm test:e2e` too when UI behaviour changes.
