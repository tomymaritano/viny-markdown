# VINY vNext

Personal note-taking application — offline-first, cross-platform.

## Stack

- **Web**: SvelteKit + Vite
- **Desktop**: Tauri (Rust)
- **Database**: SQLite
- **Sync**: Disabled (v1)

## Structure

```
viny-next/
├── apps/
│   ├── desktop/     # Tauri app
│   └── web/         # SvelteKit PWA
├── packages/
│   ├── domain/      # Types, invariants
│   └── storage/     # SQLite + repos
└── docs/
    └── VINY-vNext-SPEC.md
```

## Development

```bash
# Install dependencies
pnpm install

# Run web app
pnpm dev:web

# Run desktop app (requires Rust)
pnpm dev:desktop
```

## Documentation

See [docs/VINY-vNext-SPEC.md](docs/VINY-vNext-SPEC.md) for the full specification.
