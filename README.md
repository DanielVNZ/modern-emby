# Modern Emby

A modern, sleek media player client for Emby servers. Built with React, TypeScript, Tailwind CSS, and Tauri for native desktop performance.

![Modern Emby](https://img.shields.io/badge/Platform-Windows-blue) ![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- **Modern UI** - Beautiful, responsive interface with smooth animations and transitions
- **Video Player** - Full-featured player with HLS streaming support
- **Navigation** - Full keyboard support (remote control support in development)
- **Series Support** - Browse seasons and episodes with compact grid layout
- **More Like This** - Discover similar content recommendations
- **Watch Progress** - Track your progress across all media
- **Fun Loading Screens** - 150+ random funny loading messages

## 🖥️ Screenshots

*Coming soon*

## 📋 Prerequisites

Before building, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Rust** (latest stable) - [Install via rustup](https://rustup.rs/)
- **Visual Studio Build Tools** (Windows) - Required for Rust compilation
  - Install "Desktop development with C++" workload

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/DanielVNZ/modern-emby.git
cd modern-emby/Website
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run in Development Mode

**Web Browser (for development):**
```bash
npm run dev
```
Then open http://localhost:1420 in your browser.

**Desktop App (Tauri):**
```bash
npm run tauri dev
```

## 📦 Building for Windows

### Build Windows Executable (.exe)

```bash
npm run tauri build
```

This will create:
- **Installer (NSIS):** `src-tauri/target/release/bundle/nsis/Modern Emby_x.x.x_x64-setup.exe`
- **MSI Installer:** `src-tauri/target/release/bundle/msi/Modern Emby_x.x.x_x64_en-US.msi`
- **Standalone EXE:** `src-tauri/target/release/Modern Emby.exe`

### Build Options

The build process creates multiple distribution formats:
- **NSIS Installer** - Standard Windows installer with install/uninstall support
- **MSI Installer** - Enterprise-friendly Windows Installer package
- **Portable EXE** - Standalone executable (no installation required)

## 🔧 Configuration

On first launch, you'll be prompted to enter:
1. **Emby Server URL** - Your Emby server address (e.g., `http://192.168.1.100:8096`)
2. **Username & Password** - Your Emby account credentials

## 🏗️ Project Structure

```
Website/
├── src/
│   ├── components/      # React components
│   │   ├── Home.tsx         # Dashboard/home screen
│   │   ├── Browse.tsx       # Media browser
│   │   ├── MediaDetails.tsx # Movie/series details
│   │   ├── Player.tsx       # Video player
│   │   └── ...
│   ├── services/        # API services
│   │   └── embyApi.ts       # Emby API integration
│   ├── hooks/           # Custom React hooks
│   └── types/           # TypeScript type definitions
├── src-tauri/           # Tauri (Rust) backend
│   ├── src/
│   │   └── main.rs          # Tauri entry point
│   └── tauri.conf.json      # Tauri configuration
└── package.json
```

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS
- **Build Tool:** Vite
- **Desktop Framework:** Tauri 2.0 (Rust)
- **Video Streaming:** HLS.js
- **Styling:** Tailwind CSS with custom animations

## 📱 Platform Support

| Platform | Status |
|----------|--------|
| Windows  | ✅ Supported |
| Android  | 🚧 In Progress |
| Web      | ✅ Supported |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Emby](https://emby.media/) - Media server
- [Tauri](https://tauri.app/) - Desktop framework
- [React](https://react.dev/) - UI library
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework

---

**Note:** This is an unofficial client and is not affiliated with Emby LLC.
