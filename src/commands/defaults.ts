import { homedir } from 'node:os';
import { join } from 'node:path';

const SYNCIFY_BASE_DIR = join(homedir(), '.config', 'syncify');

export const DEFAULT_REPO_PATH = join(SYNCIFY_BASE_DIR, 'repo');
export const DEFAULT_PASSWORD_FILE = join(SYNCIFY_BASE_DIR, 'password');
export const DEFAULT_RESTORE_TARGET = join(SYNCIFY_BASE_DIR, 'restore');
