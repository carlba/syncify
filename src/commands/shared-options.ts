import { Option, type Command } from 'commander';
import { DEFAULT_CONFIG_FILE, DEFAULT_PASSWORD_FILE, DEFAULT_REPO_PATH } from './defaults.js';

export function addSharedOptions<T extends Command>(command: T): T {
  command.requiredOption('-c, --config <path>', 'Path to syncify YAML config', DEFAULT_CONFIG_FILE);

  command.addOption(
    new Option('-r, --repo <path>', 'Path to restic repository')
      .default(DEFAULT_REPO_PATH)
      .env('SYNCIFY_REPO_PATH')
  );

  command.addOption(
    new Option('-p, --password-file <path>', 'Path to restic password file')
      .default(DEFAULT_PASSWORD_FILE)
      .env('SYNCIFY_PASSWORD_FILE')
  );

  return command;
}
