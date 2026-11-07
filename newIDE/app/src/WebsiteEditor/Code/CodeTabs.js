// @flow
// Editors of the code of a website: React components, scripts, the code of
// a page and custom actions.
import * as React from 'react';
import CodeEditorPanel from './CodeEditorPanel';
import { useWebsiteEditor } from '../WebsiteEditorContext';
import { compileReactComponent, checkFunctionSyntax, type CodeError } from '../../Website/Rendering/ReactCompiler';
import { generateThemeCss } from '../../Website/Rendering/CssGenerator';
import { getRuntimeSources } from '../../Website/Services/RuntimeSources';
import { toComponentName, toVariableName } from '../../Website/Model/Ids';
import { PropsDefinitionsEditor } from '../DocumentEditor/ComponentPropsEditor';
import { TextInput, SelectInput, FieldLabel } from '../Fields/Fields';
import { escapeAttribute } from '../../Website/Rendering/HtmlRenderer';
import { toScriptJson } from '../../Website/Rendering/SiteBuilder';

const useDebouncedValue = (value: any, delay: number) => {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(
    () => {
      const timeout = setTimeout(() => setDebounced(value), delay);
      return () => clearTimeout(timeout);
    },
    [value, delay]
  );
  return debounced;
};

const syntaxProblems = (code: string, parameters: Array<string>, isAsync: boolean): Array<CodeError> => {
  const error = checkFunctionSyntax(code, parameters, { isAsync });
  // Line numbers are offset by the function header.
  return error ? [{ ...error, line: error.line ? Math.max(1, error.line - 2) : null }] : [];
};

const SidePanel = ({ children }: {| children: React.Node |}) => (
  <div className="wve-panel wve-right" style={{ width: 320, flexShrink: 0 }}>
    <div className="wve-scroll" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {children}
    </div>
  </div>
);

// React components

const ReactPreview = ({ componentId }: {| componentId: string |}) => {
  const { project, resolveAssetUrl } = useWebsiteEditor();
  const component = project.reactComponents.find(c => c.id === componentId);
  const debouncedComponent = useDebouncedValue(component, 600);
  const [srcDoc, setSrcDoc] = React.useState<string>('');
  React.useEffect(
    () => {
      if (!debouncedComponent) return;
      let cancelled = false;
      getRuntimeSources().then(sources => {
        if (cancelled) return;
        const compiled = compileReactComponent(debouncedComponent);
        const props = {};
        debouncedComponent.props.forEach(prop => {
          props[prop.name] =
            prop.type === 'number' ? parseFloat(prop.defaultValue) || 0 : prop.type === 'boolean' ? prop.defaultValue === 'true' : prop.defaultValue;
        });
        const safe = (code: string) => code.replace(/<\/script/gi, '<\\/script');
        setSrcDoc(
          `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${sources.runtimeCss}\n${generateThemeCss(project, resolveAssetUrl)}\n${debouncedComponent.css || ''}</style></head>` +
            `<body style="padding:24px"><div data-wv-react="${escapeAttribute(debouncedComponent.name)}" data-wv-props="${escapeAttribute(JSON.stringify(props))}"></div>` +
            `<script>${safe(sources.reactJs)}</script><script>${safe(sources.reactDomJs)}</script><script>${safe(sources.runtimeJs)}</script>` +
            `<script>Webvelop.configureSite(${toScriptJson({ name: project.name, pages: [], variables: project.variables, globalEvents: [], components: {} })});\n${safe(compiled.registrationCode)}\nWebvelop.start({ mode: 'editor' });</script></body></html>`
        );
      });
      return () => {
        cancelled = true;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedComponent, project.theme, project.variables]
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <FieldLabel>Live preview (with the default values of the props)</FieldLabel>
      <iframe
        title="React component preview"
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        style={{ width: '100%', height: 220, border: '1px solid var(--theme-list-item-separator-color)', borderRadius: 6, background: '#fff' }}
      />
    </div>
  );
};

export const ReactComponentTab = ({ componentId }: {| componentId: string |}) => {
  const { project, updateProject } = useWebsiteEditor();
  const [mode, setMode] = React.useState<'code' | 'css'>('code');
  const component = project.reactComponents.find(c => c.id === componentId);
  const debouncedCode = useDebouncedValue(component ? component.code : '', 400);
  const problems = React.useMemo(
    () => (component ? compileReactComponent({ ...component, code: debouncedCode }).errors : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedCode, component ? component.name : '']
  );
  if (!component) return <div className="wve-empty">This React component does not exist anymore.</div>;
  const update = (changes: any, mergeKey?: string) =>
    updateProject(
      current => ({
        ...current,
        reactComponents: current.reactComponents.map(c => (c.id === componentId ? { ...c, ...changes } : c)),
      }),
      { mergeKey: mergeKey ? `react-${componentId}-${mergeKey}` : undefined }
    );
  return (
    <div className="wve-code-layout">
      <CodeEditorPanel
        key={mode}
        language={mode === 'code' ? 'javascript' : 'css'}
        value={mode === 'code' ? component.code : component.css}
        onChange={value => update(mode === 'code' ? { code: value } : { css: value }, mode)}
        problems={mode === 'code' ? problems : undefined}
        toolbar={
          <div className="wve-segmented" style={{ flex: 'none', width: 220 }}>
            <button className={mode === 'code' ? 'wve-active' : ''} onClick={() => setMode('code')}>
              {component.name}.jsx
            </button>
            <button className={mode === 'css' ? 'wve-active' : ''} onClick={() => setMode('css')}>
              Styles (CSS)
            </button>
          </div>
        }
      />
      <SidePanel>
        <div>
          <FieldLabel>Component name (must match the function name)</FieldLabel>
          <TextInput
            value={component.name}
            onChange={name => {
              const newName = toComponentName(name);
              if (!newName || newName === component.name) return;
              const renamedCode = component.code.replace(new RegExp(`\\b${component.name}\\b`, 'g'), newName);
              update({ name: newName, code: renamedCode });
            }}
          />
        </div>
        <div>
          <FieldLabel>Description</FieldLabel>
          <TextInput value={component.description} onChange={description => update({ description })} multiline />
        </div>
        <ReactPreview componentId={componentId} />
        <FieldLabel>Props</FieldLabel>
        <PropsDefinitionsEditor
          props={component.props}
          onChange={props => update({ props })}
          usageHint="Props are received by the component function and can be set for each use of the component, in the Settings panel."
        />
        <div className="wve-muted wve-small" style={{ lineHeight: 1.5 }}>
          React and its hooks (useState, useEffect...) are available without imports. Use{' '}
          <code>Webvelop.useVariable('name')</code> to read and change a variable of the website, shared with
          interactions and texts.
        </div>
      </SidePanel>
    </div>
  );
};

// Scripts

export const ScriptTab = ({ scriptId }: {| scriptId: string |}) => {
  const { project, updateProject } = useWebsiteEditor();
  const script = project.scripts.find(s => s.id === scriptId);
  const debouncedCode = useDebouncedValue(script ? script.code : '', 400);
  const problems = React.useMemo(
    () => (script && script.placement !== 'head' ? syntaxProblems(debouncedCode, ['Webvelop', 'state'], false) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedCode, script ? script.placement : '']
  );
  if (!script) return <div className="wve-empty">This script does not exist anymore.</div>;
  const update = (changes: any, mergeKey?: string) =>
    updateProject(
      current => ({ ...current, scripts: current.scripts.map(s => (s.id === scriptId ? { ...s, ...changes } : s)) }),
      { mergeKey: mergeKey ? `script-${scriptId}-${mergeKey}` : undefined }
    );
  return (
    <div className="wve-code-layout">
      <CodeEditorPanel
        language="javascript"
        value={script.code}
        onChange={code => update({ code }, 'code')}
        problems={problems}
        toolbar={<strong>{script.name}</strong>}
      />
      <SidePanel>
        <div>
          <FieldLabel>File name</FieldLabel>
          <TextInput value={script.name} onChange={name => name.trim() && update({ name: name.trim() })} />
        </div>
        <div>
          <FieldLabel>When to run it</FieldLabel>
          <SelectInput
            value={script.placement}
            onChange={placement => update({ placement })}
            options={[
              { value: 'body', label: 'When the page is ready (recommended)' },
              { value: 'head', label: 'In the <head>, before the page is built' },
            ]}
          />
        </div>
        <div className="wve-muted wve-small" style={{ lineHeight: 1.5 }}>
          This script runs on every page. Available: <code>Webvelop</code> (find elements with{' '}
          <code>Webvelop.element('Name')</code>, navigate with <code>Webvelop.goToPage('About')</code>...) and{' '}
          <code>state</code> (the variables of the website).
        </div>
      </SidePanel>
    </div>
  );
};

// Page code

export const PageCodeTab = ({ pageId }: {| pageId: string |}) => {
  const { project, updateProject } = useWebsiteEditor();
  const [mode, setMode] = React.useState<'script' | 'css'>('script');
  const page = project.pages.find(p => p.id === pageId);
  const debouncedCode = useDebouncedValue(page ? page.script : '', 400);
  const problems = React.useMemo(() => syntaxProblems(debouncedCode, ['Webvelop', 'state'], false), [debouncedCode]);
  if (!page) return <div className="wve-empty">This page does not exist anymore.</div>;
  const update = (changes: any, mergeKey?: string) =>
    updateProject(
      current => ({ ...current, pages: current.pages.map(p => (p.id === pageId ? { ...p, ...changes } : p)) }),
      { mergeKey: mergeKey ? `page-code-${pageId}-${mergeKey}` : undefined }
    );
  return (
    <div className="wve-code-layout">
      <CodeEditorPanel
        key={mode}
        language={mode === 'script' ? 'javascript' : 'css'}
        value={mode === 'script' ? page.script : page.css}
        onChange={value => update(mode === 'script' ? { script: value } : { css: value }, mode)}
        problems={mode === 'script' ? problems : undefined}
        pickerDocRef={{ kind: 'page', id: pageId }}
        toolbar={
          <div className="wve-segmented" style={{ flex: 'none', width: 260 }}>
            <button className={mode === 'script' ? 'wve-active' : ''} onClick={() => setMode('script')}>
              JavaScript of "{page.name}"
            </button>
            <button className={mode === 'css' ? 'wve-active' : ''} onClick={() => setMode('css')}>
              CSS of the page
            </button>
          </div>
        }
      />
      <SidePanel>
        <div className="wve-muted wve-small" style={{ lineHeight: 1.6 }}>
          {mode === 'script' ? (
            <>
              This JavaScript runs when the page "{page.name}" is ready, after the scripts of the website.
              <br />
              <br />
              Control any element of the page from the code with{' '}
              <code>Webvelop.$('{(page.root.children[0] || { name: 'Header' }).name}')</code>, or click{' '}
              <b>⌖ Insert element</b> to pick one on a preview of the page.
              <br />
              <br />
              Examples: <code>.text('Hello')</code>, <code>.hide()</code>, <code>.addClass('active')</code>,{' '}
              <code>.css('color', 'red')</code>, <code>.onClick(() =&gt; ...)</code>, <code>.animate('pulse')</code>,{' '}
              <code>.find('Button')</code>. Variables: <code>Webvelop.state</code>.
            </>
          ) : (
            <>
              CSS added to this page only. Elements have the class <code>.wv-&lt;id&gt;</code>, and shared classes are
              available as <code>.wvc-&lt;name&gt;</code>. Prefer the Style panel for most styling.
            </>
          )}
        </div>
      </SidePanel>
    </div>
  );
};

// Custom actions

export const CustomActionTab = ({ customActionId }: {| customActionId: string |}) => {
  const { project, updateProject } = useWebsiteEditor();
  const customAction = project.customActions.find(a => a.id === customActionId);
  const debouncedCode = useDebouncedValue(customAction ? customAction.code : '', 400);
  const problems = React.useMemo(() => syntaxProblems(debouncedCode, ['params', 'context'], true), [debouncedCode]);
  if (!customAction) return <div className="wve-empty">This custom action does not exist anymore.</div>;
  const update = (changes: any, mergeKey?: string) =>
    updateProject(
      current => ({
        ...current,
        customActions: current.customActions.map(a => (a.id === customActionId ? { ...a, ...changes } : a)),
      }),
      { mergeKey: mergeKey ? `custom-action-${customActionId}-${mergeKey}` : undefined }
    );
  return (
    <div className="wve-code-layout">
      <CodeEditorPanel
        language="javascript"
        value={customAction.code}
        onChange={code => update({ code }, 'code')}
        problems={problems}
        isSnippet
        toolbar={<strong>Action: {customAction.label || customAction.name}</strong>}
      />
      <SidePanel>
        <div>
          <FieldLabel>Name shown in the list of actions</FieldLabel>
          <TextInput value={customAction.label} onChange={label => update({ label })} />
        </div>
        <div>
          <FieldLabel>Identifier</FieldLabel>
          <TextInput
            value={customAction.name}
            onChange={name => {
              const newName = toVariableName(name);
              if (newName) update({ name: newName });
            }}
          />
        </div>
        <div>
          <FieldLabel>Description</FieldLabel>
          <TextInput value={customAction.description} onChange={description => update({ description })} multiline />
        </div>
        <FieldLabel>Parameters</FieldLabel>
        {customAction.params.map((param, index) => (
          <div key={index} className="wve-row">
            <div className="wve-grow">
              <TextInput
                value={param.name}
                onChange={name =>
                  update({ params: customAction.params.map((p, i) => (i === index ? { ...p, name: toVariableName(name), label: p.label || name } : p)) })
                }
              />
            </div>
            <div style={{ width: 110 }}>
              <SelectInput
                value={param.type}
                onChange={type => update({ params: customAction.params.map((p, i) => (i === index ? { ...p, type } : p)) })}
                options={[
                  { value: 'element', label: 'Element' },
                  { value: 'text', label: 'Text' },
                  { value: 'number', label: 'Number' },
                  { value: 'variable', label: 'Variable' },
                  { value: 'page', label: 'Page' },
                ]}
              />
            </div>
            <button className="wve-icon-button" onClick={() => update({ params: customAction.params.filter((_, i) => i !== index) })}>
              ×
            </button>
          </div>
        ))}
        <button
          className="wve-add-instruction"
          onClick={() => update({ params: [...customAction.params, { name: 'value' + (customAction.params.length + 1), label: 'Value', type: 'text' }] })}
        >
          + Add a parameter
        </button>
        <div className="wve-muted wve-small" style={{ lineHeight: 1.5 }}>
          This action appears in the "Custom actions" group of the interactions editor. The code receives{' '}
          <code>params</code> (element parameters are arrays of DOM elements) and <code>context</code> (
          <code>context.element</code>, <code>context.event</code>, <code>context.state</code>). It can use{' '}
          <code>await</code>.
        </div>
      </SidePanel>
    </div>
  );
};
