# HTMLeditor

A lightweight HTML editor for custom-style, dual-pane article editing — featuring a block-based visual editor on the left and a live preview iframe on the right.

---

## Getting Started

Open `index.html` directly in a browser (no build step required), or serve with any static file server:

```bash
npx serve .
# or
python3 -m http.server
```

> **Note:** ES modules require a server for `import` to work. Opening `index.html` via `file://` will fail due to browser CORS restrictions on local modules.

---

## Folder Structure

```
HTMLeditor/
├── index.html               # Entry point — links CSS files and loads src/app.js as an ES module
├── article_editor.html      # Original monolithic implementation (kept for reference)
├── src/
│   ├── app.js               # Application bootstrap: imports core + components + UI, inserts sample content
│   │
│   ├── core/                # Framework-agnostic editor infrastructure
│   │   ├── editor.js        # Shared state, block factory (mkBlock), DOM builders, b2html, preview (doPv)
│   │   ├── eventBus.js      # Lightweight publish/subscribe bus used across all modules
│   │   ├── selection.js     # setSelected — manages the currently selected block highlight
│   │   ├── commandManager.js# insertBlock, moveBlock, deleteBlock, duplicateBlock, reorderBlock
│   │   ├── pastePipeline.js # Paste pipeline: sanitize → detect/transform → normalize → insert
│   │   ├── history.js       # Snapshot-based undo/redo (stub — extension point)
│   │   └── schemaRegistry.js# Component registry: registerComponent / getComponent
│   │
│   ├── components/          # One folder per content-block type
│   │   ├── heading/
│   │   │   ├── heading.model.js       # Component descriptor + schemaRegistry registration
│   │   │   ├── heading.commands.js    # Type-specific insert/update commands
│   │   │   ├── heading.paste.js       # Paste-detection and transformation rules
│   │   │   ├── heading.interaction.js # Keyboard/Enter/Backspace behaviour
│   │   │   └── heading.css            # Scoped heading styles (.ed-heading)
│   │   ├── paragraph/   (same structure)
│   │   ├── citation/    (same structure)
│   │   ├── abstract/    (same structure)
│   │   ├── separator/   (same structure)
│   │   └── image/       (same structure)
│   │
│   ├── ui/                  # DOM wiring and user-interaction modules
│   │   ├── toolbar.js       # Toolbar buttons, dialogs, tree view, format bar, resize handle
│   │   ├── contextMenu.js   # Preview-iframe right-click context menu
│   │   └── shortcuts.js     # Keyboard shortcuts (configurable + fixed), shortcut help modal
│   │
│   └── styles/              # Global CSS files
│       ├── reset.css        # Box-model reset and scrollbar normalisation
│       ├── theme.css        # CSS custom properties (design tokens: colours, fonts, radii)
│       └── editor.css       # All editor layout, block styles, dialogs, tree view, modals
```

---

## Component Registration

Each component follows a common contract and self-registers in `schemaRegistry`:

```js
// src/components/heading/heading.model.js
import { registerComponent } from '../../core/schemaRegistry.js';

registerComponent({
  type:      'heading',          // logical type name
  match(node) { … },            // detect a DOM node as this component
  normalize(node, ctx) { … },   // repair invalid structure
  commands:  { insert, update, remove },
  onPaste(fragment, ctx) { … }, // transform pasted HTML into this component
  onKeyDown(event, ctx) { … },  // custom keyboard behaviour
  toHTML(block) { … },          // serialize block → HTML string
  fromHTML(el) { … },           // parse DOM element → block data
  cssClass:  'ed-heading',
});
```

Import the model file in `src/app.js` to register it before the editor initialises.

---

## Adding a New Component Type

1. Create `src/components/<name>/` with the following files:
   - `<name>.model.js` — define the contract object and call `registerComponent(…)`
   - `<name>.commands.js` — type-specific commands
   - `<name>.paste.js` — paste handler; register inline paste via `on('inlinePaste:<type>', ...)` and optionally set `comp.inlinePaste` / `comp.globalPasteParser` on the descriptor
   - `<name>.interaction.js` — keyboard/mouse handlers
   - `<name>.css` — scoped styles (use the component's `cssClass` as the root selector)
   - `index.js` — single entry point: imports model + paste, injects CSS via `injectComponentCSS('<type>', cssText)`
2. Import the component's `index.js` in `src/app.js` (after the core modules):
   ```js
   import './components/<name>/index.js';
   ```
   The `index.js` handles CSS injection automatically — **do not** add a `<link>` tag to `index.html`.
3. Add a toolbar button in `index.html` if needed (`data-insert="<type>"` or `data-dialog="<type>"`).

---

## Paste Pipeline

Paste interception is in `src/core/pastePipeline.js`. Stages:

| Stage | Description |
|-------|-------------|
| **sanitize** | Strip unsafe tags/attributes from clipboard HTML |
| **detect** | Identify which component type the pasted content matches |
| **transform** | Delegate to the matching component's `onPaste` handler |
| **normalize** | Ensure the resulting block tree is schema-valid |
| **insert** | Insert all new blocks in a single transactional step |

**Inline paste routing**: When paste occurs inside a block's contentEditable element, `editor.js` emits `inlinePaste:<type>` (e.g. `inlinePaste:p`, `inlinePaste:abstract`). Each component's `<name>.paste.js` registers a handler via `on('inlinePaste:<type>', handler)`. Fallbacks for types without a dedicated component folder are registered in `pastePipeline.js`.

**Global paste** (outside text fields) is intercepted in `src/ui/shortcuts.js`, which opens the paste-preview dialog (`#paste-overlay`) so the user can confirm before inserting.

---

## Keyboard Routing

All keyboard events are handled in `src/ui/shortcuts.js`:

- **Configurable shortcuts** (single letter/digit, no modifiers): stored in `localStorage`, shown in the shortcuts help modal (`?` key or ⌨ button).
- **Fixed shortcuts**: Arrow Up/Down (move block), Delete/Backspace (delete block), Ctrl+D (duplicate), Escape (deselect / close modal).
- **Rich-text shortcuts** (Ctrl+B/I/U/S): handled inside `makeRichBE` in `src/core/editor.js` while focus is inside a contenteditable element.
- **EventBus routing**: `emit('openDialog', type)` allows shortcut handlers to trigger dialogs in `src/ui/toolbar.js` without a direct import dependency.
