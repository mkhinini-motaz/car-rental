# secrets/

Files mounted into containers as Docker secrets. Everything here except this file and the
`*.example.json` placeholder is gitignored.

- `fcm.json`: the Firebase service-account key carapi sends the morning push notifications with
  (`App\Support\Push`). Download it from the Firebase console (Project settings > Service accounts).
  `make init` copies the placeholder so the stack starts; carapi reads the key only when
  `env/api.env` sets `FCM_CREDENTIALS=/run/secrets/fcm_key`, so with the placeholder and that
  variable empty, pushes are only logged.
