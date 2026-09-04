// Shared TypeScript type definitions for FreeMarkdown

export interface Tab {
  id: string;
  path: string | null;
  title: string;
  content: string;
  originalContent: string;
  encoding: string;
  isDirty: boolean;
  cursor: { line: number; column: number };
  scrollPosition: number;
  hibernated: boolean;
}

export interface FileContent {
  path: string;
  content: string;
  encoding: string;
  modified: number;
  size: number;
}

export interface FileInfo {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: number;
}

export interface EncodingDetectResult {
  encoding: string;
  confidence: number;
}

export interface FileChangedEvent {
  path: string;
  kind: 'modified' | 'deleted' | 'created' | 'renamed';
  modified: number;
}

export type EditorMode = 'source' | 'split' | 'preview' | 'focus';

export type MarkdownCompat = 'strict' | 'gfm' | 'extended';

export type ThemeName = 'office' | 'night' | 'programmer';

export type AppearanceMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  // General
  autoSave: boolean;
  autoSaveInterval: number;
  defaultEncoding: string;
  recentFilesLimit: number;

  // Editor
  editorFontFamily: string;
  editorFontSize: number;
  editorLineHeight: number;
  editorTabSize: number;
  editorShowLineNumbers: boolean;
  editorWordWrap: boolean;

  // Preview
  previewMarkdownMode: MarkdownCompat;
  previewFontFamily: string;
  previewFontSize: number;
  previewLineHeight: number;
  previewAllowHtml: boolean;
  previewMaxWidth: number;

  // Theme
  theme: ThemeName;
  appearance: AppearanceMode;

  // Markdown
  markdownTypographer: boolean;
  markdownBreaks: boolean;
  markdownLinkify: boolean;
}
