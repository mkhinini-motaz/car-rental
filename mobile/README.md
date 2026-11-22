# mobile: Car Rental agency app

Mobile app (iOS and Android) for the staff of a car rental agency. It replaces the
paper notebook: manage the fleet and its documents, check which cars are free for a
period and at what price, book them, hand them over and take them back with photos and
the odometer, record payments, extras, the deposit and traffic fines, keep each car's
maintenance and costs, and see how the month went. It talks to the API in
[`../api`](../api).

- React Native 0.87 (New Architecture), React 19, TypeScript
- React Navigation 7 (bottom tabs + native stack)
- TanStack Query 5 for server data, axios for HTTP
- NativeWind 4 (Tailwind CSS 3 classes) for styling
- Five languages: English, French, Tunisian (Latin and Arabic script), Arabic, with right-to-left layout for the Arabic ones

## Requirements

- Node.js 22.13+ or 24 LTS. React Native 0.87 refuses Node 25 at install time.
- Yarn 1 (`npm install -g yarn`, or prefix commands with `npx yarn@1`). The lockfile is `yarn.lock`.
- iOS: Xcode 26 and CocoaPods.
- Android: JDK 17 and the Android SDK (platform 36/37, build-tools 37, NDK 27.1).

## Getting started

```bash
yarn install
cd ios && pod install && cd ..

yarn start        # Metro bundler, keep it running
yarn ios          # in a second terminal
yarn android
```

Debug builds expect the API from `php artisan serve` in `../api`:
`http://127.0.0.1:8000/api/` on iOS, `http://10.0.2.2:8000/api/` on the Android
emulator (the emulator's alias for your machine). On a physical Android device, run
`adb reverse tcp:8000 tcp:8000` and use `127.0.0.1` in `src/constants/index.ts`.
Release builds use `PRODUCTION_API_URL` there, which is a placeholder until the API
is deployed.

Seeded login: phone `+21623456109`, password `azerty` (the login form is pre-filled
with them for now). The app stays logged in until the token expires (30 days) or you
log out.

## Scripts

| Command | What it does |
|---|---|
| `yarn start` | Metro bundler |
| `yarn ios` / `yarn android` | Build and run on a simulator or device |
| `yarn test` | Jest: renders the app logged out and logged in, checks the API client's 401 handling, multipart encoding and the dinar/millime conversion |
| `yarn lint` | ESLint (0 errors; CI fails on errors) |
| `yarn add-translation` | Prompts for a key and its text in all five languages, then writes the JSON files in `src/i18n/` |

## What the app does today

| Screen | Status |
|---|---|
| Login | Works against the API; the session is restored on start. "Forgot password" calls OTP endpoints that do not exist yet. |
| Today (tab) | Four tiles (cars at the agency, cars out, due back today, overdue), a day strip (yesterday, today, tomorrow, next 7 days), then Going out and Coming back in time order: time, plate in large type, model and colour, client with a call button, the delivery place, rent still owed and a status badge (late, due now, booked, handed over; overdue, later, back), with Pick up or Return one tap away. Oil changes and papers due are listed below; the owner also sees what to pay (credit instalments and recurring bills due within a week, salaries still due from the 25th: one tap, then cash or transfer) and cars within six months of leaving the fleet. The tab shows how many movements are still to do today. |
| Cars (tab) | The fleet as compact rows (plate, model, daily price) with where each car is now (available, out until a date, back today, overdue, maintenance, blocked). A car's page: details and papers (soon-to-expire dates in orange or red), oil change, add an expense; for the owner, edit, purchase and credit, other income, sell (refused while a rental is booked or out; undo), what it cost (price, fees, interest, running costs by group), how much of its total cost its rentals earned back (a bar and a percentage), its credit (instalments paid, left, next due), this month's days rented, idle and at the garage, cost per km, and when it must leave the fleet (first registration plus the agency's years). Then its expenses, incomes and rentals. |
| Clients (tab) | Search by name or phone, add a client (name and phone are enough), open a client to see their details, their numbers (rentals, revenue, average rental, balance, unpaid fines, damage, repairs, late returns, cancellations and no-shows, net) and a badge (reliable, watch, risk), and their rental history; edit them. Flag a client (unpaid, damage, late returns, other) with notes; wherever a flagged person is picked again, even under another phone with the same ID card or licence, a red warning shows, and the badge and balance show when booking. |
| Planning (tab) | One row per car, one column per day (week or month): contracts as bars coloured by status (overdue in red), blocked days in dark grey. Tap a bar to open the contract or unblock; tap an empty day to book that car from the agency's usual pickup time or block it (garage, personal use). |
| Create reservation | Pick a start and end (the agency's usual pickup and return times by default); the free cars show with their free stretches (a car not back from its last rental comes last, with a warning), tap one or several; each gets the price the agency's rules suggest (season, long-rental discount, with the reason shown), which staff can change; choose or create the client (with their badge and balance), a second driver, where the car is handed over and returned (the agency, one of its frequent delivery places in one tap, free unless the agency prices it, or an address; the return place follows the pickup place until changed), extras and a note, and save. The API refuses a car that was booked meanwhile. |
| Contract | Opened from Today, the planning, a car or a client. Shows its status. Change the dates, add a day, change the price, client, second driver, delivery places or note, add extras from the agency's list; cancel a reservation (owner); hand the car over or take it back; record payments (also from the deposit held) or remove them (owner); settle the deposit (keeping part of it: owner) and close it; record a repair caused by this rental (it counts against the client). The inspection photos and damage from pickup and return are shown side by side; tap one to see both full size. The history at the bottom lists who did what. |
| Hand over / take back | Odometer, deposit and how it was given (pickup, only for agencies that take one; prefilled with the usual amount), photos from six fixed angles plus close-ups, and damage marked by tapping a car outline. Blocks the pickup until the client's ID and licence are filled in, with a shortcut to the client form. At return, each pickup photo sits next to the new one, pickup damage is greyed on the outline and listed, each new damage can be priced, and the charges (kilometres over the allowance, lateness) are computed as the odometer is typed; staff can waive one and take the total from the deposit or add it to what the client owes. The second driver's licence is required too. Without network (car parks, airports), the handover is kept on the phone with its photos and real time, shows as waiting on Today and on the contract, and is sent when the network is back. |
| Rented cars | Cars out right now, grouped as overdue, due back today and later, with the client's phone (tap to call) and the rent still owed. Pull to refresh. |
| Fines | Traffic fines, unpaid first. A new fine (plate, date and time, amount, PV number) is matched to the rental that had the car; then record its two sides: the agency paying it at the recette, and the client paying (the agency back in cash, card, transfer or cheque, or the authority directly), taken from the deposit or borne by the agency. Cash both ways goes in the cash book. |
| Cash book | Owner only. A day of the till: opening and closing balance, cash in and out (payments, deposits taken and given back, expenses, fines, other income, car sales and salaries paid in cash, owner withdrawals and bank deposits), payments by method, and who handled each line; filter by staff member. |
| Reports | Owner only, in four tabs. Month: revenue, net and utilization with the change since last month; in and out (revenue, other income, car costs, instalments, agency costs, salaries and charges, net, payments by method); the year chart; counts (average price per day, rentals started and cancelled, average length, late returns, overdue now, booked for the next 30 days); agency costs by category and branch and per car; payroll by employee; the month's expenses and a spreadsheet export. Fleet: days rented, idle and at the garage and cost per km per car; each car's payback; renewal (cars by the date they must be sold, with the capital coming back within a year); sold cars and what they finally returned. Clients: by revenue with badge and balance, or only those owing. Owed: who owes rent (days late) and unpaid fines. |
| More (tab) | The agency, then new reservation, cars out, fines; for the owner cash book, reports, payroll, recurring bills and sold cars; settings and logging out. |
| Settings | Grouped like the phone's settings. Everyone: name and phone, password (with the current one), language (remembered across restarts), logging out, app version. Owners also get the agency (details, logo, tax ID, usual pickup and return times, deposit, years a car stays in the fleet, employer charges, contract terms), pricing (seasons, long-rental discounts, extras, second driver and delivery places (free by default), lateness at return, and kilometres only if switched on), branches and their rent, recurring bills, staff (add, edit, disable, owner or manager), payroll (employees with or without a login, salary, advances and bonuses in cash or by bank, what is still due) and reminders (how early papers and oil changes are flagged). |
| Also | Sign up (a new agency, with a code sent by SMS) and a new password from a code; import of cars, clients and rentals from spreadsheets (owner); a rental from the paper notebook in one step; damage already on a car, and marking it repaired; photos of a car's or a client's papers; the client check-in link and the contract, invoice and receipt PDFs from the contract page. |

## Project layout

```
index.js                 App entry, imports global.css (Tailwind)
src/App.tsx              Providers: gesture handler root, React Query, Store
src/navigation/          Root (login vs home), bottom tabs, stacks
src/screens/             One file per screen
src/components/          ui/ (the kit: Screen, Card, ListRow, Badge, Button, Stat, ...), Form/ (inputs), car/, client/, contract/, fine/, common/ (TranslatableText, LangAwareView, ...)
src/api/                 client.ts (axios: base URL, token, 401 → login) + one module per API resource
src/classes/             TypeScript types and enum constants mirroring the API models
src/store/               React Context: language, authenticated user, session restore
src/support/             Formatting (dates, money), alerts, auth token storage, photo picking
src/i18n/                Translation JSON files and translate()
ios/, android/           Native projects (bundle id com.example.carrental / com.car)
```

## Continuous integration

`.github/workflows/mobile-ci.yml` at the repository root runs `yarn lint`, `yarn test`,
`npx tsc --noEmit` and a release Metro bundle for iOS and Android on every push or pull request
that touches `mobile/`.
