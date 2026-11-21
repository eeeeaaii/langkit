# LangKit

A spreadsheet-style tool for building a constructed language.

Create a language, then work in its tabs:

- **Phrases**: English, your language, and notes. Words in your language are checked against the phonology as you type; letters with no phoneme are underlined in orange, and words that aren't in the Lexicon get a pink underline (both can show at once).
- **Phonology**: Consonants, Vowels and Diphthongs tables. Type a spelling under English Orthography, then click the Phoneme cell to pick from an IPA chart (click to choose, right-click to hear). Diphthongs use + to add more vowels.
- **Lexicon**: Word, English, Part of Speech (pick one or more standard parts of speech), Note, In a Sentence and Sentence Translation. Word and In a Sentence are checked against the phonology like the Phrases language column.

Every table has an empty row at the bottom; type in it to add an entry. Cmd/Ctrl+Z undoes and Cmd/Ctrl+Shift+Z (or Ctrl+Y) redoes any change.

## Run it

No build step or install. Open `index.html` in a browser (double-click it, or serve the folder with any static server).
Data is saved in the browser's localStorage. Undo history lasts until the page is reloaded.

## Code

- `store.js`: document, schema, persistence, and the undo/redo engine (transactions of reversible set/insert/remove operations)
- `sheet.js`: renders a table as an editable grid
- `picker.js`: the IPA chart popup
- `ipa.js`: IPA chart layout and the recording for each symbol
- `audio.js`: plays recordings
- `parse.js`: splits typed words into phonemes
- `app.js`: screens, tabs, routing, keyboard shortcuts
- `audio/ipa/`: recordings from Wikimedia Commons (credits in `audio/ipa/SOURCES.md`); `tools/fetch-ipa-audio.sh` downloads them again
