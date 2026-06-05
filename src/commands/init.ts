import { Option, type Command } from 'commander';
import type { Logger } from 'pino';
import { expandHomeDirectory, readYamlConfig } from '../lib/yaml-config.js';
import { initRepository } from '../lib/restic.js';
import { DEFAULT_CONFIG_FILE, DEFAULT_PASSWORD_FILE, DEFAULT_REPO_PATH } from './defaults.js';

interface InitCommandOptions {
  config: string;
  repo: string;
  passwordFile: string;
}

export function registerInitCommand(program: Command, logger: Logger): void {
  program
    .command('init')
    .description('Initialize the restic repository')
    .requiredOption('-c, --config <path>', 'Path to syncify YAML config', DEFAULT_CONFIG_FILE)
    .addOption(
      new Option('-r, --repo <path>', 'Path to restic repository')
        .default(DEFAULT_REPO_PATH)
        .env('SYNCIFY_REPO_PATH')
    )
    .option('-p, --password-file <path>', 'Path to restic password file', DEFAULT_PASSWORD_FILE)
    .action(async (options: InitCommandOptions) => {
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
