# Stat Bubbles FP/MP for Owlbear Rodeo

Standalone Owlbear Rodeo extension based on the Stat Bubbles context-menu workflow.
It adds HP, temporary HP, armor class, FP, and MP fields inside Owlbear's token context menu.

## Files

- `manifest.json` - Owlbear Rodeo extension manifest.
- `background.html` - Registers the right-click context menu.
- `context.html` - Context-menu stat editor.
- `context.css` - Context-menu stat editor styles.
- `manager.html` - Fallback action popover from the extension button.
- `stat.html` - Optional FP/MP popover window.
- `shared.js` - Owlbear SDK helpers and stat storage.

## Install

1. Host the files in this folder on GitHub Pages, Netlify, Vercel, or another public static host.
2. In Owlbear Rodeo, add a custom extension using the hosted `manifest.json` URL.
3. Right-click a selected token and use the embedded `Edit Stats` section in the context menu.

Stats are stored on each selected Owlbear item using extension metadata.
