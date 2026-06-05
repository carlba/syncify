import type { Command } from 'commander';
import type { Logger } from 'pino';
import { expandHomeDirectory, readYamlConfig } from '../lib/yaml-config.js';
import { initRepository } from '../lib/restic.js';
import { addSharedOptions } from './shared-options.js';

interface InitCommandOptions {
  config: string;
  repo: string;
  passwordFile: string;
}

export function registerInitCommand(program: Command, logger: Logger): void {
  const command = program.command('init').description('Initialize the restic repository');
  addSharedOptions(command);

  command.action(async (options: InitCommandOptions) => {
    const log = logger.child({ command: 'init' });

    readYamlConfig(options.config);
    log.info({ repo: options.repo }, 'Initializing restic repository');

    await initRepository({
      repositoryPath: expandHomeDirectory(options.repo),
      passwordFile: expandHomeDirectory(options.passwordFile),
    });

    log.info('Repository initialized successfully');
  });
}
