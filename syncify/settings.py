
from typing import TypedDict, List

Settings = TypedDict('Settings', {'tarfile_output_path': str, 'compress': bool, 'excludes': List[str]})

settings = {
  "tarfile_output_path": "~/gdrive/Backup/syncify.tar.gz",
  "compress": True,
  "excludes": [
    "/media/Windows/Users/genzo/Dropbox/transfer",
    ".cache",
    "VirtualBox VMs",
    "Downloads",
    ".vagrant.d",
    ".dropbox",
    "venv",
    "Videos",
    "*.pyc",
    "compile-cache",
    "*.tmp",
    "*.*~",
    "nohup.out",
    "system/caches",
    "node_modules",
    "Cache",
    "cache",
    "facebook_data",
    "*.mp4",
    "social-log/messages",
    "*.sock",
    "Containers",
    "Group Containers"
  ]
}
