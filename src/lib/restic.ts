import { execa } from 'execa';
import { type ResolvedApplication } from './yaml-config.js';
import type { ResticSnapshot } from './restic.types.js';

import { AsciiTable3 } from 'ascii-table3';
import { formatBytes } from './utils.js';
import { LOGGER } from '../registry.js';

export interface ResticOptions {
  repositoryPath: string;
  passwordFile: string;
  restUsername?: string;
  restPassword?: string;
  extraArgs?: string[];
  applications?: ResolvedApplication[];
}

export interface BackupTarget {
  app: ResolvedApplication;
  relativePaths: string[];
  extraArgs?: string[];
}

export interface RestoreOptions {
  snapshot: string;
  target: string;
  includePaths?: string[];
  extraArgs?: string[];
}

/**
 * Build the base restic argument list shared across all commands.
 */
function buildBaseArgs(options: ResticOptions): string[] {
  return [
    '--repo',
    options.repositoryPath,
    '--password-file',
    options.passwordFile,
    ...(options.extraArgs ?? []),
  ];
}

export function buildResticEnv(options: ResticOptions): NodeJS.ProcessEnv {
  return {
    // eslint-disable-next-line no-restricted-syntax
    ...process.env,
    ...(options.restUsername ? { RESTIC_REST_USERNAME: options.restUsername } : {}),
    ...(options.restPassword ? { RESTIC_REST_PASSWORD: options.restPassword } : {}),
  };
}

/**
 * Initialize a new restic repository.
 *
 * Idempotent: silently succeeds if the repository already exists.
 */
export async function initRepository(options: ResticOptions): Promise<void> {
  const baseArgs = buildBaseArgs(options);

  try {
    await execa('restic', ['init', ...baseArgs], {
      stdio: 'inherit',
      env: buildResticEnv(options),
    });
  } catch (error: unknown) {
    const exitCode = getExecaExitCode(error);

    // Restic exit code 1 with "already initialized" is not a failure.
    if (exitCode === 1 && isAlreadyInitializedError(error)) {
      return;
    }

    throw wrapResticError('init', error);
  }
}

/**
 * Backup all resolved paths for an application.
 */
export async function backupApplication(
  target: BackupTarget,
  options: ResticOptions,
  cwd?: string
): Promise<void> {
  const localLogger = LOGGER.child({ module: 'restic', context: backupApplication.name });
  const { app, relativePaths, extraArgs = [] } = target;
  const baseArgs = buildBaseArgs(options);

  if (relativePaths.length === 0) {
    return;
  }

  const tagArgs = app.resticTags.flatMap(tag => ['--tag', tag]);

  localLogger.debug({ baseArgs, tagArgs, extraArgs }, 'backup upp application');

  try {
    await execa('restic', ['backup', ...baseArgs, ...tagArgs, ...extraArgs, ...relativePaths], {
      stdio: 'inherit',
      cwd,
      env: buildResticEnv(options),
    });
  } catch (error: unknown) {
    throw wrapResticError(`backup:${app.name}`, error);
  }
}

/**
 * Restore a snapshot to the given target directory.
 */
export async function restoreSnapshot(
  restoreOptions: RestoreOptions,
  options: ResticOptions
): Promise<void> {
  const { snapshot, target, includePaths = [], extraArgs = [] } = restoreOptions;
  const baseArgs = buildBaseArgs(options);

  const includeArgs = includePaths.flatMap(includePath => ['--include', includePath]);

  try {
    await execa(
      'restic',
      ['restore', snapshot, '--target', target, ...baseArgs, ...includeArgs, ...extraArgs],
      {
        stdio: 'inherit',
        env: buildResticEnv(options),
      }
    );
  } catch (error: unknown) {
    throw wrapResticError('restore', error);
  }
}

function formatShortDateTime(value: string): string {
  return new Date(value).toLocaleString('sv-SE', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatRestoreSnapshotData(snap: ResticSnapshot, applications: ResolvedApplication[]) {
  return {
    ID: snap.short_id,
    'Backup start': formatShortDateTime(snap.summary.backup_start),
    // Host: snap.hostname,
    // User: `${snap.username}(uid:${snap.uid}, gid:${snap.gid})`,
    application: applications.find(application =>
      snap.tags.every(tag => application.resticTags.includes(tag))
    )?.name,
    Paths: snap.paths.length,
    Tags: snap.tags.join(' '),
    // 'Backup end': formatShortDateTime(snap.summary.backup_end),
    Files: `${snap.summary.files_new}/${snap.summary.files_changed}/${snap.summary.files_unmodified}`,
    Total: `${snap.summary.total_files_processed}`,
    'Dir (n/c/uc)': `${snap.summary.dirs_new}/${snap.summary.dirs_changed}/${snap.summary.dirs_unmodified}`,
    Added: `${formatBytes(snap.summary.data_added)}`,
    Processed: `${formatBytes(snap.summary.total_bytes_processed)}`,
  };
}

/**
 * List snapshots in the repository.
 */
export async function listSnapshots(options: ResticOptions): Promise<void> {
  const baseArgs = buildBaseArgs(options);
  const applications = options.applications;

  options.extraArgs = [...(options.extraArgs ?? ['--json'])];

  if (options.extraArgs?.includes('--json')) {
    try {
      const { stdout } = await execa('restic', ['snapshots', ...baseArgs, ...options.extraArgs], {
        stdio: 'pipe',
        env: buildResticEnv(options),
      });
      const data = stdout
        .split('\n')
        .map(line => JSON.parse(line) as [])
        .flat()
        .map(line =>
          formatRestoreSnapshotData(line as unknown as ResticSnapshot, applications ?? [])
        );

      const table = new AsciiTable3()
        .setHeading(...Object.keys(data[0]))
        .addRowMatrix(data.map(dat => Object.values(dat)));

      console.log(table.toString());
    } catch (error: unknown) {
      throw wrapResticError('snapshots', error);
    }
  } else {
    try {
      await execa('restic', ['snapshots', ...baseArgs], {
        stdio: 'inherit',
        env: buildResticEnv(options),
      });
    } catch (error: unknown) {
      throw wrapResticError('snapshots', error);
    }
  }
}

function getExecaExitCode(error: unknown): number | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'exitCode' in error &&
    typeof (error as Record<string, unknown>).exitCode === 'number'
  ) {
    return (error as Record<string, unknown>).exitCode as number;
  }
  return undefined;
}

function isAlreadyInitializedError(error: unknown): boolean {
  if (
    typeof error === 'object' &&
    error !== null &&
    'stderr' in error &&
    typeof (error as Record<string, unknown>).stderr === 'string'
  ) {
    const stderr = (error as Record<string, unknown>).stderr as string;
    return stderr.includes('already initialized') || stderr.includes('already exists');
  }
  return false;
}

function wrapResticError(command: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`restic ${command} failed: ${message}`);
}
