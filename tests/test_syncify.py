# coding=utf-8

"""

https://github.com/jmcgeheeiv/pyfakefs

"""


import os

from click.testing import CliRunner
import unittest

from .context import syncify

from mock import patch
from pyfakefs.fake_filesystem_unittest import Patcher


class SyncifyTests(unittest.TestCase):

    def testStore(self):

        applications = {
            'application': {
                'description': 'A Sample application',
                'paths': {'darwin': '.config/app'}
            }
        }

        runner = CliRunner()
        with Patcher() as patcher:
            # noinspection PyUnresolvedReferences
            with patch.multiple(syncify.core, applications=applications):
                os.umask(0o022)
                patcher.fs.CreateFile('.config/app/config.ini', contents='test', apply_umask=True)

                result = runner.invoke(syncify.store, ['application'], catch_exceptions=False)
                assert os.path.isdir('.config')

                assert os.path.isfile(os.path.join(syncify.core.script_dir_path, 'application.tar'))

        print(result)
