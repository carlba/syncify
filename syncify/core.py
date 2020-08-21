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

script_dir_path = os.path.dirname(os.path.realpath(__file__))

logger = create_logger()


def read_settings():
    r = requests.get('https://raw.githubusercontent.com/carlba/syncify/master/settings.json',
                     headers=headers)
    return r.json()


def read_applications():
    return requests.get(
        'https://raw.githubusercontent.com/carlba/syncify/master/applications.json',
        headers=headers).json()


settings = read_settings()
tarfile_output_path = settings['tarfile_output_path']
applications = read_applications()
excludes = settings['excludes']


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
    return os.path.join(output_path, f'{application_name}_{path_name}')


def clear_path(path: str):
    with remember_cwd():
        if os.path.isdir(path):
            shutil.rmtree(path)
            pathlib.Path(path).mkdir(parents=True, exist_ok=True)
            click.echo(f'Recreated {path}')
        else:
            pathlib.Path(path).mkdir(parents=True, exist_ok=True)
            click.echo(f'Created {path}')


def compress(path: str):
    with remember_cwd():
        if "pigz" in (p.name() for p in psutil.process_iter()):
            raise click.ClickException('Compression already active try again later')
        os.chdir(os.path.dirname(path))
        tar('--use-compress-program', '/usr/local/bin/pigz', '-czf',
            expand_vars_user(tarfile_output_path), 'syncify', _bg=True)


def clear_cache(path: str):
    shutil.rmtree(path, ignore_errors=False)
    pathlib.Path(path).mkdir(parents=True, exist_ok=True)
    click.echo('Cache is cleared!')


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


def rsync_to(src: pathlib.Path, dst: pathlib.Path, filetype: str, dry_run: bool):
    if filetype == 'file':
        dst.parent.mkdir(parents=True, exist_ok=True)

    src_string = str(src) + '/' if filetype == 'folder' else str(src)
    dst_string = str(dst) if filetype == 'folder' else str(dst.parent) + '/'

    click.secho(f'Syncing path from {src_string} to {dst_string}', fg='green')

    exclude_params = zip(len(excludes) * ['--exclude'], excludes)
    if not dry_run:
        rsync('-rlt', '--max-size=200m', '--stats', src_string, dst_string, delete=True,
              *exclude_params, _out=process_output)


def find_platform_path(path):
    if 'all' in path['platforms']:
        return path['platforms']['all']
    elif sys.platform not in path['platforms'] or not path['platforms'][sys.platform]:
        return False
    else:
        return path['platforms'][sys.platform]


def get_sync_paths(applications: [], expanded_output_path: str, application_names: [] = None):
    if not application_names:
        application_names = applications.keys()

    for application_name in application_names:
        if not applications.get(application_name):
            raise click.UsageError(f'Application {application_name} is not defined')
        else:
            # pkill(application_name)
            for path in applications[application_name]['paths']:
                expanded_platform_path = pathlib.Path(expand_vars_user(find_platform_path(path)))
                archive_path = pathlib.Path(create_tar_path(expanded_output_path,
                                                            application_name, path['name']))

                if path['type'] == 'file':
                    archive_path = archive_path / expanded_platform_path.name
                yield expanded_platform_path, archive_path, path, application_name


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
    expanded_output_path = expand_vars_user(ctx.obj['output_path'])

    if clear_cache:
        clear_path(expanded_output_path)

    for sync_path in get_sync_paths(applications, expanded_output_path, application_names):
        local_path, archive_path, path, application_name = sync_path
        click.secho(f'Syncing path {path["name"]} for application {application_name} ',
                    fg='green')
        rsync_to(local_path, archive_path, path['type'], ctx.obj['dry_run'])

    if not ctx.obj['dry_run']:
        compress(expanded_output_path)


@cli.command()
@click.argument('application_names', nargs=-1)
@click.pass_context
def load(ctx, application_names):
    expanded_output_path = expand_vars_user(ctx.obj['output_path'])

    if not ctx.obj['dry_run']:
        clear_path(expanded_output_path)

    for sync_path in get_sync_paths(applications, expanded_output_path, application_names):
        local_path, archive_path, path, application_name = sync_path
        click.secho(f'Syncing path {path["name"]} for application {application_name} ',
                    fg='green')
        rsync_to(archive_path, local_path, path['type'], ctx.obj['dry_run'])


def test_cli_store():
    pass

    runner = click.testing.CliRunner()
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
