import { Option, type Command } from 'commander';
import type { Logger } from 'pino';
import { expandHomeDirectory, readYamlConfig, resolveApplications } from '../lib/yaml-config.js';
import { listSnapshots } from '../lib/restic.js';
import { DEFAULT_CONFIG_FILE, DEFAULT_PASSWORD_FILE, DEFAULT_REPO_PATH } from './defaults.js';

interface SnapshotsCommandOptions {
  repo: string;
  passwordFile: string;
  config: string;
}

export function registerSnapshotsCommand(program: Command, logger: Logger): void {
  program
    .command('snapshots')
    .description('List all snapshots in the restic repository')
    .addOption(
      new Option('-r, --repo <path>', 'Path to restic repository')
        .default(DEFAULT_REPO_PATH)
        .env('SYNCIFY_REPO_PATH')
    )
    .option('-p, --password-file <path>', 'Path to restic password file', DEFAULT_PASSWORD_FILE)
    .option('-c, --config <path>', 'Path to syncify YAML config', DEFAULT_CONFIG_FILE)
    .action(async (options: SnapshotsCommandOptions) => {
      const localLogger = logger.child({ command: 'snapshots' });
      localLogger.debug({ repo: options.repo }, 'Listing snapshots');
      const syncifyConfig = readYamlConfig(options.config);
      const applications = resolveApplications(syncifyConfig);

      await listSnapshots({
        repositoryPath: expandHomeDirectory(options.repo),
        passwordFile: expandHomeDirectory(options.passwordFile),
        applications,
      });
    });
}
