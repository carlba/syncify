from typing import List, NotRequired, TypedDict, Dict

Platform = TypedDict(
    'Platform', {'darwin': NotRequired[str], 'linux2': NotRequired[str], 'all': NotRequired[str]}
)
Path = TypedDict('Path', {'name': str, 'type': str, 'platforms': Platform})
Application = TypedDict(
    'Application', {'description': str, 'url': NotRequired[str], 'paths': List[Path]}
)

applications: Dict[str, Application] = {
    "transgui": {
        "description": "Transmission Remote GUI",
        "paths": [
            {
                "name": "config",
                "type": "folder",
                "platforms": {"darwin": "$HOME/.config/Transmission Remote GUI"},
            }
        ],
    },
    "development": {
        "description": "My development stuff",
        "url": "https://github.com/carlba",
        "paths": [
            {"name": "personal", "type": "folder", "platforms": {"all": "$HOME/development"}},
            {"name": "pocketlaw", "type": "folder", "platforms": {"all": "$HOME/pocketlaw"}},
        ],
    },
    "iterm2": {
        "description": "iTerm2",
        "url": "https://https://www.iterm2.com/",
        "paths": [
            {
                "name": "config",
                "type": "file",
                "platforms": {"darwin": "$HOME/Library/Preferences/com.googlecode.iterm2.plist"},
            }
        ],
    },
    "calibre": {
        "description": "Calibre",
        "url": "https://manual.calibre-ebook.com/faq.html",
        "enabled": False,
        "paths": [
            {
                "name": "config",
                "type": "folder",
                "platforms": {"darwin": "$HOME/Library/Preferences/calibre"},
            },
            {"name": "library", "type": "folder", "platforms": {"darwin": "$HOME/Calibre Library"}},
        ],
    },
    "settings": {
        "description": "MacOS Settings",
        "url": "none",
        "paths": [{"name": "config", "type": "folder", "platforms": {"darwin": "$HOME/settings"}}],
    },
    "hammerspoon": {
        "description": "Hammerspoon settings",
        "url": "none",
        "enabled": False,
        "paths": [
            {"name": "config", "type": "folder", "platforms": {"darwin": "$HOME/.hammerspoon"}}
        ],
    },
    "vscode": {
        "description": "VSCODE settings",
        "url": "https://code.visualstudio.com/docs/getstarted/settings",
        "paths": [
            {
                "name": "user_settings",
                "type": "folder",
                "platforms": {"darwin": "$HOME/Library/Application Support/Code/User"},
            },
            {
                "name": "workspace",
                "type": "folder",
                "platforms": {"darwin": "$HOME/.vscode", "linux2": "$HOME/.vscode"},
            },
        ],
    },
    "dash": {
        "description": "Dash Settings",
        "url": "none",
        "enabled": False,
        "paths": [
            {
                "name": "config",
                "type": "folder",
                "platforms": {"darwin": "$HOME/Library/Application Support/Dash"},
            },
            {
                "name": "com.kapeli.dashdoc.plist",
                "type": "file",
                "platforms": {"darwin": "$HOME/Library/Preferences/com.kapeli.dashdoc.plist"},
            },
        ],
    },
    "tmux": {
        "description": "tmux",
        "url": "none",
        "paths": [
            {"name": "tmux", "type": "folder", "platforms": {"darwin": "$HOME/.tmux"}},
            {"name": "tmux config", "type": "file", "platforms": {"darwin": "$HOME/.tmux.conf"}},
            {
                "name": "tmuxp config",
                "type": "folder",
                "platforms": {"darwin": "$HOME/.config/tmuxp"},
            },
        ],
    },
    "ohmyzsh": {
        "description": "ohmyzsh",
        "url": "none",
        "paths": [
            {"name": ".zprofile", "type": "file", "platforms": {"darwin": "$HOME/.zprofile"}},
            {"name": ".zshrc", "type": "file", "platforms": {"darwin": "$HOME/.zshrc"}},
            {"name": "ohmyzsh", "type": "folder", "platforms": {"darwin": "$HOME/.oh-my-zsh"}},
            {"name": "vivid", "type": "folder", "platforms": {"darwin": "$HOME/.config/vivid"}},
        ],
    },
    "alfred": {
        "description": "alfred",
        "url": "none",
        "paths": [
            {
                "name": "app_support",
                "type": "folder",
                "platforms": {"darwin": "$HOME/Library/Application Support/Alfred"},
            }
        ],
    },
}
