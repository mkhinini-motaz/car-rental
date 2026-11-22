# web

Web version of the car rental staff app: today's movements, planning, cars (with their
purchase, credit, sale and profitability), clients (with their track record), reservations,
contracts (pickup and return with photos and damage), rented cars, fines, cash book, reports,
payroll, recurring bills and settings, in the five languages of the phone app.

```bash
cp .env.example .env.local   # optional: the default already points at 127.0.0.1:8000
npm install
npm run dev                  # http://localhost:3010
```

Needs the API running (`cd ../api && php artisan serve`). Demo logins are in `../api/README.md`.
