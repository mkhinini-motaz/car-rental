# The interface to the stack, local and server. `make` alone lists the targets.
.DEFAULT_GOAL := help
COMPOSE := docker compose

help:
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-14s %s\n", $$1, $$2}'

init: ## First run: create the gitignored live files from their *.example templates
	@cp -n .env.example .env 2>/dev/null || true
	@# Only env/api.env and env/mysql.env: api.env.production.example is filled in on the server.
	@cp -n env/api.env.example env/api.env 2>/dev/null || true
	@cp -n env/mysql.env.example env/mysql.env 2>/dev/null || true
	@cp -n secrets/fcm.example.json secrets/fcm.json 2>/dev/null || true
	@echo "Created .env, env/*.env and secrets/fcm.json where missing."
	@echo "Next: make keys, paste the values into env/api.env, then make up."

keys: ## Print a fresh APP_KEY and JWT_SECRET to paste into env/api.env
	$(COMPOSE) build api
	$(COMPOSE) run --rm --no-deps -e AUTORUN_ENABLED=false api php artisan key:generate --show
	$(COMPOSE) run --rm --no-deps -e AUTORUN_ENABLED=false api php artisan jwt:secret --show

up: ## Build what changed and start the stack
	$(COMPOSE) up -d --build --remove-orphans

down: ## Stop the stack; data volumes are kept
	$(COMPOSE) down

ps: ## Container status and health
	$(COMPOSE) ps

logs: ## Follow logs, all or one service: make logs s=api
	$(COMPOSE) logs -f $(s)

seed: ## Rebuild the local database with the demo agencies (demo logins: see api/README.md)
	$(COMPOSE) exec api php artisan migrate:fresh --seed

test: ## Run every repo's suite from the host: make test [r=carapi]
	@r="$(r)" bin/test-all

artisan: ## Run an artisan command in the api container: make artisan c="route:list"
	$(COMPOSE) exec api php artisan $(c)

shell: ## A shell inside the api container
	$(COMPOSE) exec api bash

smoke: ## Local: log in through Caddy as the seeded owner and read the dashboard (after make seed)
	@bin/smoke http://api.$(or $(DOMAIN),car.localhost)

check: ## Validate without running anything: both compose overlays, both Caddyfiles, terraform
	@test -f env/api.env || (echo "run make init first"; exit 1)
	COMPOSE_FILE=compose.yml:compose.local.yml $(COMPOSE) config -q
	COMPOSE_FILE=compose.yml:compose.prod.yml IMAGE_PREFIX=registry.example/carrental/ TAG=v0 DOMAIN=example.com $(COMPOSE) config -q
	@for f in caddy/Caddyfile.local caddy/Caddyfile.prod; do docker run --rm -e DOMAIN=example.com -e ACME_EMAIL=ops@example.com -v "$$PWD/$$f:/etc/caddy/Caddyfile:ro" caddy:2 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 && echo "$$f: valid" || { echo "$$f: INVALID"; exit 1; }; done
	cd terraform && tofu fmt -check -recursive && tofu init -backend=false -input=false >/dev/null && tofu validate
	@sh -n bin/ssm-run bin/smoke bin/test-all && echo "bin/*: sh syntax ok"

reset: ## Stop and delete every local volume (MySQL data, uploaded files, Caddy state)
	$(COMPOSE) down -v

deploy: ## Server: pull the images for TAG in .env and restart what changed
	$(COMPOSE) pull
	$(COMPOSE) up -d --remove-orphans

prod-hash: ## Fingerprint of the files the production stack runs from (the deploy workflow compares this checkout with the server)
	@cat compose.yml compose.prod.yml caddy/Caddyfile.prod Makefile | openssl dgst -sha256 -r | cut -c1-16

# ---- From the laptop, against the AWS server Terraform created (see README § Deploy) ----
# ssh goes through Session Manager (ssh_config): the instance has no open port 22. SERVER is the
# instance id, not an address.
TF      := cd terraform && tofu output -raw
SERVER  ?= $(shell $(TF) instance_id 2>/dev/null)
SSH     := ssh -F ssh_config
ECR     ?= $(shell $(TF) ecr_registry 2>/dev/null)
PREFIX  ?= $(shell $(TF) image_prefix 2>/dev/null)
PROD_DOMAIN ?= $(shell sed -n 's/^domain *= *"\(.*\)"/\1/p' terraform/terraform.tfvars 2>/dev/null)
REGION  ?= eu-west-3

sync: ## Copy the compose files to the server. Never touches its .env, env/*.env or secrets/
	rsync -az --delete -e "$(SSH)" --exclude .git --exclude terraform --exclude .env --exclude 'env/*.env' --exclude 'secrets/*' --exclude .DS_Store ./ $(SERVER):/srv/carrental/

release: ## Build production images here and push them to ECR (until CI does it): make release TAG=v1
	@test -n "$(TAG)" || (echo "usage: make release TAG=v1"; exit 1)
	@test -n "$(PROD_DOMAIN)" || (echo "domain not found in terraform/terraform.tfvars"; exit 1)
	aws ecr get-login-password --region $(REGION) | docker login --username AWS --password-stdin $(ECR)
	DOMAIN=$(PROD_DOMAIN) WEB_SCHEME=https COMPOSER_FLAGS=--no-dev IMAGE_PREFIX=$(PREFIX) TAG=$(TAG) $(COMPOSE) -f compose.yml -f compose.local.yml build api web
	IMAGE_PREFIX=$(PREFIX) TAG=$(TAG) $(COMPOSE) -f compose.yml push api web

remote-shell: ## Server: a shell on the server, through Session Manager
	$(SSH) $(SERVER)

remote-status: ## Server: container status, then every public endpoint's HTTP status
	$(SSH) $(SERVER) 'cd /srv/carrental && docker compose ps'
	@$(MAKE) -s probe

errors: ## Production: what carapi logged at ERROR or above, from CloudWatch Logs: make errors [since=24h]
	aws logs tail carrental --region $(REGION) --since $(or $(since),24h) --format short --filter-pattern '?".ERROR:" ?".CRITICAL:" ?".ALERT:" ?".EMERGENCY:"'

probe: ## HTTP status of every public hostname (needs no server access)
	@for h in api.$(PROD_DOMAIN)/up $(PROD_DOMAIN) www.$(PROD_DOMAIN); do printf "%-50s " "$$h"; curl -s -o /dev/null -w '%{http_code}\n' --max-time 10 "https://$$h"; done

remote-deploy: ## Point the server at TAG and run make deploy there: make remote-deploy TAG=v1
	@test -n "$(TAG)" || (echo "usage: make remote-deploy TAG=v1"; exit 1)
	$(SSH) $(SERVER) 'cd /srv/carrental && sed -i "s/^TAG=.*/TAG=$(TAG)/" .env && make deploy'
