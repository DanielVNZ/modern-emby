**LINUX USERS: Settings > Playback and click LibMPV as the video player**

<div align="center">

# Aether
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

## ✨ Features

- **Smart Media Merging**  
  Automatically merges non-4K and 4K versions into a single library item.

- **Customisable Home Screen**  
  Fully personalise your home screen layout to match your viewing habits.

- **Home Screen Sort Controls**  
  Change and fine-tune the sort order of home screen sections.

- **User-Defined Filters**  
  Create custom filters and display them directly on the home screen.

- **Season Count Filtering (TV Series)**  
  Filter series based on the number of seasons.

- **Emby Favourites Support**  
  Native support for Emby favourites for quick access to your most-loved content.

- **Automatic Black Bar Removal**  
  Detects and removes hard-coded black bars in movies and TV series for a true full-screen experience.

- **Emby Statistics Dashboard**  
  View detailed playback and usage statistics directly within the app.

- **TMDB API Integration**  
  Pulls trending movies and TV shows directly from The Movie Database.

- **Automatic Updates**  
  Seamless background updates ensure you always have the latest features and fixes.


---

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H2H011S05A)

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
