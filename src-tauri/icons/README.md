# App Icons

Tauri requires the following icon files for building:

- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

After setting up Tauri, generate them from a source 1024×1024 PNG with:

```bash
pnpm tauri icon path/to/source-icon.png
```

Until icons are provided, `pnpm tauri dev` should still run using the default Tauri icon.
