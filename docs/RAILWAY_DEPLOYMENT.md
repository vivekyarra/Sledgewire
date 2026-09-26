# Railway single-service Arena deployment

This is the fastest supported PaaS path for Sledgewire when the platform cannot share one local volume across separate web and worker services.

The process model is still two Node processes:

- public MCP/HTTP server
- SharedNet Arena daemon

They are supervised inside one container and share the same persistent SQLite database. If either child exits unexpectedly, the supervisor terminates the other and exits non-zero so the platform can restart the complete seller.

For stronger process/container isolation on a Docker host, use `compose.arena.yml` instead.

## Why one service

Sledgewire's public server and Arena daemon must see the same durable `SLEDGEWIRE_DB` so payment state, cached replies and SharedOS traces remain consistent.

A single Railway service with one attached volume avoids cross-service SQLite sharing.

## Railway service settings

The repository now includes `railway.json` as config-as-code. It pins the Dockerfile build, `npm run arena:all` start command, `/ready` healthcheck, 120-second startup timeout, On Failure restart policy and 15-second drain window.

The platform steps that cannot be safely encoded in the repository are:

1. Create one Railway service from this GitHub repository.
2. Attach exactly one persistent volume at `/persistent`.
3. Generate a public Railway domain.
4. Keep the service at one replica. Railway volumes do not support replicas, and SQLite is intentionally single-writer here.
5. Set the required service variables/secrets below, including `RAILWAY_RUN_UID=0`.

Do not override the checked-in start command or healthcheck unless you also update and re-run the repository deployment tests.

Generate a public Railway domain before the final Arena rehearsal. `arena:all` automatically derives:

    PUBLIC_BASE_URL=https://$RAILWAY_PUBLIC_DOMAIN
    SLEDGEWIRE_DB=$RAILWAY_VOLUME_MOUNT_PATH/sledgewire.db

when those Sledgewire variables are not explicitly set.

## Required variables

Set these as service variables/secrets:

    SHAREDNET_ARENA_ROOM_ID=rom_...
    SHAREDNET_PAYEE_ADDRESS=pri_...
    SHAREDNET_MEMBER_TOKEN=sni_...
    SLEDGEWIRE_PRIVATE_KEY_PEM=<multiline Ed25519 private PEM>
    SLEDGEWIRE_PUBLIC_KEY_PEM=<multiline Ed25519 public PEM>

Railway mounts persistent volumes as root. Set:

    RAILWAY_RUN_UID=0

The `arena:all` launcher uses that root phase only to prepare/chown the database directory and hydrate root-readable file secrets if any are configured. It then drops supplementary groups and switches to:

    SLEDGEWIRE_RUNTIME_UID=1000
    SLEDGEWIRE_RUNTIME_GID=1000

before spawning the public server and Arena daemon. The runtime UID/GID variables are optional because 1000/1000 are the defaults for the official Node image.

The public child does not receive `SHAREDNET_MEMBER_TOKEN`, `SHAREDNET_PAYEE_ADDRESS`, or the invite token in its environment. This is defense in depth, not a hard container boundary; both processes still share one container.

## Signing keys

Generate the persistent pair once:

    npm run keygen -- .sledgewire/keys

Store the contents of the generated PEM files in Railway sealed/multiline variables:

    SLEDGEWIRE_PRIVATE_KEY_PEM
    SLEDGEWIRE_PUBLIC_KEY_PEM

Do not generate a new key on every deployment. The same key must survive restarts so cached receipts and restart-replay proof remain verifiable.

## First deployment verification

The deployment must not be considered Arena-ready until an unrelated network client can prove it. Run from outside Railway:

    npm run public:probe -- https://YOUR-RAILWAY-DOMAIN --arena

That no-secret probe verifies:

- `GET /health`
- fresh daemon-backed `GET /ready`
- `GET /arena.md`
- `GET /public-key`
- current 2026-07-28 MCP negotiation on `POST /mcp`
- a signed free `sledgewire.selfcheck`
- a signed 3-credit `PAYMENT_REQUIRED` route bound to a valid Arena Room

It never pays or executes paid work. `/ready` is intentionally stricter than `/health`: it becomes green only after the Arena daemon has authenticated to SharedNet and confirmed access to the configured Arena Room.

Then perform the real buyer path from a different SharedNet seat:

    npm run arena:rehearse

Preserve:

    .sledgewire/live-rehearsal.json

Restart the Railway service or otherwise restart the Arena daemon while preserving the same volume and signing key, wait for a changed daemon `boot_id`, then run:

    npm run arena:replay-after-restart

Preserve:

    .sledgewire/restart-replay.json

Finally run:

    npm run public:probe -- https://YOUR-RAILWAY-DOMAIN --arena
    npm run preflight -- --live

Do not replace the submission product link with the Railway `/arena.md` URL until both commands are green.

## Failure behavior

The all-in-one supervisor is fail-fast:

- public process dies -> daemon is terminated -> service exits non-zero
- daemon dies -> public process is terminated -> service exits non-zero
- SIGTERM/SIGINT -> both children receive the signal and the supervisor exits cleanly
- malformed runtime UID/GID or unwritable persistent storage -> startup fails closed
- symlinked database directory -> startup fails closed

This prevents a half-alive deployment from continuing to advertise a seller when one of its two required processes is gone.
