# Documentation Skill

## When to Use

Load this skill when:
- Writing or updating README.md
- Updating CHANGELOG.md
- Writing doc comments (JSDoc, Rustdoc)
- Updating docs/ folder (ARCHITECTURE.md, TESTING.md, etc.)
- Writing inline code comments
- Writing commit messages
- Creating onboarding documentation
- Documenting APIs (IPC commands)
- Writing user-facing help text

## Documentation Principles

1. **Code should be self-documenting.** Comments explain *why*, not *what*. If code needs a comment to explain *what* it does, rename variables/functions first.
2. **Docs live with the code.** Architecture docs in `docs/`, IPC specs in `docs/`, code-level docs as comments/docstrings.
3. **Keep docs close to the code they describe.** IPC type definitions should be where the types are defined, not just in docs.
4. **Update docs in the same PR as code changes.** Stale docs are worse than no docs.
5. **Write for the reader.** AGENTS.md is for AI agents and future developers. ARCHITECTURE.md is for developers joining the project. README.md is for users and contributors.

## File-Specific Guidelines

### README.md

For users and new contributors. Should answer:
1. What is FreeMarkdown? (One paragraph)
2. Key features (bulleted list, from PRD)
3. Screenshot (once there is one)
4. How to install (once released)
5. How to build from source
6. How to develop (quick start)
7. Tech stack
8. License

Keep it concise. Detailed docs go in `docs/`.

### CHANGELOG.md

Keep a changelog following [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

## [Unreleased]

### Added
- Feature X
- Feature Y

### Changed
- Changed behavior of Z

### Fixed
- Bug in A
- Crash when opening B

## [0.1.0-alpha] - 2026-XX-XX

### Added
- Initial alpha release
- Basic source mode editing
- File open/save
- Multiple tabs
```

Update CHANGELOG.md as part of every feature PR.

### Inline Code Comments

**TypeScript/React:**
- Use JSDoc (`/** */`) for exported functions, hooks, and components
- Use `//` for internal comments
- Comment non-obvious logic, workarounds, edge cases
- Do NOT comment the obvious:

```tsx
// Good:
/**
 * Detects file encoding from raw bytes.
 * Falls back to UTF-8 if confidence is below threshold.
 * @param bytes Raw file bytes
 * @param threshold Minimum confidence (0-1) to accept detection
 * @returns Detected encoding label and confidence score
 */
export function detectEncoding(bytes: Uint8Array, threshold = 0.7): EncodingResult {
  // chardetng returns encoding even for empty input; check length first
  if (bytes.length === 0) return { encoding: 'UTF-8', confidence: 1 };
  // ...
}

// Bad:
// Increment count by 1
count++;
```

**Rust:**
- Use `///` doc comments for public functions, structs, modules
- Use `//` for internal comments
- Document panics, safety invariants, error conditions

```rust
/// Opens and reads a markdown file, detecting its encoding.
///
/// # Arguments
/// * `path` - Path to the file (must exist and be readable)
///
/// # Returns
/// `FileContent` with UTF-8 decoded content and original encoding info
///
/// # Errors
/// Returns `AppError::FileNotFound` if the path doesn't exist,
/// `AppError::PermissionDenied` if unreadable,
/// `AppError::EncodingDetectionFailed` if encoding cannot be determined
/// with confidence above 0.7.
pub async fn open_file(path: String) -> Result<FileContent, AppError> {
    // ...
}
```

### docs/ARCHITECTURE.md

Technical architecture document. Should describe:
1. System overview (frontend/backend split)
2. Directory structure
3. Data flow (user types → editor → preview)
4. IPC contract summary
5. State management approach (Zustand stores)
6. Key design decisions (CodeMirror 6, markdown-it, chardetng, etc.)
7. Build system (Vite + Tauri CLI)

This document should be referenced by AGENTS.md for technical details.

### docs/IPC_SPEC.md

**Authoritative IPC contract.** Must match the actual Rust commands and TypeScript wrappers.

For each command, document:
- Command name
- Parameters (name, type, required, description)
- Return type
- Errors
- Example

```markdown
## open_file

Opens a markdown file and returns its content as UTF-8.

### Parameters
| Name | Type | Required | Description |
|---|---|---|---|
| path | string | Yes | Absolute path to the file |
| encoding | string | No | Override encoding detection (e.g., "GBK") |

### Returns
```ts
{
  path: string;        // Absolute path of opened file
  content: string;     // UTF-8 decoded content
  encoding: string;    // Detected/specified encoding label
  modified: number;    // File modification timestamp (ms since epoch)
  size: number;        // File size in bytes
}
```

### Errors
- `FileNotFound` — Path does not exist
- `PermissionDenied` — Cannot read file
- `InvalidPath` — Path is outside allowed scope or is malicious
- `EncodingDetectionFailed` — Cannot detect encoding and no override given
```

### docs/TESTING.md

Testing strategy document. Should include:
1. Testing philosophy
2. Test structure (unit/integration/E2E)
3. How to run tests
4. Coverage expectations
5. How to write good tests
6. CI pipeline description

### docs/SECURITY.md

Security policy and guidelines. Should include:
1. Security model (capabilities, IPC validation)
2. How to report vulnerabilities
3. Threat model
4. Security features (CSP, path validation, sanitization)
5. Dependency auditing process

### docs/ROADMAP.md

Development roadmap with version milestones. Should include:
1. V0.1 Alpha (current target)
2. V0.5 Beta
3. V1.0
4. V1.5
5. V2.0
6. Features per version
7. Known limitations

## Git Commit Messages

Use Conventional Commits format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `style`, `build`, `ci`, `revert`

**Scopes:** `editor`, `preview`, `tabs`, `fs`, `encoding`, `theme`, `ui`, `ipc`, `tauri`, `deps`, `docs`, `workspace`

**Good examples:**
```
feat(editor): add CodeMirror 6 markdown source editor with syntax highlighting
fix(fs): handle GBK encoded files without BOM correctly
perf(preview): debounce markdown rendering to 200ms to avoid blocking
test(tabs): add unit tests for tab drag-reorder and close behavior
docs(readme): add build instructions for macOS
refactor(ipc): centralize Tauri invoke wrappers in core/ipc/commands.ts
security(fs): add path canonicalization to prevent directory traversal
chore(deps): update CodeMirror to 6.x latest
```

**Bad examples:**
```
update                          // Too vague
WIP                             // WIP commits should be squashed
fix stuff                       // What stuff?
added features                  // What features?
```

## Documentation Checklist

When adding/updating a feature:
- [ ] JSDoc/Rustdoc comments for exported/public functions
- [ ] Inline comments for non-obvious logic
- [ ] IPC_SPEC.md updated if new commands added
- [ ] ARCHITECTURE.md updated if architecture changed
- [ ] CHANGELOG.md updated with user-visible changes
- [ ] README.md updated if installation/usage changed
- [ ] TypeScript types and Rust types match (check IPC types)
- [ ] No outdated commented-out code left
- [ ] No TODO without an issue reference
