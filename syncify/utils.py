import contextlib
import fnmatch
import grp
import os
import pathlib
import shutil
import sys
import click

from sh import tar

from .applications import Path


def writeHeader():
    click.secho(f'=' * 60, fg='white')


@contextlib.contextmanager
def remember_cwd():
    curdir = os.getcwd()
    try:
        yield
    finally:
        os.chdir(curdir)


def expand_vars_user(path: str):
    return os.path.expandvars(os.path.expanduser(path))


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


def create_tar_path(output_path, application_name, path_name):
    return os.path.join(output_path, f'{application_name}_{path_name}')


def compress(path: str, out_path: str):
    click.echo(path)
    with remember_cwd():
        os.chdir(os.path.dirname(path))
        tar('-czf', out_path, 'syncify', _bg=True)


def extract_archive(path: str, output_path: str):
    with remember_cwd():
        if os.path.isdir(path):
            shutil.rmtree(path)
            pathlib.Path(path).mkdir(parents=True, exist_ok=True)
            click.echo(f'Recreated {path}')
        else:
            pathlib.Path(path).mkdir(parents=True, exist_ok=True)
            click.echo(f'Created {path}')
        os.chdir(os.path.dirname(path))
        print(tar('-xzf', expand_vars_user(output_path)))


def find_platform_path(path: Path):
    if 'all' in path['platforms']:
        return path['platforms']['all']
    elif sys.platform not in path['platforms'] or not path['platforms'][sys.platform]:
        return False
    else:
        return path['platforms'][sys.platform]
