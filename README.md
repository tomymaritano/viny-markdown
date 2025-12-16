# VINY

A modern, offline-first note-taking application built with Tauri and Svelte.

## Features

- **Offline-first**: Full functionality without network connectivity
- **SQLite backend**: Fast, reliable local storage with FTS5 full-text search
- **Markdown support**: Write in markdown with live preview
- **Sync ready**: LWW (Last Write Wins) conflict resolution architecture
- **Native notifications**: Reminders with system notifications
- **Cross-platform**: macOS, Windows, and Linux

## Stack

- **Frontend**: Svelte 5 + TypeScript + Vite
- **Backend**: Tauri 2 (Rust)
- **Database**: SQLite with FTS5
- **Sync Server**: Axum (Rust)

## Download

Download the latest release from the [Releases](https://github.com/tomymaritano/viny-markdown/releases) page.

| Platform | Download |
|----------|----------|
| macOS | `VINY_*.dmg` |
| Windows | `VINY_*-setup.exe` |
| Linux | `VINY_*.AppImage` or `VINY_*.deb` |

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Rust (latest stable)

### Setup

```bash
# Clone the repository
git clone https://github.com/tomymaritano/viny-markdown.git
cd viny-markdown

# Install dependencies
pnpm install

# Run desktop app in development mode
cd apps/desktop
pnpm tauri dev
```

### Build

```bash
# Build for production
cd apps/desktop
pnpm tauri build
```

### Run Sync Server (optional)

```bash
cd apps/server
cargo run
```

## Project Structure

```
viny-next/
├── apps/
│   ├── desktop/          # Tauri desktop app
│   │   ├── src/          # Svelte frontend
│   │   └── src-tauri/    # Rust backend
│   └── server/           # Sync server (Axum)
└── docs/
    └── VINY-vNext-SPEC.md
```

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New note | Cmd+N |
| Command palette | Cmd+K |
| Global search | Cmd+Shift+F |
| Settings | Cmd+, |
| Toggle dark mode | Cmd+Shift+D |
| Focus mode | Cmd+\ |

## License

MIT
