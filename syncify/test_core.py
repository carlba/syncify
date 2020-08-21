import os

import pathlib

from click.testing import CliRunner
from syncify.core import rsync_to, rsync, store, load, extract_archive

import mock


settings = {"tarfile_output_path": "$HOME/transfer/syncify.tar.gz"}

applications = {
  "transgui": {
    "description": "Transmission Remote GUI",
    "paths": [
      {
        "name": "config",
        "type": "folder",
        "platforms": {
          "darwin": "$HOME/.config/Transmission Remote GUI"
        }
      }
    ]
  },
  "pycharm": {
    "description": "PyCharm2020.2",
    "paths": [
      {
        "name": "config",
        "type": "folder",
        "platforms": {
          "darwin": "$HOME/Library/Application Support/JetBrains/PyCharm2020.2",
          "linux2": None
        }
      }
    ]
  },
  "webstorm": {
    "description": "WebStorm2020.2",
    "url": "https://www.jetbrains.com/help/webstorm/directories-used-by-webstorm-to-store-settings-caches-plugins-and-logs.html",
    "paths": [
      {
        "name": "config",
        "type": "folder",
        "platforms": {
          "darwin": "$HOME/Library/Application Support/JetBrains/WebStorm2020.2",
          "linux": None
        }
      }
    ]
  },
  "development": {
    "description": "My development stuff",
    "url": "https://github.com/carlba",
    "paths": [
      {
        "name": "personal",
        "type": "folder",
        "platforms": {
          "all": "$HOME/development"
        }
      },
      {
        "name": "work",
        "type": "folder",
        "platforms": {
          "all": "$HOME/bsdev"
        }
      }
    ]
  },
  "iterm2": {
    "description": "iTerm2",
    "url": "https://https://www.iterm2.com/",
    "paths": [
      {
        "name": "config",
        "type": "file",
        "platforms": {
          "darwin": "$HOME/Library/Preferences/com.googlecode.iterm2.plist"
        }
      }
    ]
  },
  "calibre": {
    "description": "Calibre",
    "url": "https://manual.calibre-ebook.com/faq.html",
    "paths": [
      {
        "name": "config",
        "type": "folder",
        "platforms": {
          "darwin": "$HOME/Library/Preferences/calibre"
        }
      },
      {
        "name": "library",
        "type": "folder",
        "platforms": {
          "darwin": "$HOME/Calibre Library"
        }
      }
    ]
  },
  "settings": {
    "description": "MacOS Settings",
    "url": "none",
    "paths": [
      {
        "name": "config",
        "type": "folder",
        "platforms": {
          "darwin": "$HOME/settings"
        }
      }
    ]
  },
  "hammerspoon": {
    "description": "Hammerspoon settings",
    "url": "none",
    "paths": [
      {
        "name": "config",
        "type": "folder",
        "platforms": {
          "darwin": "$HOME/.hammerspoon"
        }
      }
    ]
  },
  "vscode": {
    "description": "VSCODE settings",
    "url": "https://code.visualstudio.com/docs/getstarted/settings",
    "paths": [
      {
        "name": "settings_file",
        "type": "file",
        "platforms": {
          "darwin": "$HOME/Library/Application Support/Code/User/settings.json",
          "linux2": "$HOME/.config/Code/User/settings.json"
        }
      },
      {
        "name": "workspace",
        "type": "folder",
        "platforms": {
          "darwin": "$HOME/.vscode",
          "linux2": "$HOME/.vscode"
        }
      }
    ]
  }
}


settings = {
  "tarfile_output_path": "$HOME/gdrive/transfer/syncify.tar.gz"
}


def test_folder_is_synced_properly(mocker):
    patched_rsync = mocker.patch('syncify.core.rsync', return_value=None)
    rsync_to(pathlib.Path('/users/cbackstrom/.config/syncify/development_personal'),
             pathlib.Path('/users/cbackstrom/development'), 'folder', False)

    args, kwargs = patched_rsync.call_args

    assert args[3] == '/users/cbackstrom/.config/syncify/development_personal/'
    assert args[4] == '/users/cbackstrom/development'


def test_file_is_synced_properly(mocker):
    patched_rsync = mocker.patch('syncify.core.rsync', return_value=None)
    rsync_to(pathlib.Path('/users/cbackstrom/.config/syncify/development_personal/settings.json'),
             pathlib.Path('/users/cbackstrom/development/settings.json'), 'file', False)

    args, kwargs = patched_rsync.call_args

    assert args[3] == '/users/cbackstrom/.config/syncify/development_personal/settings.json'
    assert args[4] == '/users/cbackstrom/development/'


def test_file_is_synced_properly_other_way(mocker):
    patched_rsync = mocker.patch('syncify.core.rsync', return_value=None)
    rsync_to(pathlib.Path('/users/cbackstrom/development/settings.json'),
             pathlib.Path('/users/cbackstrom/.config/syncify/development_personal/settings.json'), 'file', False)

    args, kwargs = patched_rsync.call_args

    assert args[3] == '/users/cbackstrom/development/settings.json'
    assert args[4] == '/users/cbackstrom/.config/syncify/development_personal/'


def test_it_is_not_possible_to_store_non_defined_app(mocker):

    patched_rsync = mocker.patch('syncify.core.rsync', return_value=None)
    mocker.patch('syncify.core.extract_archive', return_value=None)
    mocker.patch('syncify.core.read_applications', return_value=applications)

    runner = CliRunner()

    result = runner.invoke(load, ['NonExistingApp'],
                           obj={'output_path': '$HOME/.config/syncify', 'dry_run': False})

    assert f'Application NonExistingApp is not defined' in result.output
    patched_rsync.assert_not_called()


def test_it_is_not_possible_to_load_non_defined_app(mocker):

    patched_rsync = mocker.patch('syncify.core.rsync', return_value=None)
    mocker.patch('syncify.core.read_applications', return_value=applications)
    mocker.patch('syncify.core.extract_archive', return_value=None)

    runner = CliRunner()

    result = runner.invoke(load, ['NonExistingApp'],
                           obj={'output_path': '$HOME/.config/syncify', 'dry_run': False})

    assert f'Application NonExistingApp is not defined' in result.output
    patched_rsync.assert_not_called()


def test_loading_folder(mocker):

    application_name = 'pycharm'
    application = applications[application_name]
    application_path = application['paths'][0]

    patched_rsync = mocker.patch('syncify.core.rsync', return_value=None)
    mocker.patch('syncify.core.read_applications', return_value=applications)
    mocker.patch('syncify.core.extract_archive', return_value=None)

    runner = CliRunner()

    result = runner.invoke(load, [application_name],
                           obj={'output_path': '$HOME/.config/syncify', 'dry_run': False})

    args, kwargs = patched_rsync.call_args

    assert args[3] == os.path.expandvars(os.path.expanduser(f'$HOME/.config/syncify/{application_name}_{application_path["name"]}')) + '/'
    assert args[4] == os.path.expandvars(os.path.expanduser(application_path['platforms']['darwin']))

def test_loading_file(mocker):

    application_name = 'iterm2'
    application = applications[application_name]
    application_path = application['paths'][0]

    patched_rsync = mocker.patch('syncify.core.rsync', return_value=None)
    mocker.patch('syncify.core.read_applications', return_value=applications)
    mocker.patch('syncify.core.extract_archive', return_value=None)

    runner = CliRunner()

    result = runner.invoke(load, [application_name],
                           obj={'output_path': '$HOME/.config/syncify', 'dry_run': False})

    args, kwargs = patched_rsync.call_args

    assert args[3] == os.path.expandvars(os.path.expanduser(f'$HOME/.config/syncify/{application_name}_{application_path["name"]}/com.googlecode.iterm2.plist'))
    assert args[4] == os.path.expandvars(os.path.expanduser(os.path.dirname(application_path['platforms']['darwin']))) + '/'


def test_storing_folder(mocker):

    application_name = 'pycharm'
    application = applications[application_name]
    application_path = application['paths'][0]

    patched_rsync = mocker.patch('syncify.core.rsync', return_value=None)
    mocker.patch('syncify.core.read_applications', return_value=applications)
    mocker.patch('syncify.core.extract_archive', return_value=None)
    mocker.patch('syncify.core.compress', return_value=None)

    runner = CliRunner()

    result = runner.invoke(store, [application_name],
                           obj={'output_path': '$HOME/.config/syncify', 'dry_run': False})

    args, kwargs = patched_rsync.call_args

    assert args[3] == os.path.expandvars(os.path.expanduser(application_path['platforms']['darwin'])) + '/'
    assert args[4] == os.path.expandvars(os.path.expanduser(f'$HOME/.config/syncify/{application_name}_{application_path["name"]}'))


def test_storing_file(mocker):

    application_name = 'iterm2'
    application = applications[application_name]
    application_path = application['paths'][0]

    patched_rsync = mocker.patch('syncify.core.rsync', return_value=None)
    mocker.patch('syncify.core.read_applications', return_value=applications)
    mocker.patch('syncify.core.extract_archive', return_value=None)
    mocker.patch('syncify.core.compress', return_value=None)

    runner = CliRunner()

    runner.invoke(store, [application_name],
                           obj={'output_path': '$HOME/.config/syncify', 'dry_run': False})

    args, kwargs = patched_rsync.call_args

    assert args[3] == os.path.expandvars(os.path.expanduser(application_path['platforms']['darwin']))
    assert args[4] == os.path.expandvars(os.path.expanduser(f'$HOME/.config/syncify/{application_name}_{application_path["name"]}')) + '/'


def test_extracting_rar(mocker):

    patched_tar: mock.Mock = mocker.patch('syncify.core.tar', return_value=None)
    os_chdir: mock.Mock = mocker.patch('os.chdir', return_value=None)

    extract_archive('/tmp/output', '/tmp/test.tar.gz')
    os_chdir.assert_any_call('/tmp')
    patched_tar.assert_called_once_with('-xzf', '/tmp/test.tar.gz')

