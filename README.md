IMPORTANT NOTE: due to the complexity of android development and my limited experience in this field. I will continue to develop Aether as a Windows application and not for Android TV.
This decision was not made lightly and I may continue android development in the future

<div align="center">

# 🌌 Aether
### The Definitive Direct-Play Experience for Emby

[![Platform - Windows](https://img.shields.io/badge/Platform-Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/DanielVNZ/modern-emby)
[![License - MIT](https://img.shields.io/badge/License-MIT-FFD700?style=for-the-badge)](https://opensource.org/licenses/MIT)

[**Explore the Docs**](#-getting-started) •
[**Report a Bug**](https://github.com/DanielVNZ/modern-emby/issues) •
[**Request a Feature**](https://github.com/DanielVNZ/modern-emby/issues)

---

**Aether** is a modern, sleek media player client designed for purists.  
Built with a **Direct Play Focus**, it bypasses server-side transcoding to deliver the highest possible audio and video fidelity on Windows.

</div>

---

## 🚀 Key Features

| 💎 Premium Experience | 🛠️ Technical Prowess |
| :--- | :--- |
| **Modern UI/UX:** Silky smooth React transitions designed for desktop use. | **Direct Play Focus:** No transcoding, no quality loss. Aether requests original streams for maximum performance. |
| **Dynamic Home:** Smart *Continue Watching* plus recommendations generated from your watched movies and shows. | **Stats for Nerds:** Real-time monitoring of bitrates, resolution, and buffering health. |
| **Custom Home Sections:** Build your own Browse experience using favorite filters as homepage sections. | **TMDB-Powered Discovery:** Optional TMDB API key unlocks rich, external recommendations and metadata. |
| **Flexible Sign-In:** Log in via **Emby Connect** or connect directly to your server. | **Playback Preferences:** Configure default audio tracks and preferred streaming quality in settings. |
| **Native Desktop App:** Seamless Windows experience with system integration. | **Rust-Powered:** Lightweight, secure, blazing-fast desktop builds via Tauri. |

---

## 🛠️ Tech Stack

<details>
<summary><b>View Architecture Details</b></summary>

- **Frontend:** React 18 + TypeScript  
- **Styling:** Tailwind CSS + Framer Motion  
- **Desktop Wrapper:** Tauri 2.0 (Rust)  
- **Runtime:** Node.js + Vite  
- **Streaming:** HLS.js  

</details>

---

## 📸 Screenshots

<img src="README_Images/Snip1.png" alt="Aether Screenshot 1" width="800" /> <br /><br />
<img src="README_Images/Snip2.png" alt="Aether Screenshot 2" width="800" /> <br /><br />
<img src="README_Images/Snip3.png" alt="Aether Screenshot 3" width="800" /> <br /><br />
<img src="README_Images/Snip4.png" alt="Aether Screenshot 4" width="800" /> <br /><br />

---

## 🏁 Getting Started

### Prerequisites

- **Node.js** v18+
- **Rust** (stable, via `rustup`)
- **Visual Studio Build Tools**  
  *(Windows only — “Desktop development with C++”)*

---

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/DanielVNZ/modern-emby.git
cd modern-emby/Website

# Install dependencies
npm install

# Launch in Dev Mode (Web)
npm run dev

# Launch Desktop App (Tauri)
npm run tauri dev
```

---

## 📦 Distribution

To generate production-ready Windows installers:

```bash
npm run tauri build
```

### Build Artifacts

- 🛠️ **NSIS Installer:** `.exe`
- 📦 **MSI Bundle:** `.msi`
- 🚀 **Portable Build:** `.exe`

---

## ⚠️ Important Notes

> **Important**  
> **Direct Play Only:**  
> Aether intentionally avoids transcoding. If your device cannot natively decode a codec (for example HEVC on unsupported hardware), playback may fail.  
>  
> This is by design — your server stays cool and your media remains **bit-perfect**.

---

## 🤝 Contributing

1. Fork the project  
2. Create your feature branch  
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. Commit your changes  
   ```bash
   git commit -m "Add AmazingFeature"
   ```
4. Push to your branch  
   ```bash
   git push origin feature/AmazingFeature
   ```
5. Open a Pull Request

---

<div align="center">
  <sub>
    Built with ❤️ by <a href="https://github.com/DanielVNZ">DanielVNZ</a> and the community.
  </sub>
  <br />
  <sub>
    <i>Aether is an unofficial client and is not affiliated with Emby LLC.</i>
  </sub>
</div>
