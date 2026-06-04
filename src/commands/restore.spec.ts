import { describe, expect, it, vi, beforeEach } from 'vitest';
import { homedir } from 'node:os';
import { buildCli } from '../cli.js';
import { restoreSnapshot } from '../lib/restic.js';
import { readYamlConfig, resolveApplication } from '../lib/yaml-config.js';
import { DEFAULT_RESTORE_TARGET } from './defaults.js';

vi.mock('../lib/restic.js', async () => {
  const original = await vi.importActual<typeof import('../lib/restic.js')>('../lib/restic.js');
  return {
    ...original,
    restoreSnapshot: vi.fn(),
  };
});

vi.mock('../lib/yaml-config.js', async () => {
  const original =
    await vi.importActual<typeof import('../lib/yaml-config.js')>('../lib/yaml-config.js');
  return {
    ...original,
    readYamlConfig: vi.fn(),
    resolveApplication: vi.fn(),
  };
});

const mockedRestoreSnapshot = vi.mocked(restoreSnapshot);
const mockedReadYamlConfig = vi.mocked(readYamlConfig);
const mockedResolveApplication = vi.mocked(resolveApplication);

describe('restore command', () => {
  beforeEach(() => {
    mockedRestoreSnapshot.mockReset();
    mockedReadYamlConfig.mockReset().mockReturnValue({
      syncify_applications: {
        wezterm: {
          enabled: true,
          description: 'WezTerm',
          restic_tags: ['app:wezterm,source:desktop'],
          paths: [
            {
              name: 'config',
              type: 'file',
              platforms: { darwin: '~/.wezterm.lua', all: '~/.wezterm.lua' },
            },
          ],
        },
      },
    } as any);
    mockedResolveApplication.mockReset().mockReturnValue({
      name: 'wezterm',
      description: 'WezTerm',
      enabled: true,
      resticTags: ['app:wezterm,source:desktop'],
      paths: [{ name: 'config', type: 'file', resolvedPath: `${homedir()}/.wezterm.lua` }],
    } as any);
  });

  it('defaults to latest when snapshot is omitted for an app restore', async () => {
    const program = buildCli();
    await program.parseAsync([
      'node',
      'syncify',
      'restore',
      '--config',
      'config.yml',
      '--app',
      'wezterm',
    ]);

    expect(mockedRestoreSnapshot).toHaveBeenCalledTimes(1);
    expect(mockedRestoreSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: 'latest',
        target: homedir(),
        includePaths: ['.wezterm.lua'],
        extraArgs: ['--tag', 'app:wezterm,source:desktop'],
      }),
      expect.objectContaining({
        repositoryPath: expect.any(String) as string,
        passwordFile: expect.any(String) as string,
      })
    );
  });

  it('defaults to latest when snapshot is omitted for direct restore', async () => {
    const program = buildCli();
    await program.parseAsync(['node', 'syncify', 'restore']);

    expect(mockedRestoreSnapshot).toHaveBeenCalledTimes(1);
    expect(mockedRestoreSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: 'latest',
        target: DEFAULT_RESTORE_TARGET,
      }),
      expect.objectContaining({
        repositoryPath: expect.any(String) as string,
        passwordFile: expect.any(String) as string,
      })
    );
  });
});
