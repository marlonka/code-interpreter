const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');

const envPath = path.resolve(__dirname, '..', '.env');
const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

function valueOf(text, key) {
  const match = text.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match?.[1]?.trim() ?? '';
}

function setValue(text, key, value, preserveExisting = false) {
  if (preserveExisting && valueOf(text, key)) {
    return text;
  }

  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  return pattern.test(text)
    ? text.replace(pattern, line)
    : `${text.replace(/\s*$/, '\n')}${line}\n`;
}

const secret = () => randomBytes(32).toString('base64url');
const accessKey = () => `codeapi-${randomBytes(12).toString('hex')}`;

const fixed = {
  LOCAL_MODE: 'false',
  CODEAPI_HARDENED_SANDBOX_MODE: 'true',
  KVM_ENABLED: 'true',
  CODEAPI_SANDBOX_BACKEND: 'http',
  CODEAPI_RUNTIME_SESSION_MODE: 'stateless',
  CODEAPI_EXECUTION_PROFILE: 'default',
  CODEAPI_BRIDGE_AUTH_MODE: 'static',
  CODEAPI_BRIDGE_DYNAMIC_WORKERS: 'false',
  CODEAPI_BRIDGE_TOKEN: '',
  CODEAPI_TENANT_ISOLATION_STRICT: 'true',
  CODEAPI_MINIO_BUCKET: 'codeapi-files',
  PYTHON_CONCURRENCY: '1',
  OTHER_CONCURRENCY: '2',
  SANDBOX_MAX_CONCURRENT_JOBS: '2',
  LAUNCHER_VCPUS: '2',
  LAUNCHER_RAM_MIB: '2048',
  SANDBOX_RUN_MEMORY_LIMIT: '536870912',
  SANDBOX_RUN_CPU_TIME: '180000',
  SANDBOX_RUN_TIMEOUT: '300000',
  SANDBOX_OUTPUT_MAX_SIZE: '65536',
  MAX_FILE_SIZE: '26214400',
};

const generated = {
  CODEAPI_INTERNAL_SERVICE_TOKEN: secret,
  CODEAPI_EGRESS_GRANT_SECRET: secret,
  CODEAPI_REDIS_PASSWORD: secret,
  CODEAPI_MINIO_ACCESS_KEY: accessKey,
  CODEAPI_MINIO_SECRET_KEY: secret,
};

let next = Object.entries(fixed).reduce(
  (text, [key, value]) => setValue(text, key, value),
  current,
);

next = Object.entries(generated).reduce(
  (text, [key, create]) => setValue(text, key, create(), true),
  next,
);

fs.writeFileSync(envPath, next);
console.log(`Hardened environment configured: ${envPath}`);
