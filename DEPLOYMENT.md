# LibreChat CodeAPI deployment

Production-style local deployment for the LibreChat checkout at
`C:\Users\Marlon\Desktop\libreman\LibreChat`.

## Security model

-   Ed25519 JWTs minted by LibreChat; no shared browser-facing API key.
-   Strict tenant identity with the single-tenant namespace `legacy`.
-   libkrun/KVM microVMs with a read-only guest root filesystem.
-   No CodeAPI host ports. LibreChat reaches only `codeapi-api` through the
    external `librechat-code` network.
-   Redis, MinIO, file server, workers, and tool server stay on the internal
    `codeapi-private` network.
-   The sandbox and policy-enforcing egress gateway share one dedicated bridge.
    Its static address avoids passing Docker's host-only DNS stub into the VM.
-   Random internal, Redis, MinIO, egress, JWT, and execution-manifest secrets.
-   Stateless sessions and bounded CPU, memory, time, output, and concurrency.

Installed upstream release: `v1.10.13` (`2fa9f0d43e8e38b7d6240bc76e2483c6a47c64c7`).

The local patch in `service/src/sandbox-egress.ts` enables the narrowly scoped
gateway channel for ordinary hardened executions. Release v1.10.4 grants the
file upload route but omits this manifest flag, causing generated artifacts to
be discarded with `artifact_delivery_failed`. The local patch remains required on v1.10.13.

Release v1.10.5 supplies the guest entrypoint default for `SANDBOX_PIPE_ADDON`.

The KVM runner uses the official v1.10.13 image, pinned by commit and digest in
`compose.hardened.yml`. Service images retain the local artifact-egress fix.
The packaged runtimes are Python 3.14.4, Node.js 24.22.1, and Bun 1.4.4.
Redis is pinned to 7.4.12 on the existing persistent volume.

MinIO uses its final tagged upstream release, `RELEASE.2025-10-15T17-29-55Z`.
The upstream image registry no longer permits public pulls. `docker/minio.Dockerfile`
builds checksum-verified source from commit `9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a`
with Go 1.27.2 and pinned base-image digests, preserving the existing S3 data volume.
The previous image and volume archives are retained with the LibreChat upgrade backups.

## Operations

Run commands from this directory.

```powershell
$files = @('-f', 'docker-compose.yaml', '-f', 'compose.hardened.yml')
docker compose -p codeapi @files config --quiet
docker compose -p codeapi @files up -d --build
docker compose -p codeapi @files ps
```

Health and logs:

```powershell
docker exec LibreChat node -e "fetch('http://codeapi-api:3112/v1/health').then(async r=>console.log(r.status,await r.text()))"
docker compose -p codeapi -f docker-compose.yaml -f compose.hardened.yml logs --since 15m
```

Stop without deleting data:

```powershell
docker compose -p codeapi -f docker-compose.yaml -f compose.hardened.yml stop
```

Do not use `down -v`: the `codeapi_minio_data` and `codeapi_codeapi_redis` volumes
contain generated files and queue/session metadata.

## Update

1. Back up `.env` in both repositories and the two named volumes.
2. Fetch upstream tags and review the latest stable release against the pinned revision.
3. Rebase the local hardening onto that release tag; keep the artifact-egress patch until it
   lands upstream.
4. Rebuild, run the unit regression, then test authenticated execution plus
   generated-file download before serving users.

```powershell
docker build -f service/Dockerfile --target development -t codeapi-service-test .
docker run --rm --mount "type=bind,source=${PWD}/service/src,target=/app/src,readonly" codeapi-service-test bun test src/egress-grant.test.ts
```

Keep tracked shell scripts, Python templates, and patch files in LF format on Windows. Docker executes
the shell scripts directly and applies the NsJail patch during the runner build.
The plotting-code injector matches LF-delimited markers in the Python templates.

## Feature policy

Enabled: `execute_code`, manual `runCode`, generated artifacts.

Deliberately disabled pending separate threat-model and load validation:
stateful sessions, programmatic tools, and background execution.
