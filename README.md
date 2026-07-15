# SearchDash

Quickly switch between multiple search engines with a keyboard shortcut. Type once, search everywhere.

## Features

- **Instant Search Switching** — Press `Ctrl+Shift+K` / `Cmd+Shift+K` to open the search panel, type your query, and click any engine to search
- **Right-Click Search** — Select any text on any page, right-click, and search with any engine
- **Multi-Search (Pro)** — Select multiple engines and search them all at once
- **10 Built-in Engines** — Google, Bing, YouTube, GitHub, Stack Overflow, Wikipedia, Reddit, DuckDuckGo, Amazon, X (Twitter)
- **Custom Engines** — Add your own search engines with custom URL templates
- **Pro Unlock** — Unlimited engines, Multi-Search, drag-and-drop reorder, and default engine selection

## Website

Visit [searchdash.top](https://searchdash.top) for more information.

## Installation

### Chrome Web Store
*Coming soon*

### Manual (Developer Mode)
1. Download or clone this repository
2. Go to `chrome://extensions`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select this folder

## Development

```
SearchDash/
├── manifest.json      # Extension manifest (Manifest V3)
├── background.js      # Service worker — search logic, license management
├── content.js         # Content script — get selected text
├── popup.html         # Popup panel UI
├── popup.js           # Popup interactivity
├── options.html       # Settings page UI
├── options.js         # Settings logic — engine management
├── purchase.html      # Purchase/license activation page
├── purchase.js        # Purchase page logic
├── success.html       # Post-payment auto-activation page
├── index.html         # Landing page (searchdash.top)
└── icons/             # Extension icons (16/48/128)
```

## License

MIT