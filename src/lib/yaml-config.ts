import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { load } from 'js-yaml';
import type { Application, PathEntry, SyncifyConfig } from '../syncify-schema.js';
import { SyncifyConfigSchema } from '../syncify-schema.js';

export interface ResolvedPath {
  name: string;
  type: PathEntry['type'];
  resolvedPath: string;
}

export interface ResolvedApplication {
  name: string;
  description: string | undefined;
  enabled: boolean;
  resticTags: string[];
  paths: ResolvedPath[];
}

/**
 * Read and parse the YAML config file.
 *
 * Throws if the file cannot be read or the YAML is invalid.
 */
export function readYamlConfig(filePath: string): SyncifyConfig {
  const resolvedPath = expandHomeDirectory(filePath);
  const raw = readFileSync(resolvedPath, 'utf-8');
  const parsed: unknown = load(raw);

  const result = SyncifyConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid config file: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Resolve the path for the current platform.
 *
 * Resolution order: current platform key → 'all' fallback → undefined (skip).
 */
export function expandHomeDirectory(inputPath: string): string {
  if (inputPath === '~') {
    return homedir();
  }

  if (inputPath.startsWith('~/')) {
    return path.join(homedir(), inputPath.slice(2));
  }

  return inputPath;
}

export function getCommonAncestor(paths: string[]): string {
  const resolvedPaths = paths.map(filePath => path.resolve(filePath));
  if (resolvedPaths.length === 0) {
    return path.sep;
  }

  if (resolvedPaths.length === 1) {
    return path.dirname(resolvedPaths[0]);
  }

  const segmentsList = resolvedPaths.map(resolvedPath => resolvedPath.split(path.sep));
  const [firstSegments, ...restSegments] = segmentsList;
  const commonSegments: string[] = [];

  for (let index = 0; index < firstSegments.length; index += 1) {
    const segment = firstSegments[index];
    if (restSegments.every(segments => segments[index] === segment)) {
      commonSegments.push(segment);
      continue;
    }
    break;
  }

  if (commonSegments.length === 0) {
    return path.sep;
  }

  const common = commonSegments.join(path.sep);
  const normalizedCommon = common === '' ? path.sep : common;

  if (resolvedPaths.some(resolvedPath => resolvedPath === normalizedCommon)) {
    return path.dirname(normalizedCommon);
  }

  return normalizedCommon;
}

export function getRelativePath(pathToConvert: string, root: string): string {
  return path.relative(root, path.resolve(pathToConvert));
}

export function resolvePlatformPath(
  platforms: PathEntry['platforms'],
  platform: NodeJS.Platform
): string | undefined {
  const platformKey = platform === 'darwin' ? 'darwin' : platform === 'linux' ? 'linux' : undefined;
  const resolved =
    platformKey !== undefined ? (platforms[platformKey] ?? platforms.all) : platforms.all;
  return resolved === undefined ? undefined : expandHomeDirectory(resolved);
}

/**
 * Resolve all paths for an application on the current platform.
 *
 * Paths without a matching platform entry are silently skipped.
 */
export function resolveApplicationPaths(
  app: Application,
  platform: NodeJS.Platform
): ResolvedPath[] {
  return app.paths.flatMap(entry => {
    const resolvedPath = resolvePlatformPath(entry.platforms, platform);
    if (resolvedPath === undefined) {
      return [];
    }
    return [{ name: entry.name, type: entry.type, resolvedPath }];
  });
}

/**
 * Return all enabled applications with their paths resolved for the current platform.
 */
export function resolveApplications(
  config: SyncifyConfig,
  platform: NodeJS.Platform = process.platform
): ResolvedApplication[] {
  return Object.entries(config.syncify_applications)
    .filter(([, app]) => app.enabled)
    .map(([name, app]) => ({
      name,
      description: app.description,
      enabled: app.enabled,
      resticTags: app.restic_tags,
      paths: resolveApplicationPaths(app, platform),
    }));
}

export function resolveApplication(
  config: SyncifyConfig,
  appName: string,
  platform: NodeJS.Platform = process.platform
): ResolvedApplication | undefined {
  return resolveApplications(config, platform).find(app => app.name === appName);
}
