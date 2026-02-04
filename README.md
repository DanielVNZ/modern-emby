# Aether

A modern, sleek media player client for Emby servers. Built with **React**, **TypeScript**, **Tailwind CSS**, and **Tauri** for native desktop performance.

![Aether](https://img.shields.io/badge/Platform-Windows-blue)
![Android TV](https://img.shields.io/badge/Platform-Android%20TV-green)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

- **Modern UI**
  - Clean, fast, and responsive interface
  - Smooth animations and transitions
  - Designed for both desktop and TV use

- **Full-Featured Video Player**
  - HLS streaming support
  - Stats for nerds panel (bitrate, resolution, buffering info)
  - Up Next popup with auto-play
  - Seek bar with timestamp preview
  - Multiple audio tracks & subtitle support
  - Version / quality selector

- **Direct Play Focus**
  - Designed for **direct play only**
  - No transcoding requests sent to the server
  - Maximum quality, minimal latency, predictable playback

- **TV Navigation**
  - Full keyboard and remote-control support
  - Optimised focus handling for Android TV and couch setups

- **Series Support**
  - Browse seasons and episodes
  - Compact, TV-friendly grid layouts

- **Favourites Support**
  - Favourite movies, series, and episodes
  - Syncs directly with your Emby account

- **Dynamic Home Screen**
  - Automatically adapts based on your library and activity
  - Sections include:
    - Continue Watching
    - Recently Added
    - Favourites
    - More Like This / Recommendations

- **More Like This**
  - Discover similar content based on what you’re viewing

- **Watch Progress**
  - Track playback progress across all supported platforms

- **Fun Loading Screens**
  - 150+ random, humorous loading messages because why not

---

## 🖥️ Screenshots

*Coming soon*

---

## 📋 Prerequisites

Before building, ensure you have the following installed:

- **Node.js** v18 or higher  
  https://nodejs.org/

- **Rust** (latest stable)  
  Install via rustup: https://rustup.rs/

- **Visual Studio Build Tools (Windows)**
  - Install the **Desktop development with C++** workload  
  Required for Rust compilation

---

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

#### Web Browser (Development)

```bash
npm run dev
```

Then open:  
http://localhost:1420

#### Desktop App (Tauri)

```bash
npm run tauri dev
```

---

## 📦 Building for Windows

### Build Windows Executables

```bash
npm run tauri build
```

This produces:

- **NSIS Installer**  
  `src-tauri/target/release/bundle/nsis/Aether_x.x.x_x64-setup.exe`

- **MSI Installer**  
  `src-tauri/target/release/bundle/msi/Aether_x.x.x_x64_en-US.msi`

- **Portable EXE**  
  `src-tauri/target/release/Aether.exe`

---

## 🔧 Configuration

On first launch, you’ll be prompted to enter:

1. **Emby Server URL**  
   Example: `http://192.168.1.100:8096`

2. **Username & Password**  
   Your existing Emby account credentials

---

## ▶️ Playback Notes & Limitations

- **Direct Play Only**
  - No transcoding support (by design)
  - Media must be compatible with the client device

- **Best Use Cases**
  - Local networks
  - High-quality original media
  - Desktop and Android TV environments

---

## 🏗️ Project Structure

```text
Website/
├── src/
│   ├── components/
│   ├── services/
│   ├── hooks/
│   └── types/
├── src-tauri/
│   ├── src/
│   └── tauri.conf.json
└── package.json
```

---

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript
- **Styling:** Tailwind CSS + custom animations
- **Build Tool:** Vite
- **Desktop Framework:** Tauri 2.0 (Rust)
- **Streaming:** HLS.js

---

## 📱 Platform Support

| Platform   | Status |
|-----------|--------|
| Windows   | ✅ Supported |
| Android TV| ✅ Supported |
| Web       | ✅ Supported (self-hosted) |

---

## 💬 Feedback & Contributions

Aether is an actively evolving project and feedback is highly encouraged.

- Open issues for bugs or feature ideas
- Share UI/UX feedback
- Submit pull requests

---

## 📄 License

MIT License. See the LICENSE file for details.

---

## 🙏 Acknowledgements

- Emby
- Tauri
- React
- Tailwind CSS

---

**Note:** This is an unofficial client and is not affiliated with Emby LLC.
