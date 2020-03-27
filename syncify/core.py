# coding=utf-8

import sys
import shutil
import os
import contextlib
import pathlib

import click
import psutil
import grp
import fnmatch
from click.testing import CliRunner
# noinspection PyUnresolvedReferences
from sh import rsync, ssh, git, ErrorReturnCode_128, tar, pkill, hdiutil, open


applications = {
    'transgui': {
        'description': 'Transmission Remote GUI',
        'paths': {'config': {'darwin': '$HOME/.config/Transmission Remote GUI'}}
    },
    'pycharm': {
        'description': 'PyCharm 2019.2',
        'paths': {'config': {'darwin': '$HOME/Library/Preferences/PyCharm2019.3',
                             'linux2': '$HOME/.PyCharm2019.3/config'},
                  'plugins': {'darwin': '$HOME/Library/Application Support/PyCharm2019.3',
                              'linux2': None}}
    },
    'webstorm': {
        'description': 'WebStorm 2019.2',
        'url': 'https://www.jetbrains.com/help/webstorm/directories-used-by-webstorm-to-store-settings-caches-plugins-and-logs.html',
        'paths': {'config': {'darwin': '$HOME/Library/Preferences/WebStorm2019.3',
                             'linux': '$HOME/.WebStorm2018.3/config'},
                  'plugins': {'darwin': '$HOME/Library/Application Support/WebStorm2019.3',
                              'linux2': None}}
    },
    'development': {
        'description': 'My development stuff',
        'url': 'https://github.com/carlba',
        'paths': {'personal': {'all': '$HOME/development'},
                  'work': {'all': '$HOME/bsdev'}}
    },
    'iterm2': {
        'description': 'iTerm2',
        'url': 'https://https://www.iterm2.com/',
        'paths': {'config': {'darwin': '$HOME/Library/Preferences/com.googlecode.iterm2.plist'}}
    },
    'calibre': {
        'description': 'Calibre',
        'url': 'https://manual.calibre-ebook.com/faq.html',
        'paths': {'config': {'darwin': '$HOME/Library/Preferences/calibre'},
                  'library': {'darwin': '$HOME/Calibre Library'}}
    },
    'settings': {
        'description': 'MacOS Settings',
        'url': 'none',
        'paths': {'config': {'darwin': '$HOME/settings'}}
    },
    'hammerspoon': {
        'description': 'Hammerspoon settings',
        'url': 'none',
        'paths': {'config': {'darwin': '$HOME/.hammerspoon'}}
    },
    'vscode': {
        'description': 'VSCODE settings',
        'url': 'https://code.visualstudio.com/docs/getstarted/settings',
        'paths': {
            'settings_file': {
                'darwin': '$HOME/Library/Application Support/Code/User/settings.json',
                'linux2': '$HOME/.config/Code/User/settings.json'
            },
            'workspace': {
                'darwin': '$HOME/.vscode',
                'linux2': '$HOME/.vscode'
            }
        }
    }
}

script_dir_path = os.path.dirname(os.path.realpath(__file__))

excludes = {'/media/Windows/Users/genzo/Dropbox/transfer', '.cache', 'VirtualBox VMs',
            'Downloads', '.vagrant.d', '.dropbox', 'venv', 'Videos', '*.pyc', "compile-cache",
            '*.tmp', '*.*~', 'nohup.out', 'system/caches', 'node_modules', 'Cache', 'cache',
            'facebook_data'}

tarfile_output_path = '$HOME/Google Drive/transfer/syncify.tar.gz'


@contextlib.contextmanager
def remember_cwd():
    curdir = os.getcwd()
    try:
        yield
    finally:
        os.chdir(curdir)


def expand_vars_user(path):
    return os.path.expandvars(os.path.expanduser(path))


def create_tar_path(output_path, application_name, path_name):
    return os.path.join(output_path, '{}_{}'.format(application_name, path_name))


def reset_tar_info(members):
    for tarinfo in members:
        tarinfo.uid = os.getuid()
        tarinfo.gid = os.getgid()
        tarinfo.uname = os.environ['USER']
        tarinfo.gname = grp.getgrgid(os.getgid()).gr_name
        yield tarinfo


def ignore_file(tarinfo):
    if fnmatch.fnmatch(tarinfo.name, '*/venv'):
        print('Matching' + tarinfo.name)
    else:
        return tarinfo


def process_output(line):
    click.echo(line, nl=False)


def rsync_to(src, dst):
    if os.path.isdir(src):
        src += '/'
    if os.path.isfile(src):
        pathlib.Path(dst).mkdir(parents=True, exist_ok=True)

    exclude_params = zip(len(excludes) * ['--exclude'], excludes)
    rsync('-rlt', '--out-format=%i: %n%L', src, dst + '/', delete=True, *exclude_params,
          _out=process_output)


def find_platform_path(path):
    if 'all' in path:
        return path['all']
    elif sys.platform not in path or not path[sys.platform]:
        return False
    else:
        return path[sys.platform]


@click.group()
@click.option('--output_path', '-o', type=click.Path(exists=True),
              default=expand_vars_user('$HOME/.config/syncify'))
@click.pass_context
def cli(ctx, output_path):
    ctx.obj['output_path'] = output_path


@cli.command()
@click.argument('application_names', nargs=-1)
@click.option('--clear-cache', '-c', is_flag=True)
@click.pass_context
def store(ctx, application_names, clear_cache):

    if clear_cache:
        shutil.rmtree(ctx.obj['output_path'], ignore_errors=False)
        pathlib.Path(ctx.obj['output_path']).mkdir(parents=True, exist_ok=True)
        click.echo('Cache is cleared!')

    if not application_names:
        application_names = applications.keys()

    for application_name in application_names:
        if not applications.get(application_name):
            raise click.UsageError('Application {} is not defined'.format(application_name))
        else:
            # pkill(application_name)
            for path_name, path in applications[application_name]['paths'].items():
                expanded_platform_path = expand_vars_user(find_platform_path(path))
                dst_path = create_tar_path(ctx.obj['output_path'], application_name, path_name)
                click.echo('Synchronizing {}:{}'.format(application_name, path_name), color='green')
                rsync_to(src=expanded_platform_path, dst=dst_path)

    with remember_cwd():
        if "pigz" in (p.name() for p in psutil.process_iter()):
            raise click.ClickException('Compression already active try again later')
        os.chdir(os.path.dirname(ctx.obj['output_path']))
        tar('--use-compress-program', '/usr/local/bin/pigz', '-czf',
            expand_vars_user(tarfile_output_path), 'syncify', _bg=True)


@cli.command()
@click.argument('application_names', nargs=-1)
@click.pass_context
def load(ctx, application_names):

    # if "tar" in (p.name() for p in psutil.process_iter()):
    #     raise click.ClickException('Compression already active try again later')

    with remember_cwd():
        if os.path.isdir(ctx.obj['output_path']):
            shutil.rmtree(ctx.obj['output_path'])
            pathlib.Path(ctx.obj['output_path']).mkdir(parents=True, exist_ok=True)
            click.echo('Recreated {}'.format(ctx.obj['output_path']))
        else:
            pathlib.Path(ctx.obj['output_path']).mkdir(parents=True, exist_ok=True)
            click.echo('Created {}'.format(ctx.obj['output_path']))

        os.chdir(os.path.dirname(ctx.obj['output_path']))
        print(tar('-xzf', expand_vars_user(tarfile_output_path)))

    if not application_names:
        application_names = applications.keys()

    for application_name in application_names:
        if not applications.get(application_name):
            raise click.UsageError('Application {} is not defined'.format(application_name))
        else:
            # pkill(application_name)
            for path_name, path in applications[application_name]['paths'].items():
                expanded_platform_path = expand_vars_user(find_platform_path(path))
                dst_path = create_tar_path(ctx.obj['output_path'], application_name, path_name)
                rsync_to(src=dst_path, dst=expanded_platform_path)


def test_cli_store():
    pass

    runner = click.testing.CliRunner()
    # result = runner.invoke(store, ['pycharm'], catch_exceptions=False)
    # print(result)
    result = runner.invoke(load, ['pycharm'], catch_exceptions=False)
    print(result)


def main():

    if 'DEBUG' in os.environ and os.environ['DEBUG'] == 1:
        runner = click.testing.CliRunner()
        result = runner.invoke(cli, ['--output_path', '/Users/cada/.config/syncify', 'store'],
                               catch_exceptions=False)
        print(result)
    else:
        cli(obj={})


if __name__ == '__main__':
    main()

    # test_cli_store()
