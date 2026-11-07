# Webvelop

Webvelop is a visual website builder. Design responsive pages visually, make them
interactive with a "When / If / Do" interactions system, write React components and
JavaScript when you need more control, preview the real website, and export it as a
static website (HTML, CSS, JavaScript, assets) or as a React (Vite) project.

## Features

- **Websites made of pages**, each with a tree of elements (sections, containers, rows,
  grids, headers, navigation, footers, headings, texts, buttons, links, lists, icons,
  images, videos, forms, inputs, embeds...).
- **Visual editor**: insert elements (click or drag and drop), select, move/reorder,
  resize, edit texts in place, duplicate, copy/paste, wrap, lock, hide; a Layers panel
  shows the hierarchy.
- **Styling**: layout (flexbox, grid), spacing, sizes, positioning, typography,
  backgrounds and gradients, borders, shadows, effects, transitions, any CSS property;
  hover/focus/pressed/active states; shared style classes; a theme of colors and fonts
  (CSS variables).
- **Responsive design**: desktop, tablet and mobile breakpoints with their own styles.
- **Reusable components** with props, and **React components** written in JSX (with a
  live preview), usable on any page.
- **Interactions**: triggers (click, form submit, typing, scroll, keys, timers,
  variables...), conditions (form valid, values, screen size...) and actions (show/hide,
  classes, styles, texts, navigation, popups, tabs, carousels, variables, animations,
  forms, JavaScript...). Custom actions can be written in JavaScript.
- **Behaviors**: tabs, accordion, carousel, popup, dropdown, image gallery lightbox,
  sticky header, animated counters; entrance animations.
- **State**: website variables, displayed with `{{state.name}}`, shared with React
  (`Webvelop.useVariable`).
- **Code**: JavaScript scripts, page scripts and CSS, with a code editor (Monaco) with
  autocompletion of the Webvelop API, formatting and error reporting.
- **Preview** of the real website at desktop/tablet/mobile sizes, with a console.
- **Export** to a static website or a React (Vite) project, to a folder or a ZIP.

## Repository

- `app`: the editor (React).
  - `src/Website`: the website model, renderer, exporters and the runtime of websites.
  - `src/WebsiteEditor`: the visual editor, inspector, interactions, code editors...
  - `src/MainFrame`, `src/UI`, `src/CodeEditor`, `src/ProjectsStorage`: the editor shell.
- `electron-app`: the desktop application (Electron).

## Development

Requirements: Node.js 18 or later.

```bash
cd newIDE/app
npm install
npm start            # editor development server on http://localhost:3077

cd ../electron-app
npm install
npm start            # desktop app, using the development server
```

Tests: `cd newIDE/app && npm test -- --watchAll=false`.

Desktop build: `cd newIDE/electron-app && npm run build -- --win --dir`
(or `--win` for an installer).

## Data and independence

Webvelop stores all its data (settings, browser storage, caches, autosaves, logs,
previews, exports and the default folder for new websites) in its own data folder:

- during development: `.webvelop-data/` at the root of this repository,
- packaged app: `%APPDATA%\Webvelop` (Windows), or a `webvelop-data` folder next to the
  executable (portable mode),
- or the folder given by the `WEBVELOP_DATA_DIR` environment variable.

Website projects are `.webvelop` files (JSON), with their assets in an `assets` folder
next to them.

## License

MIT - see [LICENSE.md](../LICENSE.md). Webvelop is derived from the open-source editor code
of GDevelop; it is an independent project.
