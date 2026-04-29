import type { Command } from 'commander';
import type { Logger } from 'pino';
import { expandHomeDirectory } from '../lib/yaml-config.js';
import { listSnapshots } from '../lib/restic.js';
import { DEFAULT_PASSWORD_FILE, DEFAULT_REPO_PATH } from './defaults.js';

interface SnapshotsCommandOptions {
  repo: string;
  passwordFile: string;
}

export function registerSnapshotsCommand(program: Command, logger: Logger): void {
  program
    .command('snapshots')
    .description('List all snapshots in the restic repository')
    .option('-r, --repo <path>', 'Path to restic repository', DEFAULT_REPO_PATH)
    .option('-p, --password-file <path>', 'Path to restic password file', DEFAULT_PASSWORD_FILE)
    .action(async (options: SnapshotsCommandOptions) => {
      const log = logger.child({ command: 'snapshots' });

      log.info({ repo: options.repo }, 'Listing snapshots');

      await listSnapshots({
        repositoryPath: expandHomeDirectory(options.repo),
        passwordFile: expandHomeDirectory(options.passwordFile),
      });
    });
}
