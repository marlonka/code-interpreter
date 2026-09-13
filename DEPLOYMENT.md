# LibreChat CodeAPI deployment

Production-style local deployment for the LibreChat checkout at
`C:\Users\Marlon\Desktop\libreman\LibreChat`.

## Security model

- Ed25519 JWTs minted by LibreChat; no shared browser-facing API key.
- Strict tenant identity with the single-tenant namespace `legacy`.
- libkrun/KVM microVMs with a read-only guest root filesystem.
- No CodeAPI host ports. LibreChat reaches only `codeapi-api` through the
  external `librechat-code` network.
- Redis, MinIO, file server, workers, and tool server stay on the internal
  `codeapi-private` network.
- The sandbox and policy-enforcing egress gateway share one dedicated bridge.
  Its static address avoids passing Docker's host-only DNS stub into the VM.
- Random internal, Redis, MinIO, egress, JWT, and execution-manifest secrets.
- Stateless sessions and bounded CPU, memory, time, output, and concurrency.

Installed upstream revision: `8764d019ecb4a503d6be34d8b8234f031b1f77e5`.

The local patch in `service/src/sandbox-egress.ts` enables the narrowly scoped
gateway socket for ordinary hardened executions. Current upstream grants the
file upload route but omits this manifest flag, causing generated artifacts to
be discarded with `artifact_delivery_failed`.

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

Do not use `down -v`: the `codeapi_minio` and `codeapi_codeapi_redis` volumes
contain generated files and queue/session metadata.

## Update

1. Back up `.env` in both repositories and the two named volumes.
2. Fetch upstream and review changes against the pinned revision.
3. Rebase the local hardening commit; keep the artifact-egress patch until it
   lands upstream.
4. Rebuild, run the unit regression, then test authenticated execution plus
   generated-file download before serving users.

```powershell
docker build -f service/Dockerfile --target development -t codeapi-service-test .
docker run --rm codeapi-service-test bun test src/egress-grant.test.ts
```

## Feature policy

Enabled: `execute_code`, manual `runCode`, generated artifacts.

Deliberately disabled pending separate threat-model and load validation:
stateful sessions, programmatic tools, and background execution.
