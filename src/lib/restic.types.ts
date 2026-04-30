export interface ResticSnapshotSummary {
  backup_start: string;
  backup_end: string;
  files_new: number;
  files_changed: number;
  files_unmodified: number;
  dirs_new: number;
  dirs_changed: number;
  dirs_unmodified: number;
  data_blobs: number;
  tree_blobs: number;
  data_added: number;
  data_added_packed: number;
  total_files_processed: number;
  total_bytes_processed: number;
}

export interface ResticSnapshot {
  time: string;
  tree: string;
  paths: string[];
  hostname: string;
  username: string;
  uid: number;
  gid: number;
  tags: string[];
  program_version: string;
  summary: ResticSnapshotSummary;
  id: string;
  short_id: string;
}
