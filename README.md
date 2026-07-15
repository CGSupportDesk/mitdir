# MitDir

MitDir is a full-stack coordination platform for trusted, non-clinical everyday assistance for older adults in Germany.

## Included

- Public landing page and four-step support request journey
- Secure email/password authentication with signed HTTP-only sessions
- Role-based workspaces for administrators, operations, families, seniors, support partners and care homes
- Operations modules for requests, bookings, live journeys, seniors, partners, users, organisations, payments, expenses, incidents, consent, services, audit and notifications
- Administrator invitations, account suspension and assisted password resets
- Support-partner availability and assignment views
- Family, senior and care-home scoped records
- Neon Postgres schema, repeatable migration and demo seed scripts
- Vercel serverless APIs, security audit trail and public request rate limiting
- Responsive mobile navigation and accessible form controls

## Run locally

```bash
npm install
npm run db:setup
npx vercel dev
```

## Validate

```bash
npm run lint
npm run typecheck:api
npm run build
npm run smoke
```

Copy `.env.example` to `.env.local` and provide the listed secrets before running the database or API commands. Payment and expense modules manage operational records; connecting a payment processor or transactional email provider requires provider-specific credentials.
