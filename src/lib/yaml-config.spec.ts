import { describe, expect, it } from 'vitest';
import { homedir } from 'node:os';
import { SyncifyConfigSchema } from '../syncify-schema.js';
import {
  expandHomeDirectory,
  getCommonAncestor,
  getRelativePath,
  resolveApplication,
  resolveApplicationPaths,
  resolveApplications,
  resolvePlatformPath,
} from './yaml-config.js';
import type { SyncifyConfig } from '../syncify-schema.js';

const EXAMPLE_CONFIG: SyncifyConfig = {
  syncify_applications: {
    calibre: {
      description: 'Calibre settings',
      enabled: true,
      restic_tags: ['app:calibre', 'source:desktop'],
      paths: [
        {
          name: 'config',
          type: 'folder',
          platforms: {
            darwin: '/Users/carlba/Library/Preferences/calibre',
            linux: '/home/carlba/.config/calibre',
          },
        },
        {
          name: 'library',
          type: 'folder',
          platforms: {
            darwin: '/Users/carlba/Calibre Library',
            linux: '/home/carlba/Calibre Library',
          },
        },
      ],
    },
    disabled_app: {
      description: 'A disabled application',
      enabled: false,
      restic_tags: [],
      paths: [],
    },
  },
};

describe('SyncifyConfigSchema', () => {
  it('parses a valid config', () => {
    const result = SyncifyConfigSchema.safeParse({
      syncify_applications: {
        calibre: {
          description: 'Calibre settings',
          enabled: true,
          restic_tags: ['app:calibre'],
          paths: [
            {
              name: 'config',
              type: 'folder',
              platforms: { darwin: '/some/path' },
            },
          ],
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it('applies default values for optional fields', () => {
    const result = SyncifyConfigSchema.safeParse({
      syncify_applications: {
        myapp: {
          paths: [
            {
              name: 'data',
              type: 'file',
              platforms: { all: '/some/path' },
            },
          ],
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.syncify_applications.myapp.enabled).toBe(true);
      expect(result.data.syncify_applications.myapp.restic_tags).toEqual([]);
    }
  });

  it('rejects a path entry with no platform keys', () => {
    const result = SyncifyConfigSchema.safeParse({
      syncify_applications: {
        myapp: {
          paths: [{ name: 'data', type: 'file', platforms: {} }],
        },
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown path type', () => {
    const result = SyncifyConfigSchema.safeParse({
      syncify_applications: {
        myapp: {
          paths: [
            {
              name: 'data',
              type: 'symlink',
              platforms: { all: '/some/path' },
            },
          ],
        },
      },
    });

    expect(result.success).toBe(false);
  });
});

describe('expandHomeDirectory', () => {
  it('expands ~ to the home directory', () => {
    expect(expandHomeDirectory('~')).toBe(homedir());
  });

  it('expands ~/... to a path under home', () => {
    expect(expandHomeDirectory('~/foo/bar')).toBe(`${homedir()}/foo/bar`);
  });

  it('returns other paths unchanged', () => {
    expect(expandHomeDirectory('/tmp/file')).toBe('/tmp/file');
  });
});

describe('getCommonAncestor', () => {
  it('finds the common ancestor for multiple paths', () => {
    expect(
      getCommonAncestor([
        '/Users/carlba/Library/Preferences/calibre',
        '/Users/carlba/Calibre Library',
      ])
    ).toBe('/Users/carlba');
  });

  it('returns root when there is no deeper common ancestor', () => {
    expect(getCommonAncestor(['/etc/hosts', '/var/log/syslog'])).toBe('/');
  });
});

describe('getRelativePath', () => {
  it('computes relative paths from a common ancestor', () => {
    expect(getRelativePath('/Users/carlba/Calibre Library', '/Users/carlba')).toBe(
      'Calibre Library'
    );
  });
});

describe('resolvePlatformPath', () => {
  it('returns the darwin path on darwin', () => {
    const platforms = { darwin: '/mac/path', linux: '/linux/path' };
    expect(resolvePlatformPath(platforms, 'darwin')).toBe('/mac/path');
  });

  it('returns the linux path on linux', () => {
    const platforms = { darwin: '/mac/path', linux: '/linux/path' };
    expect(resolvePlatformPath(platforms, 'linux')).toBe('/linux/path');
  });

  it('falls back to "all" when the current platform key is absent', () => {
    const platforms = { all: '/universal/path' };
    expect(resolvePlatformPath(platforms, 'darwin')).toBe('/universal/path');
  });

  it('returns undefined when no matching key and no "all" fallback', () => {
    const platforms = { linux: '/linux/path' };
    expect(resolvePlatformPath(platforms, 'darwin')).toBeUndefined();
  });

  it('returns undefined for unsupported platforms without "all" key', () => {
    const platforms = { darwin: '/mac/path', linux: '/linux/path' };
    expect(resolvePlatformPath(platforms, 'win32')).toBeUndefined();
  });

  it('returns "all" for unsupported platforms that have "all" key', () => {
    const platforms = { darwin: '/mac/path', all: '/universal/path' };
    expect(resolvePlatformPath(platforms, 'win32')).toBe('/universal/path');
  });
  it('expands home directory shorthand to the actual home path', () => {
    const platforms = { linux: '~/some/path' };
    expect(resolvePlatformPath(platforms, 'linux')).toBe(`${homedir()}/some/path`);
  });
});

describe('resolveApplicationPaths', () => {
  it('resolves paths for darwin', () => {
    const app = EXAMPLE_CONFIG.syncify_applications.calibre;
    const paths = resolveApplicationPaths(app, 'darwin');

    expect(paths).toHaveLength(2);
    expect(paths[0].resolvedPath).toBe('/Users/carlba/Library/Preferences/calibre');
    expect(paths[1].resolvedPath).toBe('/Users/carlba/Calibre Library');
  });

  it('resolves paths for linux', () => {
    const app = EXAMPLE_CONFIG.syncify_applications.calibre;
    const paths = resolveApplicationPaths(app, 'linux');

    expect(paths).toHaveLength(2);
    expect(paths[0].resolvedPath).toBe('/home/carlba/.config/calibre');
    expect(paths[1].resolvedPath).toBe('/home/carlba/Calibre Library');
  });

  it('skips paths without a matching platform', () => {
    const app = EXAMPLE_CONFIG.syncify_applications.calibre;
    // win32 has no entry and no "all" fallback
    const paths = resolveApplicationPaths(app, 'win32');

    expect(paths).toHaveLength(0);
  });

  it('preserves the path name and type', () => {
    const app = EXAMPLE_CONFIG.syncify_applications.calibre;
    const paths = resolveApplicationPaths(app, 'darwin');

    expect(paths[0].name).toBe('config');
    expect(paths[0].type).toBe('folder');
  });
});

describe('resolveApplications', () => {
  it('returns only enabled applications', () => {
    const apps = resolveApplications(EXAMPLE_CONFIG, 'darwin');
    const names = apps.map(application => application.name);

    expect(names).toContain('calibre');
    expect(names).not.toContain('disabled_app');
  });

  it('includes restic tags', () => {
    const apps = resolveApplications(EXAMPLE_CONFIG, 'darwin');
    const calibre = apps.find(application => application.name === 'calibre');

    expect(calibre?.resticTags).toEqual(['app:calibre', 'source:desktop']);
  });
});

describe('resolveApplication', () => {
  it('returns a matching enabled application', () => {
    const app = resolveApplication(EXAMPLE_CONFIG, 'calibre', 'darwin');

    expect(app).toBeDefined();
    expect(app?.name).toBe('calibre');
    expect(app?.paths.map(path => path.resolvedPath)).toEqual([
      '/Users/carlba/Library/Preferences/calibre',
      '/Users/carlba/Calibre Library',
    ]);
  });

  it('returns undefined for disabled applications', () => {
    const app = resolveApplication(EXAMPLE_CONFIG, 'disabled_app', 'darwin');

    expect(app).toBeUndefined();
  });
});
