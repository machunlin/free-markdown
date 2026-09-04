# Security Review Skill

## When to Use

Load this skill when:
- Adding new Tauri commands
- Modifying capabilities/permissions
- Working with file system access
- Handling user input
- Processing Markdown that may contain HTML
- Adding IPC commands or events
- Modifying CSP headers
- Using external URLs, links, or shell access
- Before merging any feature that touches the backend or file system
- Reviewing code for path traversal, injection, or data leaks

## Security Model

FreeMarkdown processes **local files** from the user's filesystem. The primary risks are:

1. **Filesystem access control** — prevent unauthorized file access or path traversal
2. **IPC input validation** — never trust data from the WebView
3. **Markdown/HTML injection** — sanitize rendered output (XSS is still relevant in WebView)
4. **Capability overreach** — don't grant more permissions than needed
5. **External URL handling** — don't open external pages in the app WebView
6. **Data leakage** — don't transmit file contents over network
7. **Dependency vulnerabilities** — audit added crates and npm packages

## Tauri 2 Security

### Capabilities (Least Privilege)

Tauri 2 uses capability files to define permissions. **Never use wildcard permissions.**

```json
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions for main window",
  "windows": ["main"],
  "permissions": [
    "core:default",

    // Dialogs - needed for open/save dialogs
    "dialog:allow-open",
    "dialog:allow-save",
    "dialog:allow-message",
    "dialog:allow-confirm",

    // Window - basic window management
    "core:window:allow-minimize",
    "core:window:allow-maximize",
    "core:window:allow-close",
    "core:window:allow-set-title",
    "core:window:allow-set-fullscreen",
    "core:window:allow-start-dragging",

    // Event system
    "core:event:allow-listen",
    "core:event:allow-emit",

    // App
    "core:app:allow-version",
    "core:app:allow-name",

    // NOTE: fs is intentionally NOT granted to WebView directly.
    // All file access goes through custom Rust commands that validate paths.
    // "fs:allow-read-file" — DO NOT add this; use scoped commands instead.
    // "shell:allow-execute" — DO NOT add this; no shell execution needed.
  ]
}
```

**Rules:**
1. File system access is ONLY through custom commands — never through the Tauri fs plugin directly from frontend
2. No shell plugin access
3. If a new permission is needed, justify it in the PR/commit message
4. Separate capabilities per window if multi-window in future

### Path Validation

**Every path from frontend must be validated before use.**

```rust
use std::path::{Path, PathBuf, Component};
use dirs;

pub fn validate_path(path: &str) -> Result<PathBuf, AppError> {
    let path = Path::new(path);

    // Canonicalize the path (resolves symlinks and ..)
    let canonical = path.canonicalize().map_err(|_| {
        AppError::InvalidPath(format!("Cannot resolve path: {}", path.display()))
    })?;

    // Check for path traversal (reject if any component is ".." after canonicalization,
    // though canonicalization handles this, double-check for safety)
    for component in path.components() {
        match component {
            Component::ParentDir => {
                return Err(AppError::InvalidPath(
                    "Path traversal detected".to_string()
                ));
            }
            _ => {}
        }
    }

    // Ensure path is within allowed directories
    // For now, allow any file the user explicitly selected
    // In future, restrict to workspace/opened folder
    if !canonical.is_file() && !canonical.is_dir() {
        return Err(AppError::InvalidPath(format!(
            "Path is not a file or directory: {}",
            canonical.display()
        )));
    }

    Ok(canonical)
}

pub fn validate_path_in_dir(path: &str, base_dir: &Path) -> Result<PathBuf, AppError> {
    let canonical = validate_path(path)?;
    let base_canonical = base_dir.canonicalize().map_err(|_| {
        AppError::InvalidPath("Base directory does not exist".to_string())
    })?;

    if !canonical.starts_with(&base_canonical) {
        return Err(AppError::InvalidPath(format!(
            "Path {} is outside of allowed directory {}",
            canonical.display(),
            base_canonical.display()
        )));
    }

    Ok(canonical)
}
```

### Command Input Validation

```rust
#[tauri::command]
pub async fn save_file(
    path: String,
    content: String,
    encoding: String,
) -> Result<(), AppError> {
    // Validate path
    let validated_path = validate_path(&path)?;

    // Validate encoding
    let encoding = Encoding::for_label(encoding.as_bytes())
        .ok_or(AppError::InvalidInput(format!("Unsupported encoding: {}", encoding)))?;

    // Validate content length (reject unreasonably large content)
    if content.len() > 100_000_000 {
        // 100MB limit for individual saves
        return Err(AppError::InvalidInput("File too large".to_string()));
    }

    // Encode and save
    let (encoded, _, had_errors) = encoding.encode(&content);
    if had_errors {
        // Warn but don't fail; use replacement characters
        tracing::warn!("Encoding errors when saving to {}", validated_path.display());
    }

    tokio::fs::write(&validated_path, &encoded).await?;
    Ok(())
}
```

## Content Security Policy (CSP)

Set a restrictive CSP in `tauri.conf.json`:

```jsonc
{
  "app": {
    "security": {
      "csp": "default-src 'self'; \
              script-src 'self'; \
              style-src 'self' 'unsafe-inline'; \
              img-src 'self' data: blob: https:; \
              font-src 'self' data:; \
              connect-src 'self' ipc: http://ipc.localhost; \
              media-src 'self' data: blob:; \
              frame-src 'none'; \
              object-src 'none'; \
              base-uri 'none'; \
              form-action 'none'; \
              frame-ancestors 'none';"
    }
  }
}
```

**Note:** `'unsafe-inline'` for styles is needed because of Tailwind's runtime and markdown preview styling. For production builds, consider using a hash-based CSP.

## Markdown/HTML Sanitization

Markdown preview renders HTML. Even though markdown-it is configured with `html: false`, always sanitize as defense in depth.

```tsx
// src/core/markdown/sanitize.ts
import DOMPurify from 'dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    // Allow MathML elements for KaTeX
    ADD_TAGS: [
      'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub',
      'mfrac', 'msqrt', 'mroot', 'mover', 'munder', 'mtable', 'mtr',
      'mtd', 'mlabeledtr', 'annotation', 'annotation-xml',
    ],
    // Allow KaTeX attributes
    ADD_ATTR: ['target', 'rel', 'aria-label', 'aria-hidden', 'role', 'style'],
    // Forbid dangerous elements
    FORBID_TAGS: ['script', 'iframe', 'form', 'object', 'embed', 'link'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    // Allow opening external links in new tab
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}
```

**External link handling:** All external links must open in the default browser:

```tsx
// In preview component, intercept link clicks:
function handleLinkClick(e: React.MouseEvent<HTMLDivElement>) {
  const target = e.target as HTMLElement;
  if (target.tagName === 'A') {
    const href = target.getAttribute('href');
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      e.preventDefault();
      openExternal(href); // Use Tauri shell plugin: open(href)
    }
  }
}
```

## File Handling Security

1. **No assumption of UTF-8** — always detect encoding or accept user-specified encoding
2. **Don't follow symlinks blindly** — validate that symlink targets are within allowed scope (or resolve and present warning)
3. **File extensions** — don't rely solely on extensions; check content markers when possible
4. **Temporary files** — if creating temp files, use OS temp directory and clean up
5. **Backup files** — auto-save backup files should be in the same directory or app data dir, not random locations
6. **File locking** — handle the case where a file is being edited by another application (external change detection already handles this)

## No Network Access by Default

FreeMarkdown is a **local file editor**. It should NOT make network requests except:
- Mermaid CDN (if not bundled) — bundle Mermaid locally instead
- KaTeX fonts — bundle locally
- Update checker (opt-in, V1.5+)

**Bundle all assets locally.** The app must work fully offline.

## Dependency Security

### NPM

- Run `pnpm audit` regularly
- Pin dependency versions (use lockfile)
- Prefer well-known, maintained packages
- Avoid packages with < 100 weekly downloads or < 10 GitHub stars
- Check for known CVEs before adding dependencies

### Cargo

- Run `cargo audit` regularly (install `cargo-audit`)
- Use `cargo deny` to check for duplicate/unsafe dependencies
- Pin versions in Cargo.toml
- Review unsafe code in dependencies
- Use `#![forbid(unsafe_code)]` where possible in application code (dependencies may use unsafe)

## Data Privacy

- FreeMarkdown collects zero telemetry (no analytics, no crash reports in V0.1-V1.0)
- Crash reporting (if added in V2.0) must be opt-in
- Files are never uploaded anywhere
- Recent file list is stored locally only
- Settings are stored locally only

## Security Review Checklist

Before completing any feature that touches security-sensitive areas:

- [ ] All new Tauri commands validate and canonicalize paths
- [ ] No wildcard permissions added to capability files
- [ ] New permissions are scoped to minimum required
- [ ] All IPC inputs validated (types, lengths, ranges)
- [ ] Markdown preview uses DOMPurify (sanitize)
- [ ] External links open in system browser (not in WebView)
- [ ] CSP not weakened (no `unsafe-eval`, no `*` sources)
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] No `eval()`, `new Function()`, or dynamic code execution
- [ ] No shell command execution from WebView
- [ ] Filesystem access is scoped
- [ ] No sensitive data logged (file contents, paths in debug logs are OK, but not in error reports)
- [ ] `pnpm audit` passes (no critical/high vulnerabilities)
- [ ] `cargo audit` passes
- [ ] Large files handled without memory exhaustion
- [ ] No SQL injection if using SQLite (use parameterized queries)
- [ ] Path traversal tested (../../../etc/passwd blocked)
