import type { Command } from 'commander';
import type { Logger } from 'pino';

import { expandHomeDirectory, readYamlConfig } from '../lib/yaml-config.js';
import { execa } from 'execa';
import { DEFAULT_CONFIG_FILE, DEFAULT_PASSWORD_FILE, DEFAULT_REPO_PATH } from './defaults.js';

interface PruneCommandOptions {
  config: string;
  repo: string;
  passwordFile: string;
}

export function registerPruneCommand(program: Command, logger: Logger): void {
  program
    .command('prune')
    .description('Prune unused data from the restic repository (global, not per app)')
    .option('-c, --config <path>', 'Path to syncify YAML config', DEFAULT_CONFIG_FILE)
    .option('-r, --repo <path>', 'Path to restic repository', DEFAULT_REPO_PATH)
    .option('-p, --password-file <path>', 'Path to restic password file', DEFAULT_PASSWORD_FILE)
    .action(async (options: PruneCommandOptions) => {
      const log = logger.child({ command: 'prune' });
      // Validate config exists, but we don't need to parse apps
      readYamlConfig(options.config);
      log.info({ repo: options.repo }, 'Pruning restic repository');
      try {
        await execa(
          'restic',
          [
            'prune',
            '--repo',
            expandHomeDirectory(options.repo),
            '--password-file',
            expandHomeDirectory(options.passwordFile),
          ],
          { stdio: 'inherit' }
        );
        log.info('Repository pruned successfully');
      } catch (error) {
        log.error({ err: error }, 'Prune failed');
        throw error;
      }
    });
}
