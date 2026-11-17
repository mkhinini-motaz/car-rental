# syntax=docker/dockerfile:1
# carapi as a container image: nginx + php-fpm from serversideup, PHP 8.5 with gd (composer.lock
# requires ext-gd; uploadFile() resizes photos with it) and exif (it turns camera photos upright)
# added, vendor/ installed inside the image. No .env is copied (.dockerignore):
# configuration is environment only, supplied by car-infra at run time. The same image runs the web
# server and the scheduler; only the command differs.
# An exact PHP version (24 Oct 2026): 8.5.12 fixes PHP2Shell (CVE-2026-109618 and -109619,
# unauthenticated remote code execution in every PHP up to 8.5.11). The floating 8.5 tag let a
# build reuse a cached older base without anybody choosing it. Dependabot opens a pull request for
# a newer one; bump deliberately.
FROM serversideup/php:8.5.12-fpm-nginx

USER root
RUN install-php-extensions gd exif
# Refuse to build on a PHP without the PHP2Shell fix, or with session upload progress on: serversideup
# v5.0.3 turned it off by default (PHP_SESSION_UPLOAD_PROGRESS_ENABLED) for CVE-2026-115560, which
# PHP has not fixed yet. carapi uses neither PHP sessions (SESSION_DRIVER=array) nor upload progress.
RUN php -r 'exit(version_compare(PHP_VERSION, "8.5.12", ">=") && !ini_get("session.upload_progress.enabled") ? 0 : 1);' \
    || { echo "PHP $(php -r 'echo PHP_VERSION;') is below 8.5.12 or has session.upload_progress on (PHP2Shell): pull a patched base"; exit 1; }
USER www-data

COPY --chown=www-data:www-data . /var/www/html

# Production images are --no-dev. car-infra's local overlay passes COMPOSER_FLAGS="" so the local
# image also carries the dev dependencies: the seeders use factories, and factories need Faker.
ARG COMPOSER_FLAGS="--no-dev"
RUN --mount=type=cache,target=/tmp/composer-cache,uid=33,gid=33 \
    COMPOSER_CACHE_DIR=/tmp/composer-cache \
    composer install ${COMPOSER_FLAGS} --no-interaction --prefer-dist --optimize-autoloader
