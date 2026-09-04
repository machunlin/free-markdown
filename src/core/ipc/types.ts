import type {
  EncodingDetectResult,
  FileChangedEvent,
  FileContent,
  FileInfo,
} from '../../types';

export type { EncodingDetectResult, FileChangedEvent, FileContent, FileInfo };

export interface SaveFileInput {
  path: string;
  content: string;
  encoding: string;
}

export interface SaveDialogInput {
  defaultPath?: string;
}
