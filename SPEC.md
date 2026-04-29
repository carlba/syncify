# Syncify — Specification

## Overview

Syncify is a declarative CLI tool for backing up and restoring application configuration files
using [restic](https://restic.net/) as the storage engine. Applications and their paths are
declared in a YAML config file. Syncify resolves the correct path per operating system, drives
restic commands, and tags every snapshot with application-specific metadata so restores can
select the correct snapshot automatically.

---

## Architecture

```
src/
  bin.ts                  Entry point — runs the CLI
  cli.ts                  Builds and exports the Commander program
  registry.ts             Creates the shared pino logger instance
  syncify-schema.ts       Zod schema and TypeScript types for the YAML config
  commands/
    init.ts               `init` command
    backup.ts             `backup` command
    restore.ts            `restore` command
    snapshots.ts          `snapshots` command
    defaults.ts           Shared default values for repo, password-file, and restore target
  lib/
    yaml-config.ts        Config loading, path expansion, platform resolution, path helpers
    restic.ts             Thin wrappers around the restic CLI (init, backup, restore, snapshots)
    logger.ts             Shared logger utilities
```

---

## Configuration File

The YAML config file declares all managed applications. The default location is user-controlled
via `--config`.

### Schema

```yaml
syncify_applications:
  <app-name>:
    description: string          # optional human-readable label
    enabled: boolean             # default: true
    restic_tags:                 # list of tags added to every restic snapshot
      - string
    paths:
      - name: string             # logical name for this path entry
        type: file | folder
        platforms:
          darwin: string         # macOS absolute path (~ is expanded)
          linux: string          # Linux absolute path (~ is expanded)
          all: string            # fallback for any platform not listed above
```

**Validation rules:**

- `syncify_applications` must contain at least one key.
- Each `paths` entry must define at least one of `darwin`, `linux`, or `all`.
- `type` must be `file` or `folder`.
- Missing or invalid YAML causes an immediate error with a descriptive message.

### Example

```yaml
syncify_applications:
  wezterm:
    description: 'WezTerm terminal configuration'
    enabled: true
    restic_tags:
      - app:wezterm
      - source:desktop
    paths:
      - name: config
        type: file
        platforms:
          darwin: '~/.config/.wezterm.lua'
          linux: '~/.wezterm.lua'

  calibre:
    description: 'Calibre settings'
    enabled: true
    restic_tags:
      - app:calibre
      - source:desktop
    paths:
      - name: config
        type: folder
        platforms:
          darwin: '~/Library/Preferences/calibre'
          linux: '~/.config/calibre'
      - name: library
        type: folder
        platforms:
          darwin: '~/Calibre Library'
          linux: '~/Calibre Library'
```

---

## Path Resolution

### Home directory expansion

`~` and `~/...` in config paths are expanded to the real home directory at runtime using
`os.homedir()`. This applies to:

- paths inside `platforms` entries in the config file
- `--repo`, `--password-file`, `--target` CLI flags

### Platform selection

For each path entry Syncify resolves the active path in this order:

1. The key matching the current platform (`darwin` or `linux`)
2. The `all` fallback key
3. If neither matches, the path is silently skipped for this platform

### Common ancestor computation

When an application has multiple paths, Syncify computes the deepest common ancestor
directory. This becomes the restic backup root. Each individual path is stored as a relative
path from that root inside the snapshot.

For a single-path application, the parent directory of the file or folder is used as the root,
and the filename is the relative path.

**Example — single file:**

- Configured path: `~/.wezterm.lua` → `/Users/carlba/.wezterm.lua`
- Root: `/Users/carlba`
- Relative path stored in snapshot: `.wezterm.lua`

**Example — two paths under different directories:**

- `/Users/carlba/Library/Preferences/calibre`
- `/Users/carlba/Calibre Library`
- Common ancestor: `/Users/carlba`
- Relative paths: `Library/Preferences/calibre`, `Calibre Library`

---

## Default Paths

All paths default to subdirectories of `~/.config/syncify/`:

| Value | Default |
|---|---|
| Repository | `~/.config/syncify/repo` |
| Password file | `~/.config/syncify/password` |
| Restore target | `~/.config/syncify/restore` |

---

## CLI Commands

All commands accept `-r / --repo` and `-p / --password-file` overrides. These default to the
values above.

---

### `init`

Initialize the restic repository. Idempotent — safe to run more than once.

```
syncify init --config <path> [--repo <path>] [--password-file <path>]
```

| Flag | Required | Description |
|---|---|---|
| `-c, --config` | yes | Path to the syncify YAML config (validated at startup) |
| `-r, --repo` | no | Repository path (default: `~/.config/syncify/repo`) |
| `-p, --password-file` | no | Password file path (default: `~/.config/syncify/password`) |

**Behaviour:**

1. Reads and validates the YAML config.
2. Calls `restic init`.
3. If the repository already exists restic exits with code 1 and an "already initialized"
   message — Syncify silently treats this as success.

---

### `backup`

Back up one or all enabled applications declared in the config.

```
syncify backup --config <path> [--app <name>] [--repo <path>] [--password-file <path>]
```

| Flag | Required | Description |
|---|---|---|
| `-c, --config` | yes | Path to the syncify YAML config |
| `-a, --app` | no | Restrict backup to a single named application |
| `-r, --repo` | no | Repository path |
| `-p, --password-file` | no | Password file path |

**Behaviour:**

1. Reads and validates the YAML config.
2. Resolves all enabled applications for the current platform.
3. If `--app` is given, filters to that single application.
4. For each application:
   - Computes the backup root (common ancestor for multi-path apps; parent directory for
     single-path apps).
   - Calls `restic backup` with relative paths from that root.
   - Tags the snapshot with all `restic_tags` defined in the config using `--tag` per tag.
5. Logs a warning and skips any application with no resolvable paths on the current platform.

---

### `restore`

Restore one application, all configured applications, or a raw snapshot.

```
syncify restore [--snapshot <id>] [--config <path>] [--app <name>]
                [--repo <path>] [--password-file <path>]
                [--target <path>] [--include <path>...]
```

| Flag | Required | Description |
|---|---|---|
| `-s, --snapshot` | no | Snapshot ID or `latest` (default: `latest`) |
| `-c, --config` | no | Path to the syncify YAML config |
| `-a, --app` | no | Restore a single named application (requires `--config`) |
| `-r, --repo` | no | Repository path |
| `-p, --password-file` | no | Password file path |
| `-t, --target` | no | Override the restore target directory |
| `-i, --include` | no | Additional include filters (repeatable) |

**Behaviour — three distinct modes:**

#### Mode 1: `--config --app <name>`

Restores a single application from the config.

1. Resolves the application and its paths for the current platform.
2. Computes the app root (common ancestor).
3. Determines the restore target:
   - `--target` if provided (after `~` expansion)
   - otherwise the app root (files are restored to their original location)
4. Builds `--include` patterns from all relative paths in the application.
5. When `--snapshot latest`, adds `--tag app-tags` to select only that application's latest
   snapshot.
6. Calls `restic restore` once for the application.

#### Mode 2: `--config` (no `--app`)

Restores all enabled applications in the config, one restic call per application.

Each application follows the same logic as Mode 1.

#### Mode 3: no `--config`

Plain snapshot restore, no YAML awareness.

1. Restores to `--target` if given, otherwise `~/.config/syncify/restore`.
2. Calls `restic restore <snapshot> --target <path>`.

---

### `snapshots`

List all snapshots in the repository.

```
syncify snapshots [--repo <path>] [--password-file <path>]
```

Delegates directly to `restic snapshots`.

---

## Snapshot Tagging

Backup snapshots are tagged with all `restic_tags` entries from the app config.

```
restic backup ... --tag app:wezterm --tag source:desktop ...
```

On `restore --snapshot latest`, Syncify passes a single comma-separated `--tag` argument to
restic to select only snapshots that contain **all** of those tags:

```
restic restore latest --tag app:wezterm,source:desktop ...
```

This ensures the correct app-specific latest snapshot is selected even when the repository
contains snapshots from multiple applications.

---

## File Restore Semantics

Restic's `snapshotID:subfolder` syntax fails for individual files because it expects a
directory path. Syncify avoids this by always restoring the full snapshot and filtering via
`--include` patterns:

```
restic restore <snapshot> --target <dir> --include <relative-path> ...
```

Each configured app path is passed as a separate `--include` argument so all files are
restored in a single restic call.

---

## Error Handling

- Invalid config files fail fast with a descriptive validation error.
- `--app` without `--config` is rejected immediately.
- Restic errors are caught and re-thrown with context (`restic <command> failed: ...`).
- The `init` command silently ignores "already initialized" errors.
- Applications with no platform-resolvable paths are skipped with a warning, not an error.
- All errors propagate to the CLI entry point which writes them to stderr and exits with code 1.

---

## Logging

Syncify uses [pino](https://getpino.io) for structured JSON logging. In development
(`start:dev`), pino-pretty formats output to the terminal.

Log fields include:

- `command` — the active CLI command
- `app` — application name where relevant
- `snapshot`, `target`, `repo` — restic arguments
- `pathCount`, `appCount` — counts for multi-path or multi-app operations

---

## Supported Platforms

| Platform | Key in config |
|---|---|
| macOS | `darwin` |
| Linux | `linux` |
| Any other | `all` (fallback only) |

Windows is not supported as a named platform key.
