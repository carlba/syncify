import { z } from 'zod';

export const PlatformsSchema = z
  .object({
    darwin: z.string().optional(),
    linux: z.string().optional(),
    all: z.string().optional(),
  })
  .refine(data => data.darwin !== undefined || data.linux !== undefined || data.all !== undefined, {
    message: 'At least one platform key (darwin, linux, all) must be defined',
  });

export const PathEntrySchema = z.object({
  name: z.string(),
  type: z.enum(['file', 'folder']),
  platforms: PlatformsSchema,
});

export const ApplicationSchema = z.object({
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  restic_tags: z.array(z.string()).default([]),
  paths: z.array(PathEntrySchema).default([]),
});

export const SyncifyConfigSchema = z.object({
  exclude_patterns: z.array(z.string()).default([]),
  syncify_applications: z.record(z.string(), ApplicationSchema),
});

export type PlatformKey = 'darwin' | 'linux' | 'all';
export type Platforms = z.infer<typeof PlatformsSchema>;
export type PathEntry = z.infer<typeof PathEntrySchema>;
export type Application = z.infer<typeof ApplicationSchema>;
export type SyncifyConfig = z.infer<typeof SyncifyConfigSchema>;
