import type { Command } from 'commander';
import type { Logger } from 'pino';
import {
  expandHomeDirectory,
  getCommonAncestor,
  getRelativePath,
  readYamlConfig,
  resolveApplications,
} from '../lib/yaml-config.js';
import { backupApplication } from '../lib/restic.js';
import {
  DEFAULT_CONFIG_FILE,
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_PASSWORD_FILE,
  DEFAULT_REPO_PATH,
} from './defaults.js';

interface BackupCommandOptions {
  config: string;
  repo: string;
  passwordFile: string;
  app?: string;
  exclude?: string[];
}

function collectExclude(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

export function registerBackupCommand(program: Command, logger: Logger): void {
  program
    .command('backup')
    .description('Backup configured applications using restic')
    .requiredOption('-c, --config <path>', 'Path to syncify YAML config', DEFAULT_CONFIG_FILE)
    .option('-r, --repo <path>', 'Path to restic repository', DEFAULT_REPO_PATH)
    .option('-p, --password-file <path>', 'Path to restic password file', DEFAULT_PASSWORD_FILE)
    .option('-a, --app <name>', 'Backup only this application (by name)')
    .option(
      '-e, --exclude <pattern>',
      'exclude a pattern (can be specified multiple times)',
      collectExclude,
      []
    )
    .action(async (options: BackupCommandOptions) => {
      const localLogger = logger.child({ command: 'backup' });

      const syncifyConfig = readYamlConfig(options.config);
      const applications = resolveApplications(syncifyConfig);

      const excludePatterns = [
        ...(syncifyConfig.exclude_patterns?.length > 0
          ? syncifyConfig.exclude_patterns
          : DEFAULT_EXCLUDE_PATTERNS),
        ...(options.exclude ?? []),
      ];

      const extraArgs = excludePatterns.flatMap(pattern => [
        '--exclude',
        expandHomeDirectory(pattern),
      ]);

      const targets =
        options.app !== undefined
          ? applications.filter(app => app.name === options.app)
          : applications;

      if (targets.length === 0) {
        localLogger.warn(
          { app: options.app },
          'No enabled applications matched — nothing to back up'
        );
        return;
      }

      const resticOptions = {
        repositoryPath: expandHomeDirectory(options.repo),
        passwordFile: expandHomeDirectory(options.passwordFile),
        extraArgs,
      };

      for (const app of targets) {
        if (app.paths.length === 0) {
          localLogger.warn(
            { app: app.name },
            'No resolvable paths for current platform — skipping'
          );
          continue;
        }

        const resolvedPaths = app.paths.map(appPath => appPath.resolvedPath);
        const root = getCommonAncestor(resolvedPaths);
        const relativePaths = resolvedPaths.map(
          resolvedPath => getRelativePath(resolvedPath, root) || '.'
        );

        localLogger.info({ app: app.name, root, paths: relativePaths }, 'Backing up app from root');

        await backupApplication({ app, relativePaths }, resticOptions, root);

        localLogger.info({ app: app.name }, 'Backup complete');
      }
    });
}
