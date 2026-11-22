# api: Car Rental API

REST API behind the car rental mobile app ([`../mobile`](../mobile)). It stores the agency's
cars, clients and rental contracts, follows each contract from booking to settlement
(pickup and return with odometer and photos, payments, deposit, extras, charges at
return, traffic fines), tracks what each car costs and what goes through the till, and
answers the questions the agency asks: which car is free between two dates and at what
price, what goes out and comes back today and where, which cars earn money, and how the
month went. Owners manage their staff; managers run the rentals, and every change to a
contract is logged with who made it.

- Laravel 13, PHP 8.3 or newer
- JWT authentication with [`tymon/jwt-auth`](https://github.com/tymondesigns/jwt-auth)
- SQLite by default (MySQL, MariaDB and PostgreSQL also work through `.env`)

## Getting started

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan jwt:secret            # writes JWT_SECRET to .env
touch database/database.sqlite
php artisan migrate --seed
php artisan serve                 # http://127.0.0.1:8000
```

The seeder builds demo data around today's date, so the app always has something
to show:

- **Demo Rent a Car**, owner login `+21623456109` / `azerty`, manager logins
  `+21650111222` (every branch) and `+21655667788` (the airport branch only: its three
  automatics and the car in no branch), both `azerty`. The staff list also has a manager
  invited two days ago (no password yet) and one who left (disabled), each with a history.
  9 cars in two branches, 31 clients (5 booked with only a name and phone, one blacklisted
  for an unpaid rental and back under a new phone with the same ID card, three flagged for
  damage, lateness or smoking; six with their ID card and licence photographed) and
  contracts covering the last two months and the next few weeks. Past contracts are closed
  and paid (mostly cash, some by card, transfer or cheque; a third have an invoice number),
  running ones are out with a deposit (cash for one in three, else a cheque) and half the
  rent paid, one car is overdue since yesterday, and the Symbol came back yesterday a day
  and a half late with a dented door: returned, charged for both, waiting to be settled,
  the car at the body shop. The last closed rental paid a broken mirror from its deposit.
  Future ones are reserved (the next two delivered at Monastir airport and a Sousse hotel,
  the first with the client's check-in done); one booking was cancelled; one car out has a
  second driver, and the Accent is blocked for the garage in three days. Handovers of the
  last five days have inspection photos, damage marks and the client's signature (the
  pictures are generated placeholders). Contracts carry a source (one in nine through a
  hotel taking 10 %) and now and then a child seat or a GPS. Two cars have insurance or
  circulation tax expiring within two weeks, and every car has its carte grise and
  insurance papers. Each car has an oil change, fuel and washing on record (the Peugeot 208
  is due another oil change). Five older rentals have a fine, one per way of settling it
  (owed, paid by the client, kept from the deposit, borne by the agency, paid out then
  repaid). The till has a float put in this month and a withdrawal yesterday. Invoices show
  19 % VAT and a 1 TND fiscal stamp. Pricing has a summer season, long-rental discounts,
  two extras, a free second driver, four delivery places (free except Tunis-Carthage), no
  kilometre charge and a day charged per day late after two hours.
- **Sousse Cars**, login `+21698765432` / `azerty`: 2 cars (one out of service), to check
  that one agency never sees another's data.

To start over: `php artisan migrate:fresh --seed`.

## Tests

```bash
php artisan test
```

Tests run on an in-memory SQLite database (see `phpunit.xml`) and build their own
data with factories and fake file storage. `ApiTest` covers login/logout, agency
scoping, search, parameter validation, the availability calculation and the seeder;
`CarApiTest`, `ClientApiTest`, `ContractApiTest`, `ContractLifecycleTest` and
`DashboardApiTest` cover the endpoints of the same names; `MoneyInsightTest` covers
pricing, extras, expenses, fines, the monthly report and file links;
`StaffPlanningCashTest` covers staff and roles, the activity log, client flags, the
planning and car blocks, return charges, the second driver and delivery places, and the
cash book.
GitHub Actions runs them on PHP 8.4 and 8.5 (`.github/workflows/api-ci.yml` at the repository root) on every push or pull request that touches `api/`.

## API

All endpoints are under `/api` and answer JSON. Every route except `login` needs
`Authorization: Bearer <token>` (401 otherwise). Everything is scoped to the user's
agency: another agency's car is a 404. `login` allows 5 attempts per minute.

| Method | Path | Description |
|---|---|---|
| POST | `/login` | Body: `phone`, `password`. Returns the user with an `access_token`. |
| POST | `/logout` | Invalidates the token. |
| GET | `/me` | The authenticated user. |
| PUT | `/me` | Every user: their own `first_name`, `last_name`, `phone`; a new `password` (8+) needs `current_password` (`user:password:wrong`). |
| GET | `/agency` | The user's agency: `name`, `phone`, `address`, `logo_url`, `takes_deposit` (off for new agencies), `default_deposit` and `default_deposit_method` (suggested at pickup), and the settings below. |
| GET | `/user` | Owner only. The agency's staff, disabled accounts included (`disabled`). |
| POST | `/user` | Owner only. `first_name`, `last_name`, `phone` (their login, unique), `password` (6+), `role` (1 owner, 2 manager). |
| PUT | `/user/{id}` | Owner only. Any of the same fields (an empty `password` keeps it) and `disabled`. An owner can't demote or disable themselves (`user:self` on `role`). |
| PUT | `/agency` | Update any of `name`, `phone` (`+216XXXXXXXX`), `address`, `takes_deposit`, `default_deposit`, `default_deposit_method`, `tax_id`, `contract_terms`, `pickup_time` and `return_time` (`HH:MM`, new reservations start and end then), `expiry_warning_days`, `oil_warning_km`, `oil_warning_days`, `fleet_max_years` (3 by default) and `employer_charges_rate` (hundredths of a percent). |
| POST | `/agency/logo` | Multipart `logo` (image, 4 MB max). |
| GET | `/agency/pricing` | The pricing rules: `seasons` (`name`, `from` and `to` as `dd/mm` every year, `percent` on the car's price, may be negative), `discounts` (`min_days`, `percent` off), `extras` (`name`, `price` in millimes, `per`: `rental` or `day`), `second_driver_price` (per day; 0, the default, is free), `locations` (frequent delivery places: `name`, `fee` per trip, 0 is free), `charge_extra_km` (off by default) with `km_per_day` and `extra_km_price`, `late_per` (`none`, `hour` at `late_hour_price`, or `day`: the rental's daily price per started day) after `late_grace_hours`. |
| PUT | `/agency/pricing` | Owner only. Replace `seasons`, `discounts` and `extras` (each may be empty); the other rules are kept unless sent. |
| GET | `/report` | Owner only. `year`, `month`. Revenue (rent spread over the days rented, extras in the month the rental starts, return charges in the month it came back; a kept deposit is not revenue again), `other_income`, `car_costs`, `instalments`, `overhead`, `payroll` and `employer_charges`, `expenses` (all costs) and `net`; `previous` (last month's revenue, net and utilization, for the ± deltas); `utilization_rate`; `kpis` (average daily rate, contracts started and cancelled, average length, late returns and hours, overdue now); payments received and `payments_by_method`; expenses by category, overhead by branch and per car, payroll by employee; the 12 months up to this one; per car days rented, idle and in maintenance, revenue and cost per km. Right now: `owed_contracts` (who owes rent, days late) and `unpaid_fines`, deposits held, `upcoming` (reservations and rent in the next 30 days), the month's `clients` by revenue with their badge and balance, and the fleet's money: `fleet` (cost, earned, payback, worst first), `sold_cars` (final result), `renewal` (by fleet deadline) and `capital_next_12_months` (expected sale prices). `export_url` downloads the month as CSV (figures first) for an hour, no token needed. |
| GET | `/expense` | Paginated expenses, newest first; filters `car_id`, `from`, `to`, `group` (`car` or `agency`). |
| POST | `/expense` | `category` (car: oil change, tyres, brakes, repair, fuel, insurance, tax, washing, other, technical visit, registration, instalment, accident, GPS, parking; agency: rent, electricity, water, internet, phone, accountant, bank fees, taxes and licences, marketing, software, office, CNSS, other), `amount`, `spent_at`, optional `car_id`, `contract_id` (a repair counted against that rental's client; sets the car), `branch_id`, `employee_id` (phone credit), `mileage`, `garage`, `note`, `method` (cash by default; only cash is in the till). Agency categories take no car (`expense:agency:no_car`); an instalment needs one (`expense:instalment:car`). |
| DELETE | `/expense/{id}` | Owner only. Remove an expense. |
| PUT | `/car/{id}/purchase` | Owner only. `purchase_price`, `bought_at`, `purchase_fees`, `supplier`, and a credit or leasing: `advance`, `instalment_amount` with `instalment_months`, `first_instalment_at`, `lender`; `expected_sale_price`. Each instalment paid is an expense (category instalment) on the car. |
| POST | `/car/{id}/sale` | Owner only. `sale_price`, `buyer_name`, optional `buyer_phone`, `sale_method`, `sold_at` (now). The car leaves the fleet list, the planning, the dashboard and booking (`car:sold`) but keeps its history; refused while a rental is booked or out (`car:sale:busy`). `DELETE` undoes it. `GET /car?sold=1` lists the sold cars. |
| GET/POST/DELETE | `/income` | Owner only. Money that isn't rent: `category` (insurance payout, reimbursement, parts sale, other), `amount`, optional `car_id`, `received_at`, `method`, `note`. |
| GET/POST/PUT/DELETE | `/branch` | Owner only. The agency's premises: `name`, `address`, `monthly_rent`. |
| GET/POST/PUT/DELETE | `/recurring-bill` | Owner only. `category` (agency costs), `amount`, `every_months`, `next_due_at`, optional `branch_id`, `note`. `POST /recurring-bill/{id}/pay` (`method`, optional `amount`) records the expense and moves the due date. |
| GET/POST/PUT | `/employee` | Owner only (managers get a 403). `first_name`, `last_name`, `phone`, `role_label`, `monthly_salary`, `hired_at`, `active`, `user_id`; the list has `paid_this_month` and `due_this_month`, one employee also `payments` and `year_total`. Staff accounts get one when created. `POST /employee/{id}/payment`: `type` (salary, advance, bonus), `amount`, `method`, optional `month` (`YYYY-MM`), `paid_at`, `note`; `DELETE /employee/{id}/payment/{paymentId}`. |
| GET | `/cashbook` | Owner only. `date` (`YYYY-MM-DD`), optional `user_id`: the day's cash `lines` (cash payments, cash deposits taken and given back, cash expenses, fines the client paid in cash (in), fines the agency paid the authority in cash (out), other income, car sales and salaries paid in cash, movements; each with who handled it), `cash_in`, `cash_out`, `opening` and `closing` balance (only without `user_id`), and `payments_by_method` for every payment of the day. |
| POST | `/cash-movement` | Owner only. `type` (1 put in the till, 2 owner withdrawal, 3 bank deposit), `amount`, optional `moved_at` (now), `note`. |
| DELETE | `/cash-movement/{id}` | Owner only. |
| GET | `/fine` | Paginated fines, unpaid first, each with its car and the matched contract and client; `status[]` filters. |
| POST | `/fine` | `car_id`, `committed_at`, `amount`, optional `reference` (PV number) and `note`. Finds the contract that had the car at that moment (from handover to return, or the booked times). |
| GET | `/fine/{id}` | One fine. |
| PUT | `/fine/{id}` | The client's side. `status`: unpaid, paid by the client (`method`: how they paid the agency, cash when left out; `null` when they paid the authority directly), taken from the deposit (only while the agency holds it and it covers the fine; `fine:deposit:unavailable` otherwise) or borne by the agency (records the payout with `paid_out_method`, cash by default, if not done yet). |
| POST | `/fine/{id}/payout` | The agency paid the authority: `method`. Independent of the client's side, so a fine the agency paid and the client repaid moves money twice (both in the cash book when in cash). |
| DELETE | `/fine/{id}/payout` | Undo the payout (`fine:payout:agency` while the agency bears the fine). |
| DELETE | `/fine/{id}` | Owner only. Remove a fine (not one taken from a deposit that is settled). |
| GET | `/dashboard` | The agency's movements over `starts_at`–`ends_at` (day bounds in the phone's time zone, at most 31 days): `pickups` (reserved to start in the range, or handed over in it) and `returns` (out and due back in the range, or returned in it), handled ones at their real time; when the range holds now, late pickups and overdue returns too. Also, right now: `cars_available` (not in maintenance, not out and not blocked), `cars_total`, `cars_out`, `overdue`, `expiring_cars` (papers expiring within the agency's `expiry_warning_days` or expired) and `maintenance_due` (oil changes within `oil_warning_km` / `oil_warning_days`). For the owner also `instalments_due` and `bills_due` (within a week), `salaries_due` (from the 25th) and `fleet_deadlines` (cars within six months of leaving the fleet). |
| GET | `/car` | Paginated cars, each with its rental out now (`contracts`) and a block covering now (`blocks`), for the fleet list's badge. See query parameters below. |
| GET | `/planning` | `starts_at`, `ends_at` (two months at most): every car with its `contracts` in the period (each with its client; a car still out after its end date is included) and its `blocks`. |
| POST | `/car` | Owner only. Add a car. All registration card fields are required: `daily_price`, `licence_plate` and `serial_number` (unique in the country, stored uppercase), `manufacturer`, `model_name`, `model_year`, `fiscal_horse_power`, `number_of_cylinders`, `transmission_type`, `fuel_type`, `type`, `first_circulation_date` (`dd/mm/yyyy`), `circulation_tax_ends_at`, `insurance_ends_at`, `technical_control_ends_at`. Optional: `colour` (`#rrggbb`, or the name of a colour the palette doesn't have), `status`, `mileage`, `oil_change_every_km` (10000) and `oil_change_every_months` (12). |
| GET | `/car/{id}` | One car with its contracts (newest first, each with its client), its expenses and incomes, `revenue` (rentals handed over), `expenses_total` (running costs: not instalments, with fines the agency bore), `profit`, and `oil_change` (`due_mileage`, `due_at`, `is_due`; null until one is recorded). For the owner also the purchase fields and `money` (`App\Support\CarMoney`: cost by group, interest, total cost, payback (earned / total cost), monthly earnings, financing with the next due date, fleet deadline and months left, final result, cost per km, this month's days rented, idle and in maintenance). |
| GET | `/car/{id}/quote` | `starts_at`, `ends_at`: the suggested `daily_price` from the pricing rules (each day at the car's price adjusted for its season, averaged, less the best duration discount, rounded to the dinar), with `seasons` and `discount_percent`. |
| PUT | `/car/{id}` | Owner only. Update a car (same fields as create). |
| POST | `/car/{id}/block` | Take the car off the planning: `starts_at`, `ends_at`, `reason` (1 maintenance, 2 personal use, 3 other), `note`. Refused with `contract:overlap` when a contract or another block is in the way; bookings and the availability search treat blocks like contracts. |
| DELETE | `/car/{id}/block/{blockId}` | Remove a block. |
| POST | `/car/{id}/photo` | Multipart `photo` (image, 8 MB max); replaces the previous one. |
| GET | `/client` | Paginated clients. `search` matches the name or the phone. |
| POST | `/client` | Create a client. Only `first_name`, `last_name` and `phone` (`+216XXXXXXXX`, unique in the agency) are required; `gender`, `birth_date` and `driver_licence_delivery_date` (`dd/mm/yyyy`), `id_number`, `driver_licence_number`, `flag` (blacklisted: 1 unpaid, 2 damage, 3 late returns, 4 other) and `notes` are optional. |
| GET | `/client/{id}` | One client with their contracts (newest first, each with its car), `warnings` (the flagged clients this person is, by the same record, phone, ID number or licence number: `matched_on`) and `stats` (`App\Support\ClientStats`: rentals, first and last, revenue, average value and length, paid, outstanding, unpaid fines, damage charged, repairs, deposits kept, late returns and hours, cancellations, no-shows, net, and the `badge`: new, good, watch or risk; a flag always makes it risk). Also returned by create and update (without `stats`). |
| PUT | `/client/{id}` | Update a client (same fields as create). |
| GET | `/contract` | Paginated contracts of the user's agency, with `car`, `client` and `paid`. `status[]` filters by status. |
| POST | `/contract` | Save a reservation: `client_id`, optional `second_driver_id`, `pickup_location` and `return_location` (null: the agency), `extras`, `note`, and `contracts`, a list of `{ car_id, starts_at, ends_at, daily_price? }` (price in millimes, defaults to the pricing quote). All are saved or none. |
| GET | `/contract/{id}` | One contract with its car, client, `second_driver`, `payments`, `paid`, `deposit_available`, inspection `photos` (each with a `url`) and `damages`, `charges`, and `activities` (who did what, newest first). |
| PUT | `/contract/{id}` | Change `starts_at`, `ends_at`, `daily_price`, `client_id`, `second_driver_id`, `pickup_location`, `return_location`, `note` or `extras` (the whole list of `{ name, price, per, kind? }`; `kind` marks the second driver's and the delivery fees the app manages) (any subset). Refused once closed. |
| DELETE | `/contract/{id}` | Owner only. Cancel a reservation. Only a reserved contract can be cancelled; it gets the `cancelled` status and is soft-deleted, so the car becomes free. |
| POST | `/contract/{id}/pickup` | Hand the car over (reserved → out). Multipart: optional `at` (when it happened, up to a week back: a handover saved on a phone without network and sent later), `mileage`, optional `deposit` (millimes) with `deposit_method`, `photos[i][angle]` and `photos[i][file]`, `damages[i][x\|y\|note]`. Refused with `client:incomplete` (on `client`) until the client's ID number, licence number and licence date are known, and (on `second_driver`) until the second driver's licence is. |
| GET | `/contract/{id}/charges` | `mileage`: what returning now would add (`km` over the allowance, `late` with its `unit`), and the `deposit_available`. |
| POST | `/contract/{id}/return` | Take the car back (out → returned). Same body without the deposit, plus `damages[i][amount]` (charged), `waived[]` (`km`, `late`) and `charges_from_deposit` (pays the charges out of the deposit held, as a payment with method 5); `mileage` can't be below the pickup reading. The charges are added to `total_price`. |
| POST | `/contract/{id}/close` | Settle (returned → closed): `deposit_kept` (millimes, at most the `deposit_available`; more than 0 is owner only) and `deposit_kept_reason` (required when something is kept). Sets `closed_at` and `deposit_returned`. Refused with `contract:unpaid` (on `payments`) while money is owed. |
| POST | `/contract/{id}/payment` | Record a payment: `amount` (millimes), `method` (5: from the deposit held, `payment:deposit:unavailable` beyond it), optional `paid_at`. Not on a closed contract. |
| DELETE | `/contract/{id}/payment/{paymentId}` | Owner only. Remove a payment entered by mistake. Not on a closed contract. |
| GET | `/up` | Health check (outside `/api`). There is no web page; `/` is a 404. |

More endpoints, described in their controllers and tests:

| Method | Path | Description |
|---|---|---|
| POST | `/signup/code`, `/signup` | A new agency signs itself up: a code by SMS proves the phone (hashed, 10 minutes, five guesses), then the agency and its first owner are created and logged in. |
| POST | `/otp/request`, `/password/reset` | A forgotten password: a code by SMS, then a new password. A new password logs out every other device. |
| POST | `/refresh` | A new token for the signed-in user. |
| POST | `/user/{id}/invite` | Owner only. Sends a staff member an invitation code by SMS. |
| GET | `/user/{id}/activity` | Owner only. What a staff member did, newest first. |
| POST/DELETE | `/device-token` | Register or forget a phone for push notifications (the 08:00 morning alerts, pickups and returns given to staff). |
| POST | `/contract/past` | A rental from the paper notebook in one step: no inspection, deposit or papers; closed if paid in full. |
| POST | `/contract/{id}/cleaned` | Ticks a returned car as cleaned. |
| POST | `/contract/{id}/pdf` | A signed link to the contract, invoice or receipt PDF (`GET /pdf/{kind}/{contract}`), in French or Arabic. |
| POST | `/contract/{id}/signature` | The client's signature on the contract. |
| POST | `/contract/{id}/checkin-link` | A signed link for the client's check-in page (valid until the rental ends, a month at most); `GET`/`POST /checkin/{contract}` serve it without a session until the car is handed over. |
| PUT | `/fine/{id}/client` | The client's side of a fine. |
| POST | `/car/{id}/damage`, `/car/{id}/damage/{damageId}/repair` | Damage already on a car, and marking it repaired. Open damage carries over to the next rental. |
| POST/DELETE | `/client/{id}/document`, `/car/{id}/document`, `/document/{id}` | Photos of a client's or a car's papers. |
| GET/POST | `/import`, `/import/template/{kind}` | Owner only. Cars, clients and rentals from spreadsheets: a dry run reports every fix, then one save. |

Query parameters for the list endpoints:

| Parameter | Default | Notes |
|---|---|---|
| `page`, `perPage` | `1`, `20` | `perPage` is at most 100. |
| `orderBy`, `orderDirection` | `created_at desc` (cars), `starts_at asc` (contracts) | Cars: `created_at`, `daily_price`, `manufacturer`, `model_name`, `model_year`, `licence_plate`. Contracts: `starts_at`, `ends_at`, `created_at`, `daily_price`. |
| `search` | none | Cars: manufacturer, model or plate. Contracts: the car fields or the client's name. |
| `starts_at`, `ends_at` | none | Unix timestamps, both or neither, `ends_at` after `starts_at`. On `/car`: keep cars that are at least partly free in the period, sort the freest first and add `availability_in_period` (a list of `[start, end]` free slots). On `/contract`: keep contracts that overlap the period. |

Users are owners or managers (`role`). Owner-only endpoints answer 403 to a manager:
staff (`/user`), the agency's details, logo and pricing, adding and editing cars, reports,
the cash book, cancelling a reservation, removing a payment, an expense or a fine, and
keeping part of a deposit at close. A disabled account can't log in and its token stops
working.

Invalid parameters get a 422 with Laravel's `errors` object. A contract that would overlap
another contract of the same car is refused with the message `contract:overlap` (on
`contracts.N` for `POST`, on `ends_at` for `PUT`); back-to-back contracts are fine. The
check runs in a transaction that locks the car row, so two simultaneous bookings can't
both succeed. An action that doesn't fit the contract's status (returning a car that
was never handed over, paying on a closed contract) is refused with `contract:status`
on `status`. List responses look like this:

```json
{ "data": [ ... ], "total": 42, "lastPage": 3, "currentPage": 1 }
```

Single resources, `/me` included, are wrapped in `{ "data": { ... } }`.

### Data conventions

- Dates and times are Unix timestamps in seconds, including `created_at` and `updated_at`.
- Prices are integers in millimes: `70000` is 70 TND.
- `transmission_type`, `fuel_type`, `type`, `gender`, `role` and every `status`,
  `method`, `stage` and `angle` are integers. Their values are constants on the models
  (`Car::STATUS_MAINTENANCE`, `Contract::STATUS_OUT`, `Payment::METHOD_CHEQUE`,
  `ContractPhoto::ANGLE_DASHBOARD`, ...).
- A contract is `reserved` → `out` (handed over) → `returned` → `closed` (settled), or
  `cancelled`. Its `rent_price` is the daily price times the booked days, part days
  included; `extras_price` adds the extras (per rental, or per day); `charges_price` the
  charges at return; `total_price` is all three; `paid` is the sum of its payments. The
  deposit is not a payment: it lives on the contract (`deposit`, `deposit_method`,
  `deposit_kept`, `deposit_kept_reason`, `deposit_returned`); fines and payments taken from
  it reduce `deposit_available`. Fines are not part of `total_price`.
- Months, days and seasons are counted in Tunisia's time (`Agency::TIMEZONE`).
- Damage positions (`x`, `y`) are thousandths of the car outline's width and height,
  from the top left, with the front of the car at the top.

### Files

Uploads (car photos, logos, inspection photos) are stored on the default disk, which is
private (`storage/app/private`). Resources give a permanent signed link (`photo_url`,
`logo_url`, `url`, served by `GET /api/file/{path}`); the app loads it without a token.
A file never changes (a new photo gets a new name), so the link is stable and sent with
`Cache-Control: immutable`, and phones keep the photos. A changed or made-up link gets a
403. No `storage:link` is needed. Moving to S3-compatible storage means serving these
links from the bucket (S3 pre-signed URLs expire after at most a week, so a proxy or a
public-read bucket with unguessable names would keep them permanent). In production, `upload_max_filesize` and
`post_max_size` must allow a pickup with a dozen photos (about 1 MB each after the app
resizes them).

## Configuration

Besides the standard Laravel settings in `.env`:

| Variable | Default | Meaning |
|---|---|---|
| `JWT_SECRET` | none | Signing key. Generate it with `php artisan jwt:secret`. |
| `JWT_TTL` | `43200` (30 days) | Token lifetime in minutes. Tokens cannot be made never-expiring: jwt-auth 2.3 turns `null` into 0. |

## Project layout

```
app/Http/Controllers/     Auth, Agency, Dashboard, Report, Car, Client, Contract, Expense, Fine and File controllers
app/Http/Requests/        CarRequest, ClientRequest (validation of the forms)
app/Http/Resources/       JSON shapes; ResourceCollection builds the paginated envelope
app/Models/               Agency, User, Car, Client, Contract, Payment, ContractPhoto, ContractDamage, Expense, Fine
app/Support/Pricing.php   The agency's pricing rules and the price quote
app/Repositories/         Query building for the list endpoints
app/Support/Helpers.php   Namespaced helpers (occursInPeriod, fieldsLike, fileUrl, ...)
app/Support/DoesntConvertDates.php  Keeps timestamps as raw integers
database/                 Migrations, factories and seeders
routes/api.php            All API routes
```
