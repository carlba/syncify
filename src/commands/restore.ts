import type { Command } from 'commander';
import type { Logger } from 'pino';
import {
  expandHomeDirectory,
  getCommonAncestor,
  getRelativePath,
  readYamlConfig,
  resolveApplication,
  resolveApplications,
} from '../lib/yaml-config.js';
import { restoreSnapshot, type ResticOptions } from '../lib/restic.js';
import { DEFAULT_PASSWORD_FILE, DEFAULT_REPO_PATH, DEFAULT_RESTORE_TARGET } from './defaults.js';
import type { ResolvedApplication } from '../lib/yaml-config.js';

interface RestoreCommandOptions {
  config?: string;
  repo: string;
  passwordFile: string;
  snapshot: string;
  target?: string;
  include?: string[];
  app?: string;
}

async function restoreApplication(
  application: ResolvedApplication,
  opts: { snapshot: string; targetOverride?: string; extraIncludePaths?: string[] },
  resticOptions: ResticOptions,
  log: Logger
): Promise<void> {
  if (application.paths.length === 0) {
    log.warn({ app: application.name }, 'No resolvable paths for current platform — skipping');
    return;
  }

  const appRoot = getCommonAncestor(application.paths.map(appPath => appPath.resolvedPath));
  const target = opts.targetOverride ?? appRoot;
  const tagArgs =
    opts.snapshot === 'latest' && application.resticTags.length > 0
      ? ['--tag', application.resticTags.join(',')]
      : [];
  const includePaths = [
    ...application.paths.map(appPath => getRelativePath(appPath.resolvedPath, appRoot)),
    ...(opts.extraIncludePaths ?? []),
  ];

  log.info({ app: application.name, snapshot: opts.snapshot, target }, 'Restoring app');

  await restoreSnapshot(
    { snapshot: opts.snapshot, target, includePaths, extraArgs: tagArgs },
    resticOptions
  );

  log.info({ app: application.name, target }, 'Restore complete');
}

export function registerRestoreCommand(program: Command, logger: Logger): void {
  program
    .command('restore')
    .description('Restore a snapshot from the restic repository')
    .option('-s, --snapshot <id>', 'Snapshot ID or "latest" to restore', 'latest')
    .option('-c, --config <path>', 'Path to syncify YAML config')
    .option('-a, --app <name>', 'Restore a configured application using current platform paths')
    .option('-r, --repo <path>', 'Path to restic repository', DEFAULT_REPO_PATH)
    .option('-p, --password-file <path>', 'Path to restic password file', DEFAULT_PASSWORD_FILE)
    .option('-t, --target <path>', 'Directory to restore into')
    .option('-i, --include <path...>', 'Limit restore to these paths (can be repeated)')
    .action(async (options: RestoreCommandOptions) => {
      const log = logger.child({ command: 'restore' });

      if (options.app !== undefined && options.config === undefined) {
        throw new Error('The --app option requires --config <path>');
      }

      const extraIncludePaths = options.include?.length ? [...options.include] : undefined;
      const resticOptions: ResticOptions = {
        repositoryPath: expandHomeDirectory(options.repo),
        passwordFile: expandHomeDirectory(options.passwordFile),
      };
      const targetOverride = options.target ? expandHomeDirectory(options.target) : undefined;

      if (options.config !== undefined) {
        const syncifyConfig = readYamlConfig(options.config);

        if (options.app !== undefined) {
          const application = resolveApplication(syncifyConfig, options.app);
          if (application === undefined) {
            throw new Error(`Application '${options.app}' not found or disabled`);
          }
          await restoreApplication(
            application,
            { snapshot: options.snapshot, targetOverride, extraIncludePaths },
            resticOptions,
            log
          );
          return;
        }

        const applications = resolveApplications(syncifyConfig);
        if (applications.length === 0) {
          log.warn('No enabled applications in config — nothing to restore');
          return;
        }

        log.info(
          { snapshot: options.snapshot, appCount: applications.length },
          'Restoring all apps'
        );
        for (const application of applications) {
          await restoreApplication(
            application,
            { snapshot: options.snapshot, targetOverride, extraIncludePaths },
            resticOptions,
            log
          );
        }
        return;
      }

      const target = targetOverride ?? DEFAULT_RESTORE_TARGET;
      log.info({ snapshot: options.snapshot, target }, 'Restoring snapshot');
      await restoreSnapshot(
        { snapshot: options.snapshot, target, includePaths: extraIncludePaths },
        resticOptions
      );
      log.info({ target }, 'Restore complete');
    });
}
