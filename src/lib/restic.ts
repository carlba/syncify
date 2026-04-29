import { execa } from 'execa';
import type { ResolvedApplication } from './yaml-config.js';

export interface ResticOptions {
  repositoryPath: string;
  passwordFile: string;
  extraArgs?: string[];
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

/**
 * Initialize a new restic repository.
 *
 * Idempotent: silently succeeds if the repository already exists.
 */
export async function initRepository(options: ResticOptions): Promise<void> {
  const baseArgs = buildBaseArgs(options);

  try {
    await execa('restic', ['init', ...baseArgs], { stdio: 'inherit' });
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
  const { app, relativePaths, extraArgs = [] } = target;
  const baseArgs = buildBaseArgs(options);

  if (relativePaths.length === 0) {
    return;
  }

  const tagArgs = app.resticTags.flatMap(tag => ['--tag', tag]);

  try {
    await execa('restic', ['backup', ...baseArgs, ...tagArgs, ...extraArgs, ...relativePaths], {
      stdio: 'inherit',
      cwd,
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
      { stdio: 'inherit' }
    );
  } catch (error: unknown) {
    throw wrapResticError('restore', error);
  }
}

/**
 * List snapshots in the repository.
 */
export async function listSnapshots(options: ResticOptions): Promise<void> {
  const baseArgs = buildBaseArgs(options);

  try {
    await execa('restic', ['snapshots', ...baseArgs], { stdio: 'inherit' });
  } catch (error: unknown) {
    throw wrapResticError('snapshots', error);
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
