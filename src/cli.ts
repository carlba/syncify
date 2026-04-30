import { Command } from 'commander';
import packageJson from '../package.json' with { type: 'json' };
import { LOGGER } from './registry.js';
import { registerInitCommand } from './commands/init.js';
import { registerBackupCommand } from './commands/backup.js';
import { registerRestoreCommand } from './commands/restore.js';
import { registerSnapshotsCommand } from './commands/snapshots.js';
import { registerPruneCommand } from './commands/prune.js';

const logger = LOGGER.child({ module: 'cli' });

export function buildCli(): Command {
  const program = new Command();

  program
    .name('syncify')
    .version(packageJson.version)
    .description('Declarative application backup tool powered by restic');

  registerInitCommand(program, logger);
  registerBackupCommand(program, logger);
  registerRestoreCommand(program, logger);
  registerSnapshotsCommand(program, logger);
  registerPruneCommand(program, logger);

  return program;
}

export async function runCli(argv = process.argv): Promise<void> {
  const program = buildCli();
  await program.parseAsync(argv);
}
