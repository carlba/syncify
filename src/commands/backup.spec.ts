import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCli } from '../cli.js';
import { backupApplication } from '../lib/restic.js';
import {
  readYamlConfig,
  resolveApplications,
  type ResolvedApplication,
} from '../lib/yaml-config.js';
import type { SyncifyConfig } from '../syncify-schema.js';

vi.mock('../lib/restic.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/restic.js')>('../lib/restic.js');
  return {
    ...actual,
    backupApplication: vi.fn(),
  };
});

vi.mock('../lib/yaml-config.js', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/yaml-config.js')>('../lib/yaml-config.js');
  return {
    ...actual,
    readYamlConfig: vi.fn(),
    resolveApplications: vi.fn(),
  };
});

const mockedBackupApplication = vi.mocked(backupApplication, true);
const mockedReadYamlConfig = vi.mocked(readYamlConfig, true);
const mockedResolveApplications = vi.mocked(resolveApplications, true);

describe('backup command', () => {
  beforeEach(() => {
    mockedBackupApplication.mockReset();
    mockedReadYamlConfig.mockReset();
    mockedResolveApplications.mockReset();
  });

  it('passes global config exclude patterns and CLI excludes to restic', async () => {
    const exampleConfig: SyncifyConfig = {
      exclude_patterns: ['.cache', 'node_modules'],
      syncify_applications: {},
    };

    const exampleApplications: ResolvedApplication[] = [
      {
        name: 'calibre',
        description: 'Calibre settings',
        enabled: true,
        resticTags: ['app:calibre'],
        paths: [
          {
            name: 'config',
            type: 'folder',
            resolvedPath: '/Users/carlba/Library/Preferences/calibre',
          },
        ],
      },
    ];

    mockedReadYamlConfig.mockReturnValue(exampleConfig);
    mockedResolveApplications.mockReturnValue(exampleApplications);

    const program = buildCli();
    await program.parseAsync([
      'node',
      'syncify',
      'backup',
      '--config',
      'config.yml',
      '-e',
      '.git',
      '-e',
      'build',
    ]);

    expect(mockedBackupApplication).toHaveBeenCalledTimes(1);
    expect(mockedBackupApplication).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        extraArgs: [
          '--exclude',
          '.cache',
          '--exclude',
          'node_modules',
          '--exclude',
          '.git',
          '--exclude',
          'build',
        ],
      }),
      expect.any(String)
    );
  });

  it('uses SYNCIFY_REPO_PATH when repo option is omitted', async () => {
    const originalRepoPath = process.env.SYNCIFY_REPO_PATH;
    process.env.SYNCIFY_REPO_PATH = '/env/repo';

    try {
      const exampleConfig: SyncifyConfig = {
        exclude_patterns: [],
        syncify_applications: {},
      };

      const exampleApplications: ResolvedApplication[] = [
        {
          name: 'calibre',
          description: 'Calibre settings',
          enabled: true,
          resticTags: ['app:calibre'],
          paths: [
            {
              name: 'config',
              type: 'folder',
              resolvedPath: '/Users/carlba/Library/Preferences/calibre',
            },
          ],
        },
      ];

      mockedReadYamlConfig.mockReturnValue(exampleConfig);
      mockedResolveApplications.mockReturnValue(exampleApplications);

      const program = buildCli();
      await program.parseAsync(['node', 'syncify', 'backup', '--config', 'config.yml']);

      expect(mockedBackupApplication).toHaveBeenCalledTimes(1);
      expect(mockedBackupApplication).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          repositoryPath: '/env/repo',
        }),
        expect.any(String)
      );
    } finally {
      if (originalRepoPath === undefined) {
        delete process.env.SYNCIFY_REPO_PATH;
      } else {
        process.env.SYNCIFY_REPO_PATH = originalRepoPath;
      }
    }
  });
});
