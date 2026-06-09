# Stat Bubbles FP/MP for Owlbear Rodeo

Standalone Owlbear Rodeo extension based on the Stat Bubbles-style workflow.
It adds HP, FP, and MP fields, plus two dedicated popover windows for FP and MP.

## Files

- `manifest.json` - Owlbear Rodeo extension manifest.
- `background.html` - Registers the right-click context menu.
- `manager.html` - Main stat manager window.
- `stat.html` - Dedicated FP/MP window.
- `shared.js` - Owlbear SDK helpers and stat storage.

## Install

1. Host the files in this folder on GitHub Pages, Netlify, Vercel, or another public static host.
2. In Owlbear Rodeo, add a custom extension using the hosted `manifest.json` URL.
3. Open the extension from the Owlbear extension bar, or right-click a selected token and choose `Stat Bubbles`.

Stats are stored on each selected Owlbear item using extension metadata.
