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
import requests
from click.testing import CliRunner
# noinspection PyUnresolvedReferences
from sh import rsync, ssh, git, ErrorReturnCode_128, tar, pkill, hdiutil, open

from .logger import create_logger

headers = {
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
}

r = requests.get('https://raw.githubusercontent.com/carlba/syncify/master/applications.json',
                 headers=headers)
applications = r.json()

r = requests.get('https://raw.githubusercontent.com/carlba/syncify/master/settings.json',
                 headers=headers)
settings = r.json()

script_dir_path = os.path.dirname(os.path.realpath(__file__))

excludes = {'/media/Windows/Users/genzo/Dropbox/transfer', '.cache', 'VirtualBox VMs',
            'Downloads', '.vagrant.d', '.dropbox', 'venv', 'Videos', '*.pyc', "compile-cache",
            '*.tmp', '*.*~', 'nohup.out', 'system/caches', 'node_modules', 'Cache', 'cache',
            'facebook_data', '*.mp4', 'social-log/messages'}

tarfile_output_path = settings['tarfile_output_path']

logger = create_logger()

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


def format_for_rsync(path: pathlib.Path, filetype: str):
    return str(path.resolve()) + '/' if filetype == 'folder' else str(path.resolve())


def rsync_to(src: pathlib.Path, dst: pathlib.Path, filetype: str):
    if filetype == 'file':
        dst.parent.mkdir(parents=True, exist_ok=True)

    exclude_params = zip(len(excludes) * ['--exclude'], excludes)
    rsync('-rlt', '--out-format=%i: %n%L', '--max-size=200m',
          format_for_rsync(src, filetype), format_for_rsync(dst, filetype), delete=True, *exclude_params,
          _out=process_output)


def find_platform_path(path):
    if 'all' in path['platforms']:
        return path['platforms']['all']
    elif sys.platform not in path['platforms'] or not path['platforms'][sys.platform]:
        return False
    else:
        return path['platforms'][sys.platform]


@click.group()
@click.option('--output_path', '-o', type=click.Path(exists=True),
              default=expand_vars_user('$HOME/.config/syncify'))
@click.option('--dry-run', is_flag=True, default=False)
@click.pass_context
def cli(ctx, output_path, dry_run):
    ctx.obj['output_path'] = output_path
    ctx.obj['dry_run'] = dry_run


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
            for path in applications[application_name]['paths']:
                expanded_platform_path = pathlib.Path(expand_vars_user(find_platform_path(path)))
                dst_path = pathlib.Path(create_tar_path(ctx.obj['output_path'],
                                                        application_name, path['name']))
                click.secho(f'Syncing path {path["name"]} for application {application_name} '
                            f'from {dst_path.resolve()} to {expanded_platform_path.resolve()}',
                            fg='green')
                if not ctx.obj['dry_run']:
                    rsync_to(src=expanded_platform_path, dst=dst_path, filetype=path['type'])

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
        logger.info(f'Restoring application {application_name}')
        if not applications.get(application_name):
            raise click.UsageError('Application {} is not defined'.format(application_name))
        else:
            # pkill(application_name)
            for path in applications[application_name]['paths']:
                expanded_platform_path = pathlib.Path(expand_vars_user(find_platform_path(path)))
                dst_path = pathlib.Path(create_tar_path(ctx.obj['output_path'],
                                                        application_name, path['name']))
                if path['type'] == 'file':
                    dst_path = dst_path / expanded_platform_path.name

                click.secho(f'Syncing path {path["name"]} for application {application_name} '
                            f'from {dst_path.resolve()} to {expanded_platform_path.resolve()}',
                            fg='green')

                if not ctx.obj['dry_run']:
                    rsync_to(src=dst_path, dst=expanded_platform_path, filetype=path['type'])


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
