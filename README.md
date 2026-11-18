# CU Meetings

Staff meeting booking for Chandigarh University, Unnao Campus.

Staff sign in to book meetings with campus offices. Designated officers can call people in for an immediate meeting, and reception checks visitors in with a QR token.

## Requirements

- Node.js 20 or later
- PostgreSQL (Docker Desktop works for local development)

## Getting started

```bash
npm install
cp .env.example .env      # then fill in your own values
npm run db:up             # local database in Docker
npm run db:deploy         # apply migrations
npm run db:seed           # initial organization setup
npm run dev
```

Account details for the first sign-in are handed over separately by the project owner. Every account must set its own password at first sign-in.

## Tests

```bash
npm test
```

The tests create a temporary organization in the database, check the booking, approval, permission and immediate-meeting rules, then delete it.

## Configuration

All settings live in `.env`; `.env.example` lists every key. Never commit `.env` or share its values: it holds the database connection, the session secret, and the push and email keys.

## Production

Serve over HTTPS on your own domain, generate fresh secrets and keys for the server, and back up the database daily. The step-by-step checklist is in the internal guide.

## Documentation

The administrator guide (setup, roles and day-to-day use) is in `docs/` and is for the project team only.
