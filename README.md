# syncify

Declarative application backup tool powered by restic.

## Features

- Reads a YAML config that maps applications to paths per OS
- Resolves paths for `darwin`, `linux`, or a universal `all` fallback
- Wraps [restic](https://restic.net) to init, back up, restore, and
  list snapshots
- CLI built with [Commander](https://www.npmjs.com/package/commander)

## Installation

```bash
npm install
npm run build
npm link   # makes `syncify` available globally
```

### Password file

The password file contains a single line with the restic repository
password. Create it before running `init`:

```bash
echo "mysecretpassword" > ~/.config/syncify/password
chmod 600 ~/.config/syncify/password
```


## Usage

All commands accept `-r / --repo` and `-p / --password-file` to override
the default paths (`~/.config/syncify/repo` and
`~/.config/syncify/password`). The restic repository path can also be set with
`SYNCIFY_REPO_PATH`, the password-file path with `SYNCIFY_PASSWORD_FILE`, and the
REST backend credentials with `SYNCIFY_REST_USERNAME` and `SYNCIFY_REST_PASSWORD`.
Path arguments expand `~` to the current user home directory.

### Initialize a repository

```bash
syncify init --config syncify.yml
```

### Backup all enabled applications

```bash
syncify backup --config syncify.yml
```

Backup a single application:

```bash
syncify backup --config syncify.yml --app calibre
```

### Restore a snapshot

```bash
syncify restore --snapshot latest
syncify restore --snapshot abc123 --target /tmp/restore
```

Restore a configured application using the current platform path definitions:

```bash
syncify restore --config syncify.yml --app calibre --snapshot latest
```

When using `--app`, the configured resolved path is restored into the target
root instead of recreating the original absolute source path under the target.


### List snapshots

```bash
syncify snapshots
```

### Prune unused data

```bash
syncify prune --config syncify.yml
```
Removes unused data from the repository (global, not per app).

## Config format

```yaml
exclude_patterns:
  - .cache
  - node_modules
syncify_applications:
  calibre:
    description: "Calibre settings"
    enabled: true
    restic_tags:
      - app:calibre
      - source:desktop
    paths:
      - name: config
        type: folder
        platforms:
          darwin: "/Users/carlba/Library/Preferences/calibre"
          linux: "/home/carlba/.config/calibre"
      - name: library
        type: folder
        platforms:
          darwin: "/Users/carlba/Calibre Library"
          linux: "/home/carlba/Calibre Library"
```

## WezTerm

WezTerm stores configuration and runtime state in different places.

- Config file:
  - `~/.wezterm.lua`
  - `~/.config/wezterm/wezterm.lua` on Linux/XDG systems
  - `%USERPROFILE%\wezterm.lua` on Windows
- Persistent runtime state and logs:
  - `~/.local/share/wezterm` on Linux/macOS
  - `~/Library/Application Support/wezterm` on macOS
  - `%LOCALAPPDATA%\wezterm` on Windows

The data directory typically contains:

- `wezterm-gui-log-*.txt` GUI log files
- `gui-sock-*` Unix socket files used by the GUI multiplexer
- other runtime state such as window/session metadata

For backup, include the config file and the runtime data directory.
Socket files are ephemeral, so the important parts are the logs and
persistent session state rather than the live socket itself.

Example WezTerm config entry:

```yaml
syncify_applications:
  wezterm:
    description: "WezTerm terminal configuration"
    enabled: true
    restic_tags:
      - app:wezterm
      - source:desktop
    paths:
      - name: config
        type: file
        platforms:
          darwin: "/Users/carlba/.wezterm.lua"
          linux: "/Users/carlba/.wezterm.lua"
      - name: state
        type: folder
        platforms:
          darwin: "~/Library/Application Support/wezterm"
          linux: "~/.local/share/wezterm"
```

The `~` shorthand is expanded to the current user's home directory when the config is loaded.

## License

UNLICENSED
