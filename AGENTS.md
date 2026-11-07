# AGENTS.md — Webvelop

Notes for the next agent working in this repository: what Webvelop is, how the code is
organized, and **exactly how the app is compiled and tested**, including the traps that
already cost time.

---

## 0. Hard rules (read first)

1. **Never touch the user's real GDevelop installation or its data.** The user's GDevelop
   data lives in `%APPDATA%\GDevelop 5`. Do not read it, write to it, reuse its
   settings or caches, change its registry entries, shortcuts or file associations, put
   files in its folders, or make Webvelop depend on it. Webvelop keeps **all** its data
   in its own folder (see §6).
2. **Don't delete the user's things.** Clean up only temporary folders you created
   yourself (for example the C: build folder in §3).
3. **Disk constraints.** The repo is on `E:` (a slow USB hard drive). `C:` has little
   free space. The agreed workflow: build in a temporary folder on C:, copy the exe to
   `E:\ProjectsArchive\Webvelop\dist\Webvelop.exe`, then **delete the C: folder**.
4. **Git.** Nothing has been committed yet. All Webvelop work is uncommitted changes on
   top of GDevelop's `master` (commit `13b41b0`). Commit only when the user asks.
   Because of the drive's ownership, git needs
   `git -c safe.directory='*' ...` on every command. Don't change the global git config.
5. **Tool calls.** In this environment the tools have prefixed names (for example
   `mcp__layer_congress__kidney_Bash`). Short names like `Bash` fail.

---

## 1. What Webvelop is

Webvelop is a fork of GDevelop (https://github.com/4ian/GDevelop) turned into a
**visual website builder**. The GDevelop game engine (libGD.js, GDJS, Core, Extensions,
C++ code) was **removed completely**. Kept from GDevelop: the editor shell (React 18,
Material-UI v4, theming, dialogs, menus, preferences pattern, tabs, the Electron app,
and the Monaco code editor). Also removed: GDevelop branding, the Asset Store and
Marketplace, Learn, Shop, tutorials, and the scene and events editors.

A website project is a plain JSON object (`WebsiteProject`, see §5) saved as a
`.webvelop` file.

Features: pages made of element trees, a visual canvas (select, move with snapping,
resize, zoom, pan), full CSS styling with breakpoints (desktop, tablet ≤991px,
mobile ≤767px) and states (hover, focus, pressed, current), reusable components, React
components (JSX compiled with sucrase), "When / If / Do / Otherwise" interactions,
behaviors (tabs, accordion, carousel, modal…), variables (`{{state.x}}`), JavaScript and
CSS code with an element picker, live preview, and export to a static site or a
React (Vite) project, as a folder or a zip.

---

## 2. Repository layout

```
E:\ProjectsArchive\Webvelop
├─ AGENTS.md, README.md, LICENSE.md (MIT, keeps GDevelop's original notice)
├─ .gitignore              (.webvelop-data/, .cache/, node_modules/)
├─ .cache/                 (git-ignored)
│   ├─ npm/                npm cache used by every .npmrc in the repo
│   └─ tools/              build and test scripts (see §3 and §4)
├─ dist/Webvelop.exe       latest portable build (the deliverable)
├─ .webvelop-data/         data folder of the app in development mode (created at run)
└─ newIDE/
   ├─ app/                 the editor (React, Create React App + react-app-rewired)
   └─ electron-app/        the desktop app (Electron 32 + electron-builder 26)
```

### newIDE/app (the editor)

- `package.json`: name `webvelop-editor`. Main scripts:
  - `postinstall`: `patch-package && npm run import-resources`
  - `import-resources`: `make-version-metadata` + `build-theme-resources` +
    `scripts/import-monaco-editor.js`
  - `start`: import-resources, then `react-app-rewired start`
  - `build`: import-resources, then `react-app-rewired build` (output in `app/build`)
  - `test`: `react-app-rewired test --env=node`
- `.npmrc`: `cache=E:/ProjectsArchive/Webvelop/.cache/npm` (with an absolute path this
  works from the C: copy too).
- `.env`: `PORT=3077`, `BROWSER=none`. The dev server runs on http://localhost:3077,
  and Electron in dev mode loads that URL.
- `patches/`: patch-package patches for `@material-ui/core 4.11.0`,
  `react-dnd-touch-backend`, `react-monaco-editor 0.18.0` and `react-scripts 5.0.1`.
  They are applied at `postinstall`.
- `config-overrides.js` (react-app-rewired):
  - `*.raw.js` and `*.raw.css` are imported **as text** (`asset/source`). That is how the
    website runtime gets bundled.
  - The aliases `webvelop-react-umd` and `webvelop-react-dom-umd` point to
    `node_modules/react(-dom)/umd/*.production.min.js`, also imported as text. They are
    injected into previewed and exported sites. The packages don't export these UMD
    files, so the aliases are required.
  - The ModuleScopePlugin is removed, and `worker-loader` is set up for `*.worker.js`.
  - For Jest: a raw-text transform (`config/jest/rawTextTransform.js`), a
    `moduleNameMapper` for the UMD aliases, and `transformIgnorePatterns` for the
    ESM-only markdown packages.
- **Generated files (git-ignored and not on E:)** that the build needs:
  - `src/UI/Theme/*/…ThemeVariables.json` (+ CSS), from `npm run build-theme-resources`
  - `src/Version/VersionMetadata.js`, from `npm run make-version-metadata`
  - `public/external/monaco-editor-min/vs`, from `scripts/import-monaco-editor.js`
- `scripts/webvelop-import-graph.js`: a tool for the import graph, used during pruning.
  - `--unreachable` lists source files not reachable from the entry points.
  - `--why <file>` shows why a file is imported.
  - `--packages` lists the npm packages actually used.

### newIDE/electron-app (the desktop app)

- `package.json` (`webvelop-desktop`): devDependencies `electron 32.3.3`,
  `electron-builder 26.4.0`. Its `postinstall` runs `cd app && npm install`.
- `app/package.json` (`webvelop`): runtime dependencies `@electron/remote`,
  `electron-editor-context-menu`, `electron-is-dev`, `minimist`.
  `app/.npmrc` has `legacy-peer-deps=true`. Without it, npm installs `electron` itself
  into `app/node_modules` (because it is a peer dependency of `@electron/remote`), which
  bloats the package.
- `app/main.js`: the main process. It handles:
  - the data folder (see §6)
  - the window, and `@electron/remote` (the renderer reads `global.webvelopPaths`)
  - menus and the titlebar overlay (IPC: `set-main-menu`,
    `titlebar-set-overlay-options`, `window-maximize-toggle`)
  - a confirmation dialog on `will-prevent-unload`
  - URL loading: in dev it loads `WEBVELOP_DEV_SERVER_URL` or `http://localhost:3077`;
    packaged, it loads `app/www/index.html`
- `app/www/`: the built editor, copied from `../app/build`. It is generated, never edit
  it.
- `electron-builder-config.js`:
  - appId `com.webvelop.app`, Windows target **portable x64**, artifact `Webvelop.exe`
  - `publish: null` (no auto-update), a `.webvelop` file association, icon
    `build/icon.ico`
  - output in `electron-app/dist/`. The unpacked app is in `dist/win-unpacked/`.
- `scripts/app-build.js` builds the editor and copies it to `app/www`.
  `scripts/build.js` runs app-build, then electron-builder.
  `scripts/make-icons.js` generates the "W" icons in `build/`.

---

## 3. How to compile the app (exact procedure used)

The official path also works:
`cd newIDE/electron-app && npm install && npm run build -- --win portable`.
But on this machine **npm install on E: is too slow** (USB HDD), so builds run on C:.
All helper scripts are in `E:\ProjectsArchive\Webvelop\.cache\tools\`.

### Step 1: create the C: build folder and install dependencies (first time only)

```powershell
powershell -ExecutionPolicy Bypass -File E:\ProjectsArchive\Webvelop\.cache\tools\setup-build.ps1
```

What it does:
1. `robocopy E:\…\newIDE C:\Users\anton\webvelop-build\newIDE /E /XD node_modules dist www`.
2. Copies `LICENSE.md` and `README.md` into the build folder.
   `electron-builder-config.js` needs `../../LICENSE.md` as an extra resource.
3. Sets `ELECTRON_CACHE`, `electron_config_cache` and `ELECTRON_BUILDER_CACHE` to
   `C:\Users\anton\webvelop-build\.cache\…`, so nothing goes into the user's global
   caches.
4. Runs `npm install --no-audit --no-fund --prefer-offline` in `newIDE/app`. Its
   postinstall applies the patches and generates the theme, version and Monaco
   resources.
5. Runs the same `npm install` in `newIDE/electron-app` (which also installs
   `electron-app/app`).

It takes several minutes, and the `node_modules` folders take a few GB on C:. Check
free space first (`Get-PSDrive C`).

### Step 2: sync your source changes from E: to C:

You edit on E:. Copy the changes over before each build:

```powershell
robocopy E:\ProjectsArchive\Webvelop\newIDE\app\src C:\Users\anton\webvelop-build\newIDE\app\src /E /NFL /NDL /NJH /NJS /NP
```

- **Use `/E`, NOT `/MIR`.** `/MIR` deletes the generated files that exist only on C:
  (`UI/Theme/**/…ThemeVariables.json`, `Version/VersionMetadata.js`), and the build
  then fails with `Can't resolve './DefaultLightThemeVariables.json'` or
  `Can't resolve './VersionMetadata'`. If that happens, run this in
  `C:\Users\anton\webvelop-build\newIDE\app`:
  `npm run build-theme-resources && npm run make-version-metadata`.
- robocopy exit codes 0–7 mean success (3 = files copied). In PowerShell, end the
  command with `; exit 0` so the tool doesn't report an error.
- If you changed files outside `src` (`config-overrides.js`, `public/`,
  `package.json`, or `electron-app/app/main.js`), copy those too. After a
  `package.json` change, run `npm install` again on C:.
- If you deleted a file on E:, delete it on C: by hand (`/E` doesn't delete).

### Step 3: build the editor and package the exe

```bash
bash /e/ProjectsArchive/Webvelop/.cache/tools/build-and-package.sh
```

What it does (in `C:\Users\anton\webvelop-build`):
1. Runs `cd newIDE/app && npx react-app-rewired build`. The log goes to
   `newIDE/build.log`. On failure the script prints the last 40 lines.
   This calls react-app-rewired directly, which skips `import-resources` (already done
   at install).
2. Runs `cd ../electron-app`, deletes `app/www` and `dist`, and copies
   `../app/build/*` to `app/www/`.
3. Sets the Electron cache variables (same as step 1).
4. Runs `npx electron-builder --config=electron-builder-config.js --win portable --x64`.
   The log goes to `newIDE/package.log`.
5. Prints `dist/Webvelop.exe` (about 77 MB).

The whole run takes about 2–4 minutes. Use a 600000 ms tool timeout.

Build failure notes:
- CRA's ESLint runs during the build and **fails on Flow syntax in files without
  `// @flow`**. Every new `.js` file that uses type annotations must start with
  `// @flow`.
- ESLint import-order rules: imports must come before other code.
- "Browserslist: caniuse-lite is old" is only a warning.

### Step 4: test (see §4), then ship

```powershell
# Stop only the test instances (check the process path first!)
Get-Process Webvelop -ErrorAction SilentlyContinue | Where-Object { $_.Path -like 'C:\Users\anton\webvelop-build\*' } | Stop-Process -Force
Copy-Item C:\Users\anton\webvelop-build\newIDE\electron-app\dist\Webvelop.exe E:\ProjectsArchive\Webvelop\dist\Webvelop.exe -Force
Remove-Item -Recurse -Force C:\Users\anton\webvelop-build -Confirm:$false   # when done with the session's builds
```

Never kill Webvelop processes whose path is `E:\…\dist` or anywhere else. Those may be
the user's own instances.

### Development mode (no packaging)

```bash
cd newIDE/app && npm start                 # dev server on :3077
cd newIDE/electron-app && npm start        # electron app → loads http://localhost:3077
```

In dev mode the data folder is `<repo>/.webvelop-data`.

---

## 4. Testing

### Unit tests (Jest)

```bash
cd /c/Users/anton/webvelop-build/newIDE/app
CI=true npx react-app-rewired test --watchAll=false src/Website/Website.spec.js
```

- `src/Website/Website.spec.js` has 17 tests: the model, tree operations, CSS and HTML
  generation, the site builder, the runtime running in jsdom (interactions, behaviors,
  state, `Webvelop.$` and `elements` in JavaScript actions), the React compiler and
  migration. All pass.
- `src/Utils/History.spec.js` tests undo and redo.
- `setupTests.js` only sets `jest.setTimeout`.

### End-to-end tests of the packaged exe (Chrome DevTools Protocol)

Launch the **unpacked** build with an isolated data folder and a debugging port:

```powershell
$env:WEBVELOP_DATA_DIR = 'C:\Users\anton\webvelop-build\test-data'
Start-Process 'C:\Users\anton\webvelop-build\newIDE\electron-app\dist\win-unpacked\Webvelop.exe' -ArgumentList '--remote-debugging-port=9333'
Start-Sleep 8
node E:\ProjectsArchive\Webvelop\.cache\tools\coding-test.js 9333 C:\Users\anton\webvelop-build\shots
```

These scripts need Node ≥ 22 for the global `fetch` and `WebSocket` (the machine has
Node v24.15). Arguments: `<port> <screenshot folder>`. Each script prints
`step: result` lines and `Errors:` (uncaught exceptions collected through
`Runtime.exceptionThrown`). It also saves PNG screenshots. Look at them with the Read
tool; that is how layout bugs were found.

| Script | What it checks |
|---|---|
| `screens.js` | Smoke test: start page, new website from a template, editor, screenshots |
| `pan-test.js` | Middle-click drag pans the canvas camera |
| `move-zoom-test.js` | Wheel zoom at the pointer; drag-move with center snapping guides |
| `resize-test.js` | 8 resize handles, no stuck drags, capture layer |
| `canvas-height-test.js` | Canvas height frozen while resizing, fits exactly (shrinks) after release |
| `picker-test.js` | Asset picker (one-click upload), no autofill dropdowns |
| `coding-test.js` | Page code "Insert element" picker, Run JavaScript action with `elements`, Edit as CSS |

CDP tips:
- Evaluate in the page with `Runtime.evaluate` (`returnByValue`, `awaitPromise`).
- Real mouse input goes through `Input.dispatchMouseEvent`. Set `buttons` correctly:
  the canvas checks `event.buttons` to detect releases that happened outside.
- The canvas is `iframe[title="Page canvas"]`; reach its content with
  `contentDocument`. Elements have `data-wv-id="<id>"`. The canvas is scaled, so
  convert coordinates with `frameRect.width / frame.offsetWidth`.
- The element picker preview is `iframe[title="Pick an element"]`.
- Monaco renders spaces as U+00A0 in `.view-lines` `innerText`. Normalize them before
  comparing text.
- Find buttons by text among visible elements (`offsetParent`, or inside
  `.MuiDialog-root`).

---

## 5. Codebase guide (newIDE/app/src)

### Entry and shell
- `index.js`: bootstraps the app (no libGD). A global `focusin` listener sets
  `autocomplete="off"` on every INPUT and TEXTAREA, because Chromium autofill dropdowns
  (base64 strings, for example) used to cover the option lists.
- `LocalApp.js` (Electron) and `BrowserApp.js` (web) pick the storage providers and
  mount `MainFrame`.
- `MainFrame/index.js`: tabs, history refs, the docked `AppSidebar` (open state in
  preferences `sidebarOpen`; the hamburger toggles it), titlebar buttons
  (Save, Preview, Export), autosave, keyboard shortcuts and the window title. Tabs are
  hidden when no project is open.
- `MainFrame/Preferences/*`: preferences context and provider, stored under the
  localStorage key `webvelop-preferences`.
- `MainFrame/ElectronMainMenu.js`, `WebMainMenu.js` and `MainMenu.js` hold the menu
  templates. They are sent to main.js over IPC.
- `UI/`: GDevelop's UI kit (Dialog, buttons, Theme, …). The themes are
  "Webvelop Dark" and "Webvelop Light".
  - `UI/Dialog.js` forwards `disableEnforceFocus`. Use it on dialogs opened over or
    next to Monaco editors, or MUI's focus trap and Monaco start an infinite focus loop
    ("Maximum call stack size exceeded" in `setSelectionRange`).
- `Utils/History.js`: undo/redo with snapshots of the immutable project. A `mergeKey`
  merges consecutive edits, such as typing.
- `Utils/i18n`: Lingui, with English only (catalogs emptied).
  `GDI18nProvider` no longer calls `gd.getTranslation`.

### Website core (`src/Website`): pure logic, no React
- `Model/Schema.js` holds all the types. A `WebsiteProject` has:
  `webvelop{formatVersion, createdWith}`, `uuid`, `name`, `author`, `version`,
  `settings`, `theme` (colors and fonts → CSS variables), `pages`, `components`,
  `reactComponents`, `scripts`, `styleClasses`, `variables`, `customActions`,
  `globalEvents`, `assets`.
  - A `WebsiteElement` is
    `{id, type, name, props, styles: {desktop|tablet|mobile|hover|focus|pressed|current: {camelCaseCss: value}}, classIds, behaviors, children, locked?}`.
  - A `WebsitePage` is `{id, name, slug, title, description, root, events, script, css, …}`.
  - An `InteractionEvent` is
    `{id, trigger{type,target,params}, conditions[], actions[], elseActions[], disabled?}`.
  - `BREAKPOINTS` and `STYLE_STATES` are defined here. The `current` state maps to
    `.is-active`. `PROJECT_FILE_EXTENSION = 'webvelop'`.
- `Model/Tree.js`: immutable tree operations (find, walk, insert, move, remove,
  update). `walkElements(root, (el, parent, depth) => …)`.
- `Model/ProjectOps.js`: immutable project operations. `Model/Ids.js` makes ids.
  `Model/Templates.js` has the Blank, Landing page, Business and Portfolio templates.
  `Model/Migration.js` upgrades old formats.
- `Elements/ElementTypes.js`: the element type registry (label, default props and
  styles, accepted children). `Elements/Presets.js` holds the insertable blocks
  (navbar, hero, features, form, footer, card, tabs, accordion, carousel, modal,
  dropdown, gallery, back-to-top). `Elements/IconSet.js` holds the icons.
- `Behaviors/BehaviorTypes.js`: tabs, accordion, carousel, modal, dropdown, lightbox,
  stickyHeader, counter.
- `Interactions/InteractionsRegistry.js`: definitions of triggers, conditions and
  actions (label, group, sentence like `"Run JavaScript {elements}: {code}"`, params
  with a `ParamType`). Extend it with `register*`.
  - Each `type` needs a matching implementation in the runtime
    (`Webvelop.registerAction/registerCondition/registerTrigger`).
  - Note: a comment in that file still says the runtime is in `public/…`. It is
    actually in `src/Website/Runtime/`.
- `Interactions/EventFactory.js` creates events.
- `Styles/StyleProperties.js`: CSS property metadata for the inspector.
- `Rendering/`:
  - **One renderer for everything:** the canvas, the preview and the export all use it.
  - `HtmlRenderer.js` renders elements to HTML. Every element has the class
    `wv-<id>`; in the editor it also gets `data-wv-id`.
  - `CssGenerator.js` generates CSS: base, then tablet and mobile media queries,
    theme variables, style classes as `.wvc-<name>`, and Google Fonts.
  - `SiteBuilder.js` has `buildWebsiteFiles`, `buildStandalonePage`,
    `buildCanvasContent` (used by the canvas, template previews and the element
    picker) and `checkProject`. It writes the site and page JSON for the runtime with
    `toScriptJson`, which escapes U+2028 and U+2029.
    - Code of JavaScript instructions becomes functions with the parameters
      `(element, event, state, Webvelop, context, elements)`.
    - **Never paste literal U+2028 or U+2029 characters in source.** Write the
      `\u2028` escapes.
  - `ReactCompiler.js` compiles JSX with sucrase.
  - `ReactProjectExporter.js` exports a Vite React project.
- `Runtime/webvelop-runtime.raw.js` and `.raw.css`: the runtime injected into every
  site (imported as text). It contains:
  - the state store, interpolation, and the trigger, condition, action and behavior
    implementations
  - React mounting (`Webvelop.useVariable`)
  - `Webvelop.$(nameOrId)`, which returns an `ElementHandle` with these methods:
    `text`, `html`, `value`, `attr`, `show`, `hide`, `toggle`, `isVisible`,
    `addClass`, `removeClass`, `toggleClass`, `hasClass`, `css`, `rect`, `size`,
    `moveTo`, `scrollIntoView`, `on`, `off`, `onClick`, `click`, `focus`, `enable`,
    `disable`, `animate`, `behavior`, `openPopup`, `closePopup`, `find`, `parent`,
    `each`, `remove`, plus the getters `dom`, `exists` and `count`
  - `getCodeElements` builds `elements = {self, <as>: handle}` for JavaScript actions
    and conditions
  - It is plain ES5-ish browser JS with no imports. Check the syntax after editing,
    for example with `node --check` on a copy that has a `.js` extension.
- `Services/RuntimeSources.js` exposes the runtime text. `Services/AssetFiles.js`
  handles project assets, stored in an `assets/` folder next to the `.webvelop` file.
  `Services/WebsiteExporter.js` exports to a folder or zip (jszip), opens the export
  in the browser, and calls `getWebvelopPaths()` (`remote.getGlobal('webvelopPaths')`).

### Storage (`src/ProjectsStorage`)
- `WebvelopStorageProviders.js` has two providers:
  - `LocalFileStorageProvider` (Electron): `.webvelop` JSON plus an `assets` folder.
    Autosaves go to `<dataDir>/autosaves`.
  - The browser provider stores projects in IndexedDB.

### Code editor (`src/CodeEditor`)
- `index.js`: a react-monaco-editor wrapper with props `language`, `onEditorReady`
  and `onBlur`. Monaco loads from `public/external/monaco-editor-min`.
- `MonacoSetup.js` adds `webvelop.d.ts` as an extraLib. `setProjectTypings()` updates
  `ts:webvelop/project.d.ts` with the project's element, variable and page names for
  autocomplete.
- `WebvelopTypings.js` holds the API typings and `generateProjectTypings(project)`.

### Visual editor (`src/WebsiteEditor`)
- `WebsiteEditor.css` holds all the editor styles (`wve-` prefix). The tests rely on
  class names like `.wve-button`, `.wve-small-button`, `.wve-panel-tab`, `.wve-toolbar`
  and `.wve-instruction`.
- `WebsiteEditorContext.js` provides `useWebsiteEditor()`, which gives `project`,
  update functions, etc.
- `DocumentEditor/DocumentEditor.js` edits one page or component: the toolbar, a zoom
  of `'fit'`, a number or `'custom'`, and the canvas, layers, insert and inspector
  panels.
- `Canvas/WebsiteCanvas.js` is the most delicate file. It renders a full-page-height
  iframe with `buildCanvasContent` (`vh` units are pinned) and a camera `{x, y, scale}`:
  - Zoom: the mouse wheel zooms at the pointer.
  - Pan: middle-button drag.
  - Moving: free drag with snapping guides (stored as relative offsets).
    **Alt+drag** reorders inside the layout instead.
  - Resizing: 8 handles. While resizing, a **capture layer** covers the iframe so it
    can't steal mouse events, and only the DOM is updated during the drag. The project
    is updated once, on release.
  - Release safety: if `event.buttons === 0`, the drag ends.
  - Height: the canvas height is **frozen during interactions**
    (`isInteractingRef`), then fits the content exactly, growing or shrinking.
- `Inspector/StyleInspector.js` has every CSS section. `CssDeclarationsEditor`
  ("{ } Edit as CSS") edits `.this-element { … }` in Monaco and applies on blur.
  `Inspector/SettingsInspector.js` shows props and behaviors.
- `Interactions/`:
  - `EventsList.js` shows When/If/Do/Otherwise. `InstructionEditorDialog.js` is the
    "Add an action" dialog.
  - `InteractionParams.js` maps each `ParamType` to an input:
    `element` → `ElementParamInput` (with a Pick button), `elements` →
    `CodeElementsInput`, `code` → `CodeParamInput` (Monaco).
    `formatParamValue` builds the sentences.
  - `ElementParams.js` holds those three inputs.
- `Fields/ElementPickerDialog.js` is the GDevelop-style "object selector" for websites:
  a live preview iframe with hover highlight and click to pick, a searchable list, and
  a page or component select.
  `getElementCodeReference(project, picked, 'javascript'|'css')` returns
  `Webvelop.$("Name")`. It falls back to the id when the name is duplicated or the
  element is in a component. For CSS it returns `.wv-<id> /* Name */ {}`.
- `Fields/Fields.js` holds shared fields: TextInput (autocomplete off) and AssetPicker
  (drop zone, Upload button, URL mode). `Fields/PromptDialog.js` is a prompt dialog.
- `Code/CodeEditorPanel.js` is the Monaco panel with a toolbar, a problems list,
  Format, and "⌖ Insert element". Text is inserted with `editor.executeEdits` **after
  the picker closes** (`setTimeout`), because inserting while the picker is still open
  triggers the focus-loop bug. A fixed `height` prop also forces `width: 100%`.
- `Code/CodeTabs.js` has the page JavaScript/CSS tabs, the scripts, React components
  and custom actions.
- `Tabs/` holds the SiteSettings (global CSS and theme), Events and Assets tabs.
  `SitePanel/` is the pages and components tree (embeddable in the sidebar).
  `Sidebar/AppSidebar.js` is the docked sidebar.
  `Home/` is the start page, with live `TemplatePreview` cards, the recent list, and
  the new-website and browser-projects dialogs. `Preview/PreviewDialog.js` is the
  preview, with device sizes and a console. `Export/ExportDialog.js` is the export
  dialog.

---

## 6. Data isolation (main.js `resolveDataDir`)

Order of resolution:
1. `WEBVELOP_DATA_DIR` env var (used by tests).
2. Dev (not packaged): `<repo>/.webvelop-data`.
3. Portable exe: `%PORTABLE_EXECUTABLE_DIR%\webvelop-data` (next to `Webvelop.exe`).
4. A `webvelop-data` folder next to the executable, if it exists.
5. Otherwise `%APPDATA%\Webvelop`. This is **never** `GDevelop 5`.

`userData`, `sessionData`, `logs` and `crashDumps` are all redirected into the data
folder, and so are `projects/`, `exports/`, `preview/` and `autosaves/`. The main log is
`<dataDir>/logs/main.log`. Keep it that way. Don't add code that reads or writes
GDevelop paths.

---

## 7. Gotchas collected so far

- **Shell quoting.** Writing JS through bash heredocs or `python -c` mangles `\n`,
  `$`, backticks and quotes. One such bug turned a `\n` inside a JS string into a real
  newline. For multi-line source edits, use the Edit tool, or write a Python script to
  a file and run it.
- **Flow.** New files need `// @flow`, or CRA's ESLint fails the build on type
  annotations.
- **Electron peer dependency.** Keep `legacy-peer-deps=true` in
  `electron-app/app/.npmrc`.
- **Generated files.** See §3 step 2. Use robocopy `/E`, never `/MIR`.
- **MUI Dialog and Monaco.** Use `disableEnforceFocus` (see §5) on dialogs opened
  over code editors.
- **Iframes steal mouse events.** Any drag over the canvas needs the capture layer.
- **Template thumbnails** are live renders through `buildCanvasContent`. Keep that
  function cheap.
- **Removed code.** The `@blueprintjs` placeholders, storybook, flow-bin and all game
  dependencies are gone. Don't reintroduce GDevelop modules that import `libGD`
  (`global.gd`). It no longer exists.
- **Locales.** English only. Other locales and the GDevelop docs were deleted.
