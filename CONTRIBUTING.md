# Contributing to Aether

Thanks for considering a contribution! This project welcomes fixes, features, and improvements. Please follow the steps below so we can review and merge quickly.

## Quick Start

1. Fork the repo and clone your fork.
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-change
   ```
3. Install dependencies:
   ```bash
   cd Website
   npm install
   ```
4. Run the app:
   ```bash
   # Web (dev)
   npm run dev

   # Desktop (Tauri)
   npm run tauri dev
   ```

## What to Work On

- D-pad navigation and focus handling (top priority)
- Bug fixes and performance improvements
- UI/UX polish
- Player/streaming enhancements
- TV navigation and accessibility
- Documentation

If you are proposing a large change, open an issue first to align on direction.

## Coding Standards

- Keep changes focused and small where possible.
- Match the existing coding style in the touched files.
- Prefer TypeScript types over `any`.
- Avoid adding new dependencies unless clearly justified.

## Testing

No formal test suite is enforced right now. Please:

- Verify the change in the UI (web + desktop if relevant).
- Confirm no new console errors/warnings were introduced.
- Include screenshots or a short screen recording for UI changes if possible.

## Commit Messages

Use clear, descriptive commit messages, e.g.:
```
Fix player buffering edge case on seek
```

## Pull Request Checklist

Please include:

- A short description of the change and the problem it solves
- Steps to test
- Screenshots or video (for UI changes)
- Related issues (if any)

## Licensing

By contributing, you agree that your contributions will be licensed under the MIT License.
