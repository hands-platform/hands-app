import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createConnection, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  ProviderStatus,
  Role,
} from '@prisma/client';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const runId = `${process.pid}-${Date.now()}`;
const prefix = `hands-database-restore-${runId}`;
const sourceContainer = `${prefix}-source`;
const restoredContainer = `${prefix}-restored`;
const databaseName = `hands_restore_${process.pid}_${Date.now()}`;
const hostPort = Number.parseInt(process.env.DATABASE_RESTORE_SMOKE_PORT ?? '55446', 10);
const postgresImage = process.env.POSTGRES_RESTORE_IMAGE?.trim() || 'postgis/postgis:16-3.4';
const databaseUrl = `postgresql://massage:massage@127.0.0.1:${hostPort}/${databaseName}?schema=public`;
const tempDirectory = mkdtempSync(join(tmpdir(), 'hands-database-restore-'));
const backupPath = join(tempDirectory, `${databaseName}.dump`);
const probe = {
  customerProfileId: `${prefix}-customer-profile`,
  customerUserId: `${prefix}-customer-user`,
  providerProfileId: `${prefix}-partner-profile`,
  providerUserId: `${prefix}-partner-user`,
  bookingId: `${prefix}-booking`,
  paymentId: `${prefix}-payment`,
};

assertLocalDockerEngine();
assertDisposableNames();
assertCondition(Number.isInteger(hostPort) && hostPort > 0 && hostPort < 65536, 'Invalid restore smoke port.');

try {
  await assertPortIsFree(hostPort);
  startPostgres(sourceContainer);
  await waitForPostgres(sourceContainer);
  await waitForHostPort(hostPort);
  await waitForPrismaConnection();
  runPrisma(['migrate', 'deploy']);
  await seedProbe();

  docker([
    'exec',
    sourceContainer,
    'pg_dump',
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--username=massage',
    '--dbname',
    databaseName,
    '--file=/tmp/hands-restore.dump',
  ]);
  docker(['cp', `${sourceContainer}:/tmp/hands-restore.dump`, backupPath]);
  const backup = readFileSync(backupPath);
  assertCondition(backup.length > 0, 'Disposable PostgreSQL backup is empty.');
  const backupSha256 = sha256(backup);

  docker(['rm', '-f', sourceContainer]);
  await assertPortIsFree(hostPort);
  startPostgres(restoredContainer);
  await waitForPostgres(restoredContainer);
  await waitForHostPort(hostPort);
  await waitForPrismaConnection();
  docker(['cp', backupPath, `${restoredContainer}:/tmp/hands-restore.dump`]);
  docker([
    'exec',
    restoredContainer,
    'pg_restore',
    '--clean',
    '--if-exists',
    '--exit-on-error',
    '--no-owner',
    '--no-privileges',
    '--username=massage',
    '--dbname',
    databaseName,
    '/tmp/hands-restore.dump',
  ]);

  runPrisma(['validate']);
  runPrisma(['migrate', 'status']);
  const restored = await readRestoredProbe();
  const postgresVersion = docker([
    'exec',
    restoredContainer,
    'psql',
    '--username=massage',
    '--dbname',
    databaseName,
    '--tuples-only',
    '--no-align',
    '--command=SHOW server_version;',
  ]).trim();
  const postgisVersion = docker([
    'exec',
    restoredContainer,
    'psql',
    '--username=massage',
    '--dbname',
    databaseName,
    '--tuples-only',
    '--no-align',
    '--command=SELECT PostGIS_Version();',
  ]).trim();

  console.log(JSON.stringify({
    ok: true,
    checks: {
      disposableDockerTarget: true,
      sourceRemovedBeforeRestore: true,
      backup: {
        sha256: backupSha256,
        sizeBytes: statSync(backupPath).size,
      },
      database: {
        name: databaseName,
        postgresVersion,
        postgisVersion,
      },
      prismaMigrationStatus: 'up-to-date',
      restoredProbe: restored,
    },
  }, null, 2));
} finally {
  removeDockerResource(['rm', '-f', sourceContainer, restoredContainer]);
  rmSync(tempDirectory, { force: true, recursive: true });
}

function startPostgres(containerName) {
  docker([
    'run',
    '-d',
    '--name',
    containerName,
    '-e',
    'POSTGRES_USER=massage',
    '-e',
    'POSTGRES_PASSWORD=massage',
    '-e',
    `POSTGRES_DB=${databaseName}`,
    '-p',
    `127.0.0.1:${hostPort}:5432`,
    postgresImage,
  ]);
}

async function waitForPostgres(containerName) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const state = dockerOutput(['inspect', '--format', '{{.State.Status}}', containerName]);
    if (state === 'exited' || state === 'dead') {
      throw new Error(`${containerName} exited before PostgreSQL became ready.`);
    }
    const result = spawnSync(
      'docker',
      ['exec', containerName, 'pg_isready', '--username=massage', '--dbname', databaseName],
      { encoding: 'utf8', stdio: 'ignore', windowsHide: true },
    );
    if (result.status === 0) return;
    await delay(500);
  }
  throw new Error(`${containerName} did not become ready.`);
}

async function seedProbe() {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await prisma.user.createMany({
      data: [
        {
          id: probe.customerUserId,
          phone: `+84981${String(Date.now()).slice(-6)}01`,
          fullName: 'Restore Drill Customer',
          roles: [Role.CUSTOMER],
        },
        {
          id: probe.providerUserId,
          phone: `+84981${String(Date.now()).slice(-6)}02`,
          fullName: 'Restore Drill Partner',
          roles: [Role.PROVIDER],
        },
      ],
    });
    await prisma.customerProfile.create({
      data: { id: probe.customerProfileId, userId: probe.customerUserId },
    });
    await prisma.providerProfile.create({
      data: {
        id: probe.providerProfileId,
        userId: probe.providerUserId,
        displayName: 'Restore Drill Partner',
        status: ProviderStatus.OFFLINE,
      },
    });
    await prisma.booking.create({
      data: {
        id: probe.bookingId,
        customerProfileId: probe.customerProfileId,
        selectedProviderId: probe.providerProfileId,
        status: BookingStatus.COMPLETED,
        scheduledStartAt: new Date('2026-08-18T02:00:00.000Z'),
        scheduledEndAt: new Date('2026-08-18T03:00:00.000Z'),
        address: { addressText: 'Disposable restore drill' },
        lat: 10.7769,
        lng: 106.7009,
        metadata: { restoreDrill: true, runId },
      },
    });
    await prisma.payment.create({
      data: {
        id: probe.paymentId,
        bookingId: probe.bookingId,
        method: PaymentMethod.CASH,
        status: PaymentStatus.CAPTURED,
        amount: 300000,
        providerRef: `${prefix}-cash-receipt`,
        rawMeta: { restoreDrill: true, runId },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function readRestoredProbe() {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: probe.paymentId },
      include: {
        booking: {
          include: { customerProfile: true, selectedProvider: true },
        },
      },
    });
    assertCondition(payment?.status === PaymentStatus.CAPTURED, 'Restored payment probe is missing.');
    assertCondition(payment.amount === 300000, 'Restored payment amount changed.');
    assertCondition(payment.booking.status === BookingStatus.COMPLETED, 'Restored booking status changed.');
    assertCondition(
      payment.booking.customerProfile.id === probe.customerProfileId &&
        payment.booking.selectedProvider?.id === probe.providerProfileId,
      'Restored booking ownership links changed.',
    );
    return {
      bookingId: payment.bookingId,
      bookingStatus: payment.booking.status,
      customerProfileId: payment.booking.customerProfile.id,
      partnerProfileId: payment.booking.selectedProvider?.id,
      paymentId: payment.id,
      paymentMethod: payment.method,
      paymentStatus: payment.status,
      amount: payment.amount,
    };
  } finally {
    await prisma.$disconnect();
  }
}

function runPrisma(args) {
  const windows = process.platform === 'win32';
  const result = spawnSync(
    windows ? 'cmd.exe' : 'npm',
    windows
      ? ['/d', '/s', '/c', `npm.cmd exec --workspace @massage-vn/api -- prisma ${args.join(' ')}`]
      : ['exec', '--workspace', '@massage-vn/api', '--', 'prisma', ...args],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: databaseUrl },
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Prisma ${args.join(' ')} failed: ` +
        `${result.error?.message || [stderrText(result), result.stdout].filter(Boolean).join('\n')}`,
    );
  }
}

function docker(args) {
  try {
    return execFileSync('docker', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }).trim();
  } catch (error) {
    const stdout = String(error?.stdout ?? '').trim();
    const stderr = String(error?.stderr ?? '').trim();
    throw new Error(
      `Docker command failed (${args.join(' ')}), status ${error?.status ?? 'unknown'}: ` +
        `${stderr || stdout || error?.message || String(error)}`,
    );
  }
}

function dockerOutput(args) {
  return docker(args).trim().toLowerCase();
}

function removeDockerResource(args) {
  spawnSync('docker', args, { encoding: 'utf8', stdio: 'ignore', windowsHide: true });
}

function assertLocalDockerEngine() {
  const dockerHost = dockerOutput(['context', 'inspect', '--format', '{{(index .Endpoints "docker").Host}}']);
  const localEngine =
    dockerHost.startsWith('npipe://') ||
    dockerHost.startsWith('unix://') ||
    /^tcp:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/u.test(dockerHost);
  assertCondition(localEngine, `Database restore smoke refuses non-local Docker engine ${dockerHost}.`);
}

function assertDisposableNames() {
  const resources = [sourceContainer, restoredContainer];
  assertCondition(
    resources.every((name) => /^hands-database-restore-\d+-\d+-(?:source|restored)$/u.test(name)),
    'Database restore smoke generated an unsafe disposable resource name.',
  );
}

function assertPortIsFree(port) {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.once('error', () => rejectPort(new Error(`Database restore smoke port ${port} is already in use.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolvePort));
  });
}

async function waitForHostPort(port) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const reachable = await new Promise((resolveConnection) => {
      const socket = createConnection({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.destroy();
        resolveConnection(true);
      });
      socket.once('error', () => resolveConnection(false));
      socket.setTimeout(500, () => {
        socket.destroy();
        resolveConnection(false);
      });
    });
    if (reachable) return;
    await delay(250);
  }
  throw new Error(`PostgreSQL host port ${port} did not become reachable.`);
}

async function waitForPrismaConnection() {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        await prisma.$queryRawUnsafe('SELECT 1');
        return;
      } catch {
        await delay(250);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
  throw new Error('Prisma could not connect to the disposable PostgreSQL target.');
}

function stderrText(result) {
  return String(result.stderr ?? '').trim();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}
