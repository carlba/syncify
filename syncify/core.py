# coding=utf-8

import json
import sys
import shutil
import os
import contextlib
import pathlib
from typing import Dict, List, TypedDict

import click
import psutil
import grp
import fnmatch
import requests
from click.testing import CliRunner
from sh import rsync

from syncify.utils import compress, create_tar_path, expand_vars_user, extract_archive, find_platform_path, writeHeader  # type: ignore

from .logger import create_logger
from typing import Dict, KeysView

from .applications import Application, applications, Path
from .settings import settings

ENABLED_APPLICATIONS = {
    name: app for name, app in applications.items() if 'enabled' not in app or app['enabled']
}

HEADERS = {"Cache-Control": "no-cache", "Pragma": "no-cache"}
SCRIPT_DIR_PATH = os.path.dirname(os.path.realpath(__file__))
CACHE_PATH = expand_vars_user('$HOME/.config/syncify')
LOGGER = create_logger()
TARFILE_OUTPUT_PATH = expand_vars_user(settings['tarfile_output_path'])
EXCLUDES = settings['excludes']


def process_output(line):
    click.secho(line, nl=False, fg='blue')


def rsync_to(src: pathlib.Path, dst: pathlib.Path, filetype: str, dry_run: bool):
    """
    Synchronize files or directories from a source to a destination using rsync.

    Parameters:
    src (pathlib.Path): The source path to sync from.
    dst (pathlib.Path): The destination path to sync to.
    filetype (str): The type of the source, either 'file' or 'folder'.
    dry_run (bool): If True, perform a trial run with no changes made.

    Rsync options:
        - -r: Recurse into directories.
        - -l: Copy symlinks as symlinks.
        - -t: Preserve modification times.
        - --max-size=500m: Skip files larger than 500 megabytes.
        - --stats: Give some file-transfer stats.
        - --exclude: Exclude files matching the specified patterns.
        - --delete: Delete extraneous files from destination directories.

    Returns:
    None
    """
    if filetype == 'file':
        dst.parent.mkdir(parents=True, exist_ok=True)

    src_string = str(src) + '/' if filetype == 'folder' else str(src)
    dst_string = str(dst) if filetype == 'folder' else str(dst.parent) + '/'

    click.secho(f'Syncing path from {src_string} to {dst_string}', fg='green')

    exclude_params = zip(len(EXCLUDES) * ['--exclude'], EXCLUDES)
    if not dry_run:
        rsync(
            '-rlt',
            '--max-size=500m',
            '--stats',
            src_string,
            dst_string,
            delete=True,
            *exclude_params,
            _out=process_output,
        )


def get_sync_paths(
    applications: Dict[str, Application],
    expanded_output_path: str,
    application_names: KeysView[str],
):
    if not application_names:
        application_names = applications.keys()

    for application_name in application_names:
        if not applications.get(application_name):
            raise click.UsageError(f'Application {application_name} is not defined')
        else:
            # pkill(application_name)
            for path in applications[application_name]['paths']:
                expanded_platform_path = pathlib.Path(expand_vars_user(find_platform_path(path)))
                archive_path = pathlib.Path(
                    create_tar_path(expanded_output_path, application_name, path['name'])
                )

                if path['type'] == 'file':
                    archive_path = archive_path / expanded_platform_path.name
                yield expanded_platform_path, archive_path, path, application_name


@click.group()
@click.option(
    '--output_path',
    '-o',
    type=click.Path(exists=True),
    default=expand_vars_user('$HOME/.config/syncify'),
)
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
        extract_archive(expanded_output_path, TARFILE_OUTPUT_PATH)

    for sync_path in get_sync_paths(ENABLED_APPLICATIONS, expanded_output_path, application_names):
        local_path, archive_path, path, application_name = sync_path
        writeHeader()
        click.secho(f'Syncing path {path["name"]} for application {application_name} ', fg='green')

        if not os.path.exists(local_path):
            click.secho(f'{local_path} does not exist moving on', fg='yellow')
        else:
            rsync_to(local_path, archive_path, path['type'], ctx.obj['dry_run'])

    if not ctx.obj['dry_run'] and settings['compress']:
        compress(expanded_output_path, TARFILE_OUTPUT_PATH)


@cli.command()
@click.argument('application_names', nargs=-1)
@click.pass_context
def load(ctx, application_names):
    expanded_output_path = expand_vars_user(ctx.obj['output_path'])

    if not ctx.obj['dry_run'] and settings['compress']:
        extract_archive(expanded_output_path, TARFILE_OUTPUT_PATH)

    for sync_path in get_sync_paths(ENABLED_APPLICATIONS, expanded_output_path, application_names):
        local_path, archive_path, path, application_name = sync_path
        click.secho(f'Syncing path {path["name"]} for application {application_name} ', fg='green')
        if not os.path.exists(archive_path):
            click.secho(f'{archive_path} does not exist moving on', fg='yellow')
        else:
            rsync_to(archive_path, local_path, path['type'], ctx.obj['dry_run'])


@cli.command()
@click.argument('application_names', nargs=-1)
@click.pass_context
def list(ctx, application_names):
    print('Applications: \n' + '\n'.join(applications.keys()) + '\n')
    print('Enabled Applications: \n' + '\n'.join(ENABLED_APPLICATIONS.keys()))


def test_cli_store():
    runner = click.testing.CliRunner()  # type: ignore
    result = runner.invoke(load, ['pycharm'], catch_exceptions=False)
    print(result)


def main():
    if 'DEBUG' in os.environ and os.environ['DEBUG'] == 1:
        runner = click.testing.CliRunner()  # type: ignore
        result = runner.invoke(
            cli, ['--output_path', '/Users/cada/.config/syncify', 'store'], catch_exceptions=False
        )
        print(result)
    else:
        cli(obj={})


if __name__ == '__main__':
    main()

    # test_cli_store()
