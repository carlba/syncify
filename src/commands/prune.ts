import type { Command } from 'commander';
import type { Logger } from 'pino';

import { expandHomeDirectory, readYamlConfig } from '../lib/yaml-config.js';
import { execa } from 'execa';
import { buildResticEnv } from '../lib/restic.js';
import { addSharedOptions } from './shared-options.js';

interface PruneCommandOptions {
  config: string;
  repo: string;
  passwordFile: string;
  restUsername?: string;
  restPassword?: string;
}

export function registerPruneCommand(program: Command, logger: Logger): void {
  const command = program
    .command('prune')
    .description('Prune unused data from the restic repository (global, not per app)');
  addSharedOptions(command);

  command.action(async (options: PruneCommandOptions) => {
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
        {
          stdio: 'inherit',
          env: buildResticEnv({
            repositoryPath: expandHomeDirectory(options.repo),
            passwordFile: expandHomeDirectory(options.passwordFile),
            restUsername: options.restUsername,
            restPassword: options.restPassword,
          }),
        }
      );
      log.info('Repository pruned successfully');
    } catch (error) {
      log.error({ err: error }, 'Prune failed');
      throw error;
    }
  });
}
