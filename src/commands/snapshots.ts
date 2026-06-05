import type { Command } from 'commander';
import type { Logger } from 'pino';
import { expandHomeDirectory, readYamlConfig, resolveApplications } from '../lib/yaml-config.js';
import { listSnapshots } from '../lib/restic.js';
import { addSharedOptions } from './shared-options.js';

interface SnapshotsCommandOptions {
  repo: string;
  passwordFile: string;
  restUsername?: string;
  restPassword?: string;
  config: string;
}

export function registerSnapshotsCommand(program: Command, logger: Logger): void {
  const command = program
    .command('snapshots')
    .description('List all snapshots in the restic repository');
  addSharedOptions(command);

  command.action(async (options: SnapshotsCommandOptions) => {
    const localLogger = logger.child({ command: 'snapshots' });
    localLogger.debug({ repo: options.repo }, 'Listing snapshots');
    const syncifyConfig = readYamlConfig(options.config);
    const applications = resolveApplications(syncifyConfig);

    await listSnapshots({
      repositoryPath: expandHomeDirectory(options.repo),
      passwordFile: expandHomeDirectory(options.passwordFile),
      restUsername: options.restUsername,
      restPassword: options.restPassword,
      applications,
    });
  });
}
