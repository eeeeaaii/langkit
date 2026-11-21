# LangKit

A spreadsheet-style tool for building a constructed language.

Create a language, then add entries in a two-column sheet (English and your language).
There is always an empty row at the bottom; start typing in it to add an entry.

## Run it

No build step or install. Open `index.html` in a browser (double-click it, or serve the folder with any static server).

Data is saved in the browser's localStorage. Use **Export** / **Import** to back it up or move it to another browser.

## Code

- `store.js` — data model and persistence (languages → tables → columns/rows)
- `app.js` — screens: home (create/list languages) and the sheet
- `styles.css` — styles, with dark mode
