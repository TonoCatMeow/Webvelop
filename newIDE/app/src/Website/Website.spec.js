/**
 * @jest-environment jsdom
 */
// Tests of the Webvelop website model, renderer, export and runtime.
import { createWebsiteProject, WEBSITE_TEMPLATES } from './Model/Templates';
import {
  buildWebsiteFiles,
  buildStandalonePage,
  checkProject,
  buildCanvasContent,
} from './Rendering/SiteBuilder';
import { getRuntimeJs, getRuntimeCss } from './Services/RuntimeSources';
import {
  findElement,
  moveElement,
  collectElementIds,
  findParent,
} from './Model/Tree';
import {
  duplicateElementInDocument,
  convertElementToComponent,
  removeElementFromDocument,
  addPage,
  getDocument,
} from './Model/ProjectOps';
import { compileReactComponent } from './Rendering/ReactCompiler';
import { createElement } from './Elements/ElementTypes';

const runtime = {
  runtimeJs: getRuntimeJs(),
  runtimeCss: getRuntimeCss(),
  reactJs: '/* react */',
  reactDomJs: '/* react-dom */',
};

const getFile = (files, path) => {
  const file = files.find(f => f.path === path);
  if (!file) throw new Error('Missing file ' + path);
  return file.content || '';
};

/** Load an exported page in the jsdom document and run its scripts. */
const loadExportedPage = (files, pageFile) => {
  const html = getFile(files, pageFile);
  const body = html.substring(html.indexOf('<body>') + 6, html.indexOf('<script'));
  delete window.Webvelop;
  document.documentElement.className = '';
  document.body.innerHTML = body;
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  scripts
    .filter(src => !src.startsWith('vendor/'))
    .forEach(src => {
      // eslint-disable-next-line no-eval
      window.eval(getFile(files, src));
    });
  return window.Webvelop;
};

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('Website templates and export', () => {
  WEBSITE_TEMPLATES.forEach(template => {
    it(`creates and exports the "${template.name}" template without errors`, () => {
      const project = createWebsiteProject({ name: 'My Site', templateId: template.id });
      expect(project.pages.length).toBe(template.pages.length);
      // Ids are unique in every page.
      project.pages.forEach(page => {
        const ids = collectElementIds(page.root);
        expect(new Set(ids).size).toBe(ids.length);
      });
      const { files, issues } = buildWebsiteFiles(project, runtime);
      expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
      expect(files.some(file => file.path === 'index.html')).toBe(true);
      expect(getFile(files, 'index.html')).toContain('<!DOCTYPE html>');
      expect(getFile(files, 'css/site.css')).toContain('--color-primary');
      expect(checkProject(project).filter(issue => issue.severity === 'error')).toEqual([]);
      // JSON round-trip (saving and reopening) keeps the project identical.
      expect(JSON.parse(JSON.stringify(project))).toEqual(project);
    });
  });

  it('exports one HTML file per page, with links between pages', () => {
    const project = createWebsiteProject({ name: 'Biz', templateId: 'business' });
    const { files } = buildWebsiteFiles(project, runtime);
    const htmlFiles = files.filter(file => file.path.endsWith('.html')).map(file => file.path);
    expect(htmlFiles.sort()).toEqual(['about.html', 'contact.html', 'index.html', 'services.html']);
    const index = getFile(files, 'index.html');
    expect(index).toContain('href="services.html"');
    // The "Service card" component props are substituted.
    expect(index).toContain('Consulting');
    expect(index).not.toContain('{{props.');
  });

  it('includes React only on pages using React components', () => {
    const project = createWebsiteProject({ name: 'Landing', templateId: 'landing' });
    const { files } = buildWebsiteFiles(project, runtime);
    expect(getFile(files, 'index.html')).toContain('vendor/react.production.min.js');
    expect(files.some(file => file.path === 'vendor/react-dom.production.min.js')).toBe(true);
    expect(getFile(files, 'js/site.js')).toContain('registerReactComponent("LikeCounter"');
  });

  it('generates responsive CSS with media queries and state styles', () => {
    const project = createWebsiteProject({ name: 'Landing', templateId: 'landing' });
    const { files } = buildWebsiteFiles(project, runtime);
    const css = getFile(files, 'css/page-index.css');
    expect(css).toMatch(/@media \(max-width:991px\)/);
    expect(css).toMatch(/@media \(max-width:767px\)/);
    expect(css).toMatch(/:hover\{/);
  });

  it('builds self-contained preview pages and editor canvas content', () => {
    const project = createWebsiteProject({ name: 'Folio', templateId: 'portfolio' });
    const { html, issues } = buildStandalonePage(project, project.pages[0].id, runtime, () => 'blob:x');
    expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
    expect(html).toContain('Webvelop.start({ mode: "preview" })');
    const canvas = buildCanvasContent(project, { kind: 'page', id: project.pages[0].id }, () => '');
    expect(canvas && canvas.html).toContain('data-wv-id=');
  });
});

describe('Element tree operations', () => {
  it('moves, duplicates and removes elements', () => {
    const project = createWebsiteProject({ name: 'Blank', templateId: 'blank' });
    const page = project.pages[0];
    const ref = { kind: 'page', id: page.id };
    const section = page.root.children[0];
    const [title, text] = section.children;

    const moved = moveElement(page.root, text.id, section.id, 0);
    expect(findElement(moved, section.id).children.map(c => c.id)).toEqual([text.id, title.id]);
    // Cannot move an element inside itself.
    expect(moveElement(page.root, section.id, title.id, 0)).toBe(page.root);

    const { project: withCopy, newElementId } = duplicateElementInDocument(project, ref, title.id);
    const copyLocation = findParent(getDocument(withCopy, ref).root, newElementId);
    expect(copyLocation.index).toBe(1);

    const withoutTitle = removeElementFromDocument(withCopy, ref, title.id);
    expect(findElement(getDocument(withoutTitle, ref).root, title.id)).toBe(null);
  });

  it('converts an element and its interactions into a reusable component', () => {
    const project = createWebsiteProject({ name: 'Landing', templateId: 'landing' });
    const page = project.pages[0];
    const header = page.root.children[0];
    const result = convertElementToComponent(project, { kind: 'page', id: page.id }, header.id, 'Header');
    expect(result.component).toBeTruthy();
    // The mobile menu interaction moved into the component.
    expect(result.component.events.length).toBe(1);
    const newPage = result.project.pages[0];
    expect(newPage.root.children[0].type).toBe('component');
    const { issues } = buildWebsiteFiles(result.project, runtime);
    expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
  });

  it('adds pages with unique slugs', () => {
    let project = createWebsiteProject({ name: 'Blank', templateId: 'blank' });
    project = addPage(project, 'About').project;
    project = addPage(project, 'About').project;
    expect(project.pages.map(p => p.slug)).toEqual(['index', 'about', 'about-2']);
  });
});

describe('React components', () => {
  it('compiles JSX and reports errors', () => {
    const ok = compileReactComponent({
      id: 'x1',
      name: 'Hello',
      description: '',
      props: [],
      css: '',
      code: "import React from 'react';\nexport default function Hello({ name }) { return <p>Hello {name}</p>; }",
    });
    expect(ok.errors).toEqual([]);
    expect(ok.registrationCode).toContain('React.createElement');

    const broken = compileReactComponent({
      id: 'x2',
      name: 'Broken',
      description: '',
      props: [],
      css: '',
      code: 'function Broken() { return <div>; }',
    });
    expect(broken.errors.length).toBeGreaterThan(0);
  });
});

describe('Website runtime', () => {
  it('runs the interactions of an exported website', async () => {
    const project = createWebsiteProject({ name: 'Landing', templateId: 'landing' });
    const { files } = buildWebsiteFiles(project, runtime);
    const Webvelop = loadExportedPage(files, 'index.html');
    expect(Webvelop).toBeTruthy();
    expect(Webvelop.page.name).toBe('Home');

    // The mobile menu button toggles the navigation links.
    const menuButton = Webvelop.element('Menu button');
    const links = Webvelop.element('Navigation links');
    expect(menuButton).toBeTruthy();
    menuButton.click();
    await flush();
    const firstState = links.classList.contains('wv-hidden') || links.classList.contains('wv-shown');
    expect(firstState).toBe(true);

    // Submitting the empty contact form does not show the success message.
    const form = Webvelop.element('Contact form');
    const success = Webvelop.element('Success message');
    expect(success.classList.contains('wv-hidden')).toBe(true);
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    await flush();
    expect(success.classList.contains('wv-hidden')).toBe(true);

    // Filling the form and submitting it shows the success message, using a variable.
    form.querySelector('input[name="name"]').value = 'Ada';
    form.querySelector('input[name="email"]').value = 'ada@example.com';
    form.querySelector('textarea[name="message"]').value = 'Hello!';
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    await flush();
    expect(success.classList.contains('wv-hidden')).toBe(false);
    expect(success.textContent).toContain('Thank you Ada!');
    expect(Webvelop.state.get('contactName')).toBe('Ada');
  });

  it('runs behaviors (tabs, popup) and actions', async () => {
    const project = createWebsiteProject({ name: 'Folio', templateId: 'portfolio' });
    const { files } = buildWebsiteFiles(project, runtime);
    const Webvelop = loadExportedPage(files, 'index.html');

    // Tabs: only the first panel is shown, clicking a tab switches panel.
    const tabs = Webvelop.element('Skills tabs');
    const [buttons, panels] = Array.from(tabs.children);
    expect(panels.children[0].classList.contains('wv-hidden')).toBe(false);
    expect(panels.children[1].classList.contains('wv-hidden')).toBe(true);
    buttons.children[1].click();
    expect(panels.children[1].classList.contains('wv-hidden')).toBe(false);
    expect(buttons.children[1].classList.contains('is-active')).toBe(true);

    // Popup: opened by a button, closed with Escape.
    const popup = Webvelop.element('About popup');
    expect(popup.classList.contains('wv-hidden')).toBe(true);
    Webvelop.element('About me button').click();
    await flush();
    expect(popup.classList.contains('wv-hidden')).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(popup.classList.contains('wv-hidden')).toBe(true);
  });

  it('supports variables bound to texts and custom JavaScript actions', async () => {
    let project = createWebsiteProject({ name: 'Blank', templateId: 'blank' });
    const page = project.pages[0];
    const button = createElement('button', { name: 'Increment' });
    const label = createElement('text', { name: 'Counter', props: { text: 'Count: {{state.count}}' } });
    project = {
      ...project,
      variables: [{ id: 'w1', name: 'count', type: 'number', initialValue: '5', persist: false }],
      pages: [
        {
          ...page,
          root: { ...page.root, children: [...page.root.children, button, label] },
          events: [
            {
              id: 'v1',
              trigger: { type: 'click', target: button.id, params: {} },
              conditions: [],
              actions: [
                { id: 'a1', type: 'addToVariable', params: { variable: 'count', amount: 2 } },
                { id: 'a2', type: 'javascript', params: { code: "element.setAttribute('data-clicked', state.get('count'));" } },
              ],
              elseActions: [],
            },
          ],
        },
      ],
    };
    const { files, issues } = buildWebsiteFiles(project, runtime);
    expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
    const Webvelop = loadExportedPage(files, 'index.html');
    expect(Webvelop.element('Counter').textContent).toBe('Count: 5');
    Webvelop.element('Increment').click();
    await flush();
    await flush();
    expect(Webvelop.state.get('count')).toBe(7);
    expect(Webvelop.element('Counter').textContent).toBe('Count: 7');
    expect(Webvelop.element('Increment').getAttribute('data-clicked')).toBe('7');
  });

  it('controls elements from JavaScript with Webvelop.$ and the elements passed to the code', async () => {
    let project = createWebsiteProject({ name: 'Blank', templateId: 'blank' });
    const page = project.pages[0];
    const button = createElement('button', { name: 'Go' });
    const title = createElement('heading', { name: 'Big title', props: { text: 'Before', level: 'h1' } });
    const input = createElement('input', { name: 'Email field', props: { fieldName: 'email' } });
    project = {
      ...project,
      pages: [
        {
          ...page,
          root: { ...page.root, children: [title, input, button] },
          script: "Webvelop.$('Email field').value('ada@example.com');",
          events: [
            {
              id: 'v1',
              trigger: { type: 'click', target: button.id, params: {} },
              conditions: [],
              actions: [
                {
                  id: 'a1',
                  type: 'javascript',
                  params: {
                    elements: [{ id: title.id, as: 'bigTitle' }],
                    code:
                      "elements.bigTitle.text('After ' + Webvelop.$('Email field').value()).addClass('done').css('color', 'red');\nelements.self.hide();",
                  },
                },
              ],
              elseActions: [],
            },
          ],
        },
      ],
    };
    const { files, issues } = buildWebsiteFiles(project, runtime);
    expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
    const Webvelop = loadExportedPage(files, 'index.html');
    const handle = Webvelop.$('Big title');
    expect(handle.exists).toBe(true);
    expect(handle.text()).toBe('Before');
    expect(Webvelop.$('Email field').value()).toBe('ada@example.com');
    Webvelop.$('Go').click();
    await flush();
    await flush();
    expect(handle.text()).toBe('After ada@example.com');
    expect(handle.hasClass('done')).toBe(true);
    expect(handle.dom.style.color).toBe('red');
    expect(Webvelop.$('Go').isVisible()).toBe(false);
    // Chaining and events.
    let clicks = 0;
    Webvelop.$('Big title').show().on('click', () => clicks++).click();
    expect(clicks).toBe(1);
    expect(Webvelop.$('Missing element').exists).toBe(false);
  });

  it('reports syntax errors in user code without breaking the website', () => {
    let project = createWebsiteProject({ name: 'Blank', templateId: 'blank' });
    project = {
      ...project,
      scripts: [{ id: 's1', name: 'broken.js', placement: 'body', code: 'const = ;' }],
    };
    const { files, issues } = buildWebsiteFiles(project, runtime);
    expect(issues.some(issue => issue.severity === 'error' && issue.source.includes('broken.js'))).toBe(true);
    // The generated site.js is still valid JavaScript.
    expect(() => loadExportedPage(files, 'index.html')).not.toThrow();
  });
});
