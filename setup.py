# coding=utf-8

from setuptools import setup, find_packages


setup(entry_points={'console_scripts': ['syncify = syncify.core:main']},
      name="syncify",
      version='1.0.0',
      options={},
      description='Syncs application data between systems',
      author='Carl Backstrom',
      packages=find_packages(),
      install_requires=['click', 'pathlib2', 'sh', 'scandir']
)