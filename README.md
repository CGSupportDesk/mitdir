# MitDir

MitDir is a responsive web prototype for coordinating trusted, non-clinical everyday assistance for older adults in Germany.

## Included

- Public landing page with services, care journey, safety, process and FAQ sections
- Four-step support booking flow
- Family dashboard with booking status, support partner and journey milestones
- Responsive mobile navigation and accessible form controls
- Vercel SPA routing configuration

## Run locally

```bash
npm install
npm run dev
```

## Validate

```bash
npm run lint
npm run build
```

The prototype stores submitted booking data in the browser's local storage. It does not yet connect to a production database, payment service or dispatch backend.
