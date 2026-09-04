import { invoke } from '@tauri-apps/api/core';
import type { FileContent, FileInfo, SaveFileInput, SaveDialogInput } from './types';

export const openFile = (path: string, encoding?: string) =>
  invoke<FileContent>('open_file', { path, encoding });

export const saveFile = (input: SaveFileInput) =>
  invoke<void>('save_file', {
    path: input.path,
    content: input.content,
    encoding: input.encoding,
  });

export const showSaveDialog = (input: SaveDialogInput = {}) =>
  invoke<string | null>('show_save_dialog', {
    defaultPath: input.defaultPath,
  });

export const readDirectory = (path: string) =>
  invoke<FileInfo[]>('read_directory', { path });

export const getRecentFiles = () => invoke<string[]>('get_recent_files');

export const setWindowTitle = (title: string) =>
  invoke<void>('set_title', { title });

export const toggleFullscreen = () => invoke<void>('toggle_fullscreen');
