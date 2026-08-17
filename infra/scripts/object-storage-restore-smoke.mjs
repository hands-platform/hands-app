import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const runId = `${process.pid}-${Date.now()}`;
const prefix = `hands-storage-restore-${runId}`;
const networkName = `${prefix}-network`;
const sourceContainer = `${prefix}-source`;
const restoredContainer = `${prefix}-restored`;
const sourceVolume = `${prefix}-source-data`;
const restoredVolume = `${prefix}-restored-data`;
const backupVolume = `${prefix}-backup`;
const serverImage = process.env.MINIO_SERVER_IMAGE?.trim() || 'minio/minio:latest';
const clientImage = process.env.MINIO_CLIENT_IMAGE?.trim() || 'minio/mc:latest';
const accessKey = 'handsrestore';
const secretKey = `hands-restore-${runId}-secret`;
const fixtures = [
  {
    bucket: 'hands-private',
    key: `private/recovery/${runId}/finance-evidence.txt`,
    content: Buffer.from(`private-finance-evidence:${runId}`, 'utf8'),
  },
  {
    bucket: 'hands-public',
    key: `public/recovery/${runId}/profile-media.txt`,
    content: Buffer.from(`public-profile-media:${runId}`, 'utf8'),
  },
];

assertLocalDockerEngine();
assertDisposableNames();

try {
  docker(['network', 'create', networkName]);
  docker(['volume', 'create', sourceVolume]);
  docker(['volume', 'create', restoredVolume]);
  docker(['volume', 'create', backupVolume]);

  startMinio(sourceContainer, sourceVolume);
  await waitForMinio('source', sourceContainer);

  for (const fixture of fixtures) {
    mc(['mb', '--ignore-existing', `source/${fixture.bucket}`]);
    mc(['pipe', `source/${fixture.bucket}/${fixture.key}`], { input: fixture.content });
    assertObjectBytes('source', fixture);
    mc(['mirror', '--overwrite', `source/${fixture.bucket}`, `/backup/${fixture.bucket}`], {
      backupMounted: true,
    });
  }

  docker(['rm', '-f', sourceContainer]);
  docker(['volume', 'rm', sourceVolume]);

  startMinio(restoredContainer, restoredVolume);
  await waitForMinio('restored', restoredContainer);

  for (const fixture of fixtures) {
    mc(['mb', '--ignore-existing', `restored/${fixture.bucket}`]);
    mc(['mirror', '--overwrite', `/backup/${fixture.bucket}`, `restored/${fixture.bucket}`], {
      backupMounted: true,
    });
    assertObjectBytes('restored', fixture);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: {
          disposableDockerTarget: true,
          sourceRemovedBeforeRestore: true,
          bucketsRestored: fixtures.map((fixture) => fixture.bucket),
          objectsRestored: fixtures.map((fixture) => ({
            bucket: fixture.bucket,
            key: fixture.key,
            sha256: sha256(fixture.content),
            sizeBytes: fixture.content.length,
          })),
        },
      },
      null,
      2,
    ),
  );
} finally {
  removeDockerResource(['rm', '-f', sourceContainer, restoredContainer]);
  removeDockerResource(['volume', 'rm', '-f', sourceVolume, restoredVolume, backupVolume]);
  removeDockerResource(['network', 'rm', networkName]);
}

function startMinio(containerName, volumeName) {
  docker([
    'run',
    '-d',
    '--name',
    containerName,
    '--network',
    networkName,
    '-e',
    `MINIO_ROOT_USER=${accessKey}`,
    '-e',
    `MINIO_ROOT_PASSWORD=${secretKey}`,
    '-v',
    `${volumeName}:/data`,
    serverImage,
    'server',
    '/data',
  ]);
}

async function waitForMinio(alias, containerName) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const containerState = dockerOutput(['inspect', '--format', '{{.State.Status}}', containerName]);
    if (containerState === 'exited' || containerState === 'dead') {
      throw new Error(`${containerName} exited before object storage became ready.`);
    }
    const result = runMc(['ready', alias]);
    if (result.status === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${containerName} did not become ready.`);
}

function assertObjectBytes(alias, fixture) {
  const result = runMc(['cat', `${alias}/${fixture.bucket}/${fixture.key}`]);
  if (result.status !== 0) {
    throw new Error(`Could not read ${alias}/${fixture.bucket}/${fixture.key}: ${stderrText(result)}`);
  }
  const actual = Buffer.from(result.stdout);
  if (!actual.equals(fixture.content)) {
    throw new Error(
      `Object checksum mismatch for ${alias}/${fixture.bucket}/${fixture.key}: ` +
        `expected ${fixture.content.length} bytes (${sha256(fixture.content)}), ` +
        `received ${actual.length} bytes (${sha256(actual)}).`,
    );
  }
}

function mc(args, options = {}) {
  const result = runMc(args, options);
  if (result.status !== 0) {
    throw new Error(`MinIO client command failed (${args.join(' ')}): ${stderrText(result)}`);
  }
  return result;
}

function runMc(args, { backupMounted = false, input } = {}) {
  return spawnSync(
    'docker',
    [
      'run',
      '--rm',
      ...(input ? ['-i'] : []),
      '--network',
      networkName,
      '-e',
      `MC_HOST_source=http://${accessKey}:${secretKey}@${sourceContainer}:9000`,
      '-e',
      `MC_HOST_restored=http://${accessKey}:${secretKey}@${restoredContainer}:9000`,
      ...(backupMounted ? ['-v', `${backupVolume}:/backup`] : []),
      clientImage,
      ...args,
    ],
    {
      encoding: null,
      input,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    },
  );
}

function docker(args) {
  try {
    return execFileSync('docker', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }).trim();
  } catch (error) {
    throw new Error(
      `Docker command failed (${args.join(' ')}): ${String(error?.stderr ?? error?.message ?? error).trim()}`,
    );
  }
}

function dockerOutput(args) {
  return docker(args).trim().toLowerCase();
}

function removeDockerResource(args) {
  spawnSync('docker', args, {
    encoding: 'utf8',
    stdio: 'ignore',
    windowsHide: true,
  });
}

function assertLocalDockerEngine() {
  const dockerHost = dockerOutput(['context', 'inspect', '--format', '{{(index .Endpoints "docker").Host}}']);
  const localEngine =
    dockerHost.startsWith('npipe://') ||
    dockerHost.startsWith('unix://') ||
    /^tcp:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/u.test(dockerHost);
  if (!localEngine) {
    throw new Error(`Object storage restore smoke refuses non-local Docker engine ${dockerHost}.`);
  }
}

function assertDisposableNames() {
  const resources = [
    networkName,
    sourceContainer,
    restoredContainer,
    sourceVolume,
    restoredVolume,
    backupVolume,
  ];
  if (!resources.every((name) => /^hands-storage-restore-\d+-\d+-[a-z-]+$/u.test(name))) {
    throw new Error('Object storage restore smoke generated an unsafe disposable resource name.');
  }
}

function stderrText(result) {
  return Buffer.from(result.stderr ?? '')
    .toString('utf8')
    .trim();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
