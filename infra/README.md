# infra

Deployment of the car rental platform as files. A Docker Compose stack runs the two hosted repos
(`api`, `web`) plus Caddy the same way on a laptop and on the server; `terraform/` describes
the AWS side; GitHub Actions build the images and roll the server. The phone app (`mobile`) is not
hosted: release builds talk to `https://api.<domain>/api/`. The Compose layer has run; the AWS and
CI layers are validated but have never run against an account (see § Status).

In the monorepo this folder sits next to api/ and web/: `compose.local.yml` builds from `../api` and
`../web`.

Going to production needs a domain, an AWS account and the secrets listed below.

## Run locally

Needs Docker Desktop or OrbStack.

```
make init        # creates .env, env/*.env and the Firebase placeholder from their *.example files
make keys        # prints an APP_KEY and a JWT_SECRET; paste them into env/api.env
make up          # builds both images and starts everything (first build: a few minutes)
make seed        # migrate:fresh --seed; demo logins in api/README.md
make smoke       # logs in through Caddy and reads the dashboard
```

| URL | What |
|---|---|
| http://car.localhost | the web app (carweb) |
| http://api.car.localhost | carapi |

MySQL is also on `127.0.0.1:3307` for a GUI client (3307 because a Homebrew MySQL often holds
3306); credentials are in `env/mysql.env`.

Browsers resolve anything under `.localhost` to your machine with no setup. Command-line tools on
macOS don't: `curl --resolve api.car.localhost:80:127.0.0.1 http://api.car.localhost/up`.

`make check` validates both compose overlays, both Caddyfiles and the Terraform without
starting anything. Day to day: `make logs s=api`, `make artisan c="route:list"`, `make shell`, `make down`.
`make test` runs every repo's suite from the host (the phone app is not containerised);
`make test r=carapi` runs one. `make reset` deletes the local volumes. `make` alone lists every
target.

The local stack runs next to `php artisan serve` and `npm run dev` without clashing (ports 80,
443 and 3307 against 8000 and 3010), but it has its own MySQL database, not the SQLite file.

## What is where

```
compose.yml           the processes, shared by every environment
compose.local.yml     overlay: build from ../api and ../web, add MySQL, plain http
compose.prod.yml      overlay: pulled images, real TLS, logs to CloudWatch, a memory ceiling per container
caddy/                one Caddyfile per overlay; hostnames derive from DOMAIN in .env
ssh_config            ssh to the server through Session Manager (no port 22 is open)
bin/ssm-run           run a command on the server through SSM Run Command (the deploy workflow)
bin/smoke             login + dashboard through Caddy (make smoke)
bin/test-all          every repo's suite (make test)
env/*.env.example     per-service configuration templates (api, local mysql)
secrets/              the Firebase service-account key, mounted as a Docker secret
Makefile              the only interface you need, locally and on the server
terraform/            the AWS side: network, one instance, RDS MySQL, ECR, DNS, alarms, daily
                      disk snapshots, two GitHub OIDC roles; bootstrap/ creates the state bucket;
                      cloud-init.yaml is the server's first boot
```

The Dockerfiles live in the app repos, next to the code they build.

## How the pieces become processes

| Service | Image | Notes |
|---|---|---|
| `caddy` | `caddy:2` | routes by hostname; obtains certificates itself in production |
| `api` | `carapi` | nginx + php-fpm (serversideup/php 8.5 + gd); on start it waits for the database, migrates, caches config/routes/views. carapi trusts the proxy, so throttles key on the client's address, not Caddy's. Uploads up to 10 MB a file, 100 MB a request (12 handover photos of 8 MB). Files live on the `api_files` volume |
| `api-scheduler` | `carapi` | `schedule:work`: `alerts:daily` at 08:00 Tunis time, the morning push. No healthcheck |
| `web` | `carweb` | Next.js standalone server; the API URL is compiled in at build time |
| `mysql` | local only | on the server the database is RDS |

There is no Redis and no queue worker: carapi queues nothing, and its cache (JWT blacklist,
throttles) is the `database` store, which both api containers share.

## Deploy

Everything is files under `terraform/`. The manual steps are creating the AWS account, choosing and
registering the domain, pointing the registrar at Route 53, and typing secret values. On the
laptop: `brew install opentofu awscli`, `brew install --cask session-manager-plugin`, and
`aws configure` with a key that can administer the account.

**Once, the state bucket:**

```
cd terraform/bootstrap
tofu init && tofu apply -var bucket=carrental-terraform-state-<something unique>
```

**Once, the infrastructure:**

```
cd terraform
cp backend.hcl.example backend.hcl              # the bucket name from above
cp terraform.tfvars.example terraform.tfvars    # domain, email, your ssh public key, repos
tofu init -backend-config=backend.hcl
tofu apply                                      # about ten minutes, most of it RDS
```

Then set the domain's nameservers at the registrar to `tofu output name_servers`.

What that creates, in Paris (eu-west-3), about $35 to $40 a month:

| Resource | Why |
|---|---|
| VPC, two public and two private subnets, no NAT gateway | the instance has its own address; RDS never needs to reach out |
| one `t4g.small` instance (2 GB) on Ubuntu 24.04, Elastic IP, encrypted 30 GB disk, termination protection | runs the compose stack; cloud-init installs Docker, a 2 GB swap file and the CloudWatch agent. No port 22: ssh goes through Session Manager |
| a daily snapshot of that disk, seven kept | the server's hand-made state (`env/*.env`, `secrets/`, certificates) and **the `api_files` volume: car photos, handover photos and clients' papers, covered by this and by nothing else** |
| RDS MySQL 8.4 `db.t4g.micro`, private, encrypted, 7 days of backups, deletion protection | the one thing that holds state nothing can regenerate |
| two ECR repositories | where the images live; last ten kept |
| Route 53 zone with A records for the apex, www and api, and a CAA record | Caddy tells the hostnames apart; only Let's Encrypt may issue certificates |
| two IAM roles GitHub Actions can assume through OIDC | one pushes images from the app repos, one runs the deploy on the instance through SSM; no key stored in GitHub |

**First deploy:**

1. `make sync` copies the compose files to `/srv/carrental` on the server. Its `.env` was written
   by cloud-init and is never overwritten.
2. `make remote-shell`, then in `/srv/carrental`: `cp env/api.env.production.example env/api.env`
   and replace every `<...>` (DB endpoint and password from `tofu output`, a fresh `APP_KEY` and
   `JWT_SECRET` from `make keys` on the laptop). Put the Firebase key at `secrets/fcm.json`, or
   copy `secrets/fcm.example.json` there and empty `FCM_CREDENTIALS` to only log pushes.
3. Back on the laptop, `make release TAG=v1` builds the production images (`--no-dev`, the
   production API URL baked into the web app) and pushes them to ECR. The instance is arm64 like an
   Apple Silicon laptop, so the images run unchanged.
4. `make remote-deploy TAG=v1` points the server at that tag and runs `make deploy` there. Caddy
   obtains certificates on the first request once DNS resolves. The database starts empty: the
   api migrates it; create the first agency and owner by hand.

**Every release after that:** `make release TAG=v2 && make remote-deploy TAG=v2` from the laptop,
or with CI: `git tag v2 && git push --tags` in an app repo builds and pushes its image
(`.github/workflows/build.yml`), then Actions > Deploy in this repo with `v2`. The Deploy workflow
reaches the server through SSM Run Command (`bin/ssm-run`), rolls the image tag only, and first
compares `make prod-hash` on both sides: compose-file changes go with `make sync` from a laptop.
Both images are tagged together: tag both repos with the same version, or the server looks for a
tag one of them never pushed.

**Alerts.** With `alert_email` set: a Route 53 health check on `https://api.<domain>/up` and
CloudWatch alarms for instance status, CPU, memory, root disk, RDS free storage and RDS CPU, by
email through SNS (two confirmation emails to click, Paris and N. Virginia).

**Errors.** Every container's output goes to the `carrental` log group in CloudWatch Logs (30
days). Any line carapi logs at ERROR or above (an exception, an SMS or push the gateway refused)
trips the `api-errors` alarm, which emails within five minutes; `make errors [since=24h]` on the
laptop prints those lines with their stack traces.

`make remote-status` prints the containers on the server and the HTTP status of every hostname.

## Runbook

| Need | Do |
|---|---|
| Logs | `make errors` for carapi's errors; everything in CloudWatch > Log groups > `carrental`, or `make remote-shell`, `cd /srv/carrental`, `make logs s=api` (or `api-scheduler`, `web`, `caddy`) |
| Restart one thing | `docker compose restart api-scheduler` on the server |
| Roll back | `make remote-deploy TAG=<previous tag>` |
| Run artisan | `make artisan c="..."` on the server |
| Clear the cache | `make artisan c="cache:clear"`, knowing it un-revokes every logged-out token (the JWT blacklist lives in the cache) and resets the throttles |
| Rotate the DB password | `tofu apply -replace=random_password.db`, put the new `tofu output -raw db_password` in `env/api.env`, `docker compose up -d api api-scheduler` |
| Rebuild the server | take a manual RDS snapshot; set `instance_termination_protection = false`, `tofu apply`; `tofu apply -replace=aws_instance.app`; set it back; `make sync`; restore `env/*.env`, `secrets/` **and the `api_files` volume** from your copy or the latest daily snapshot; `make remote-deploy TAG=<current>`; `ssh-keygen -R <instance id>` |
| Grow the instance | change `instance_type` in `terraform.tfvars`, `tofu apply` (a stop/start, a minute of downtime) |

The server's `env/*.env` and `secrets/` are the only hand-made state on the box; keep a copy in a
password manager. **Tearing down:** set `db_deletion_protection = false`, `tofu apply`, then
`tofu destroy` (RDS keeps a final snapshot).

## Status

- **The local stack runs** (verified 26 Sept 2026 on Docker Desktop 29.8): both images build, the
  five containers come up, all migrations run on MySQL 8.4 (until then they had only ever run on
  SQLite), `make seed` completes, `make smoke` logs in through Caddy and reads the dashboard, the
  web app logs in and lists the fleet at http://car.localhost, a car photo uploads to the
  `api_files` volume and its signed link serves it (403 without the signature), and five wrong
  logins with a different forged `X-Forwarded-For` each are still throttled as one client.
- The production-shaped `--no-dev` api image was built once and caches config, routes and views
  and lists the schedule; CI will build that one.
- `terraform/` passes `tofu validate` (`make check`) and the three workflows (two `build.yml`, one
  `deploy.yml`) are written; **none has ever run against AWS or GitHub**. The first `tofu apply`
  and the first tagged build are their tests. What remains is filling in the real domain and secrets.
- The app-repo changes this depends on: a `Dockerfile`, `.dockerignore`, `build.yml` and
  `dependabot.yml` in carapi and carweb, `trustProxies(at: '*')` in carapi's `bootstrap/app.php`,
  and `output: 'standalone'` in carweb's `next.config.js`.
