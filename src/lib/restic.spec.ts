import { describe, expect, it, vi, beforeEach } from 'vitest';
import { execa } from 'execa';
import { backupApplication, restoreSnapshot } from './restic.js';
import type { ResolvedApplication } from './yaml-config.js';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

describe('restic helper functions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('backs up a single file from its parent directory', async () => {
    const app: ResolvedApplication = {
      name: 'wezterm',
      description: 'WezTerm config',
      enabled: true,
      resticTags: ['app:wezterm'],
      paths: [
        {
          name: 'config',
          type: 'file',
          resolvedPath: '/Users/carlba/.config/.wezterm.lua',
        },
      ],
    };

    const resticOptions = {
      repositoryPath: '/repo',
      passwordFile: '/password',
    };

    await backupApplication(
      { app, relativePaths: ['.wezterm.lua'] },
      resticOptions,
      '/Users/carlba/.config'
    );

    expect(execa).toHaveBeenCalledWith(
      'restic',
      [
        'backup',
        '--repo',
        '/repo',
        '--password-file',
        '/password',
        '--tag',
        'app:wezterm',
        '.wezterm.lua',
      ],
      { stdio: 'inherit', cwd: '/Users/carlba/.config' }
    );
  });

  it('restores a snapshot to a target directory with an include path', async () => {
    const resticOptions = {
      repositoryPath: '/repo',
      passwordFile: '/password',
    };

    await restoreSnapshot(
      {
        snapshot: 'latest',
        target: '/target',
        includePaths: ['.wezterm.lua'],
      },
      resticOptions
    );

    expect(execa).toHaveBeenCalledWith(
      'restic',
      [
        'restore',
        'latest',
        '--target',
        '/target',
        '--repo',
        '/repo',
        '--password-file',
        '/password',
        '--include',
        '.wezterm.lua',
      ],
      { stdio: 'inherit' }
    );
  });

  it('restores a snapshot using multiple include paths', async () => {
    const resticOptions = {
      repositoryPath: '/repo',
      passwordFile: '/password',
    };

    await restoreSnapshot(
      {
        snapshot: 'latest',
        target: '/target',
        includePaths: ['.wezterm.lua', 'config.lua'],
      },
      resticOptions
    );

    expect(execa).toHaveBeenCalledWith(
      'restic',
      [
        'restore',
        'latest',
        '--target',
        '/target',
        '--repo',
        '/repo',
        '--password-file',
        '/password',
        '--include',
        '.wezterm.lua',
        '--include',
        'config.lua',
      ],
      { stdio: 'inherit' }
    );
  });

  it('restores a snapshot to a target directory without a subfolder selector', async () => {
    const resticOptions = {
      repositoryPath: '/repo',
      passwordFile: '/password',
    };

    await restoreSnapshot(
      {
        snapshot: 'latest',
        target: '/target',
      },
      resticOptions
    );

    expect(execa).toHaveBeenCalledWith(
      'restic',
      [
        'restore',
        'latest',
        '--target',
        '/target',
        '--repo',
        '/repo',
        '--password-file',
        '/password',
      ],
      { stdio: 'inherit' }
    );
  });
});
