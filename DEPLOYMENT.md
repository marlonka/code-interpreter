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

Installed upstream release: `v1.10.4` (`a62d69e05a4541ac9a20722ac7ff3fcfecb6ed24`).

The local patch in `service/src/sandbox-egress.ts` enables the narrowly scoped
gateway channel for ordinary hardened executions. Release v1.10.4 grants the
file upload route but omits this manifest flag, causing generated artifacts to
be discarded with `artifact_delivery_failed`.

The guest entrypoint also defaults `SANDBOX_PIPE_ADDON` to the installed native
module. Docker build-stage environment variables do not survive the rootfs copy
into the KVM guest; without this default v1.10.4 passes health checks but every
execution fails before NsJail starts.

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
