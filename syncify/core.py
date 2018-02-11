# coding=utf-8

import tarfile
import sys
import click
from click.testing import CliRunner
import os, contextlib
import pathlib2 as pathlib
# noinspection PyUnresolvedReferences
from sh import pkill
import grp

applications = {
    'transgui': {
        'description': 'Transmission Remote GUI',
        'url': 'https://www.jetbrains.com/help/pycharm/directories-used-by-pycharm-to-store-settings-caches-plugins-and-logs.html',
        'paths': {'config': {'darwin': '$HOME/.config/Transmission Remote GUI'}}
    },
    'pycharm': {
        'description': 'PyCharm 2017.3',
        'paths': {'config': {'darwin': '$HOME/Library/Preferences/PyCharm2017.3'},
                  'plugins': {'darwin': '$HOME//Library/Application Support//PyCharm2017.3'}}
    },
    'webstorm': {
        'description': 'WebStorm 2017.3',
        'url': 'https://www.jetbrains.com/help/webstorm/directories-used-by-webstorm-to-store-settings-caches-plugins-and-logs.html',
        'paths': {'config': {'darwin': '$HOME/Library/Preferences/WebStorm2017.3'},
                  'plugins': {'darwin': '$HOME/Library/Application Support/WebStorm2017.3'}}
    },
    'development': {
        'description': 'My development stuff',
        'url': 'https://github.com/carlba',
        'paths': {'personal': {'darwin': '$HOME/development'},
                  'work': {'darwin': '$HOME/bsdev'}}
    }
}

script_dir_path = os.path.dirname(os.path.realpath(__file__))

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
    return os.path.join(output_path, '{}_{}.tar'.format(application_name, path_name))


def reset_tar_info(members):
    for tarinfo in members:
        tarinfo.uid = os.getuid()
        tarinfo.gid = os.getgid()
        tarinfo.uname = os.environ['USER']
        tarinfo.gname = grp.getgrgid(os.getgid()).gr_name
        yield tarinfo


@click.group()
@click.option('--output_path', '-o', type=click.Path(exists=True),
              default=script_dir_path)
@click.pass_context
def cli(ctx, output_path):
    ctx.obj['output_path'] = output_path


@cli.command()
@click.argument('application_names', nargs=-1)
@click.pass_context
def store(ctx, application_names):
    for application_name in application_names:
        if not applications.get(application_name):
            raise click.UsageError('Application {} is not defined'.format(application_name))
        else:
            # pkill(application_name)
            click.echo('Storing' + application_name)
            for path_name, path in applications[application_name]['paths'].viewitems():
                expanded_platform_path = expand_vars_user(path[sys.platform])
                if not os.path.isdir(expanded_platform_path):
                    raise click.UsageError("The {} path doesn't exists".format(
                        expanded_platform_path))
                else:
                    with remember_cwd():
                        os.chdir(os.path.dirname(expanded_platform_path))
                        output_tarfile_path = create_tar_path(ctx.obj['output_path'],application_name,
                                                              path_name)
                        with tarfile.open(output_tarfile_path, "w") as tar:
                            tar.add(os.path.basename(expanded_platform_path))


@cli.command()
@click.argument('application_names', nargs=-1)
@click.pass_context
def load(ctx, application_names):
    for application_name in application_names:
        if not applications.get(application_name):
            raise click.UsageError('Application {} is not defined'.format('name'))
        else:
            for path_name, path in applications[application_name]['paths'].viewitems():
                click.echo('Loading' + application_name)
                expanded_platform_path = expand_vars_user(path[sys.platform])
                pathlib.Path(expanded_platform_path).mkdir(parents=True, exist_ok=True)
                with tarfile.open(create_tar_path(ctx.obj['output_path'],
                                                  application_name, path_name)) as tar:
                    tar.extractall(path=os.path.dirname(expanded_platform_path),
                                   members=reset_tar_info(tar))


def test_cli_store():
    pass

    runner = click.testing.CliRunner()
    # result = runner.invoke(store, ['pycharm'], catch_exceptions=False)
    # print(result)
    result = runner.invoke(load, ['pycharm'], catch_exceptions=False)
    print(result)


def main():
    cli(obj={})


if __name__ == '__main__':
    main()

    # test_cli_store()
