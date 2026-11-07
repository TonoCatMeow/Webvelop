// @flow
// Settings of the website: general information, theme, variables, style
// classes, and advanced code (head HTML, global CSS).
import * as React from 'react';
import { useWebsiteEditor } from '../WebsiteEditorContext';
import { TextInput, SelectInput, CheckboxInput, FieldLabel, ColorInput, AssetPicker } from '../Fields/Fields';
import { CodeEditor } from '../../CodeEditor';
import CodeEditorPanel from '../Code/CodeEditorPanel';
import { addVariable, addStyleClass, setHomePage, ASSET_REFERENCE_PREFIX, isAssetReference, getAssetIdFromReference } from '../../Website/Model/ProjectOps';
import { toVariableName, slugify } from '../../Website/Model/Ids';
import RaisedButton from '../../UI/RaisedButton';
import Add from '../../UI/CustomSvgIcons/Add';

const sections = [
  { id: 'general', label: 'General' },
  { id: 'theme', label: 'Theme (colors and fonts)' },
  { id: 'variables', label: 'Variables (state)' },
  { id: 'classes', label: 'Style classes' },
  { id: 'advanced', label: 'Custom code (head, global CSS)' },
];

const SiteSettingsTab = ({ initialSection }: {| initialSection?: ?string |}) => {
  const { project, updateProject } = useWebsiteEditor();
  const [section, setSection] = React.useState<string>(initialSection || 'general');
  React.useEffect(
    () => {
      if (initialSection) setSection(initialSection);
    },
    [initialSection]
  );
  const update = (updater: any => any, mergeKey?: string) =>
    updateProject(updater, { mergeKey: mergeKey ? `settings-${mergeKey}` : undefined });
  const setSetting = (name: string, value: any) =>
    update(current => ({ ...current, settings: { ...current.settings, [name]: value } }), name);

  return (
    <div className="wve-editor">
      <div className="wve-panel" style={{ width: 240, flexShrink: 0, paddingTop: 8 }}>
        {sections.map(s => (
          <div
            key={s.id}
            className={`wve-site-item ${section === s.id ? 'wve-selected' : ''}`}
            style={{ paddingLeft: 16 }}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </div>
        ))}
      </div>
      <div className="wve-scroll">
        {section === 'general' && (
          <div className="wve-form">
            <h3>General</h3>
            <div>
              <FieldLabel>Name of the project</FieldLabel>
              <TextInput value={project.name} onChange={name => name.trim() && update(current => ({ ...current, name: name.trim() }))} />
            </div>
            <div>
              <FieldLabel>Title of the website (shown in the browser tab and search engines)</FieldLabel>
              <TextInput value={project.settings.title} onChange={value => setSetting('title', value)} />
            </div>
            <div>
              <FieldLabel>Description (for search engines and social networks)</FieldLabel>
              <TextInput value={project.settings.description} onChange={value => setSetting('description', value)} multiline />
            </div>
            <div className="wve-row">
              <div className="wve-grow">
                <FieldLabel>Language code of the content</FieldLabel>
                <TextInput value={project.settings.language} onChange={value => setSetting('language', value)} />
              </div>
              <div className="wve-grow">
                <FieldLabel>Author</FieldLabel>
                <TextInput value={project.author} onChange={author => update(current => ({ ...current, author }))} />
              </div>
              <div className="wve-grow">
                <FieldLabel>Version</FieldLabel>
                <TextInput value={project.version} onChange={version => update(current => ({ ...current, version }))} />
              </div>
            </div>
            <div>
              <FieldLabel>Home page (exported as index.html)</FieldLabel>
              <SelectInput
                value={project.settings.homePageId}
                onChange={pageId => update(current => setHomePage(current, pageId))}
                options={project.pages.map(page => ({ value: page.id, label: page.name }))}
              />
            </div>
            <div>
              <FieldLabel>Favicon (icon in the browser tab)</FieldLabel>
              <AssetPicker
                kind="image"
                allowUrl={false}
                value={project.settings.faviconAssetId ? ASSET_REFERENCE_PREFIX + project.settings.faviconAssetId : ''}
                onChange={value => setSetting('faviconAssetId', isAssetReference(value) ? getAssetIdFromReference(value) : null)}
              />
            </div>
          </div>
        )}
        {section === 'theme' && (
          <div className="wve-form">
            <h3>Colors</h3>
            <div className="wve-muted">
              Theme colors are CSS variables (<code>var(--color-primary)</code>...). Change them here to restyle the whole
              website.
            </div>
            {project.theme.colors.map((color, index) => (
              <div className="wve-row" key={index}>
                <div style={{ width: 160 }}>
                  <TextInput
                    value={color.name}
                    onChange={name =>
                      update(current => ({
                        ...current,
                        theme: { ...current.theme, colors: current.theme.colors.map((c, i) => (i === index ? { ...c, name: slugify(name) } : c)) },
                      }))
                    }
                  />
                </div>
                <ColorInput
                  allowThemeColors={false}
                  value={color.value}
                  onChange={value =>
                    update(
                      current => ({
                        ...current,
                        theme: { ...current.theme, colors: current.theme.colors.map((c, i) => (i === index ? { ...c, value } : c)) },
                      }),
                      'color-' + index
                    )
                  }
                />
                <button
                  className="wve-icon-button"
                  title="Remove"
                  onClick={() => update(current => ({ ...current, theme: { ...current.theme, colors: current.theme.colors.filter((_, i) => i !== index) } }))}
                >
                  ×
                </button>
              </div>
            ))}
            <div>
              <button
                className="wve-add-instruction"
                onClick={() =>
                  update(current => ({
                    ...current,
                    theme: { ...current.theme, colors: [...current.theme.colors, { name: 'color' + (current.theme.colors.length + 1), value: '#f59e0b' }] },
                  }))
                }
              >
                + Add a color
              </button>
            </div>
            <h3>Fonts</h3>
            {project.theme.fonts.map((font, index) => (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="wve-row">
                  <div style={{ width: 160 }}>
                    <TextInput
                      value={font.name}
                      onChange={name =>
                        update(current => ({
                          ...current,
                          theme: { ...current.theme, fonts: current.theme.fonts.map((f, i) => (i === index ? { ...f, name: slugify(name) } : f)) },
                        }))
                      }
                    />
                  </div>
                  <div className="wve-grow">
                    <TextInput
                      value={font.family}
                      placeholder={font.googleFont ? 'Google Font name, like Inter or Playfair Display' : 'CSS font family'}
                      onChange={family =>
                        update(current => ({
                          ...current,
                          theme: { ...current.theme, fonts: current.theme.fonts.map((f, i) => (i === index ? { ...f, family } : f)) },
                        }))
                      }
                    />
                  </div>
                  <button
                    className="wve-icon-button"
                    title="Remove"
                    onClick={() => update(current => ({ ...current, theme: { ...current.theme, fonts: current.theme.fonts.filter((_, i) => i !== index) } }))}
                  >
                    ×
                  </button>
                </div>
                <CheckboxInput
                  checked={font.googleFont}
                  onChange={googleFont =>
                    update(current => ({
                      ...current,
                      theme: {
                        ...current.theme,
                        fonts: current.theme.fonts.map((f, i) =>
                          i === index ? { ...f, googleFont, family: googleFont ? 'Inter' : "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" } : f
                        ),
                      },
                    }))
                  }
                  label="Load from Google Fonts (requires an internet connection for visitors)"
                />
              </div>
            ))}
            <div>
              <button
                className="wve-add-instruction"
                onClick={() =>
                  update(current => ({
                    ...current,
                    theme: { ...current.theme, fonts: [...current.theme.fonts, { name: 'font' + (current.theme.fonts.length + 1), family: 'Georgia, serif', googleFont: false }] },
                  }))
                }
              >
                + Add a font
              </button>
            </div>
            <div className="wve-muted wve-small">
              The "body" font is used for all texts and the "heading" font for titles. Font files imported as assets can
              also be used: their family is the name of the file.
            </div>
            <div style={{ width: 220 }}>
              <FieldLabel>Base font size</FieldLabel>
              <TextInput value={project.theme.baseFontSize} onChange={baseFontSize => update(current => ({ ...current, theme: { ...current.theme, baseFontSize } }))} />
            </div>
          </div>
        )}
        {section === 'variables' && (
          <div className="wve-form">
            <h3>Variables</h3>
            <div className="wve-muted" style={{ lineHeight: 1.5 }}>
              Variables are the state of the website. Display them in texts with <code>{'{{state.name}}'}</code>, change
              them with interactions ("Change a variable"), read them in JavaScript with <code>state.get('name')</code> and
              in React components with <code>Webvelop.useVariable('name')</code>.
            </div>
            <table className="wve-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Initial value</th>
                  <th>Remember</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {project.variables.map((variable, index) => {
                  const setVariable = (changes: any) =>
                    update(current => ({
                      ...current,
                      variables: current.variables.map((v, i) => (i === index ? { ...v, ...changes } : v)),
                    }));
                  return (
                    <tr key={variable.id}>
                      <td>
                        <TextInput value={variable.name} onChange={name => toVariableName(name) && setVariable({ name: toVariableName(name) })} />
                      </td>
                      <td style={{ width: 120 }}>
                        <SelectInput
                          value={variable.type}
                          onChange={type => setVariable({ type })}
                          options={[
                            { value: 'string', label: 'Text' },
                            { value: 'number', label: 'Number' },
                            { value: 'boolean', label: 'Boolean' },
                            { value: 'json', label: 'JSON' },
                          ]}
                        />
                      </td>
                      <td>
                        <TextInput value={variable.initialValue} onChange={initialValue => setVariable({ initialValue })} />
                      </td>
                      <td style={{ width: 90, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          title="Keep the value in the browser of the visitor"
                          checked={variable.persist}
                          onChange={e => setVariable({ persist: e.target.checked })}
                        />
                      </td>
                      <td style={{ width: 30 }}>
                        <button
                          className="wve-icon-button"
                          onClick={() => update(current => ({ ...current, variables: current.variables.filter((_, i) => i !== index) }))}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div>
              <RaisedButton
                icon={<Add />}
                label="Add a variable"
                onClick={() => update(current => addVariable(current, 'variable' + (current.variables.length + 1)).project)}
              />
            </div>
          </div>
        )}
        {section === 'classes' && (
          <div className="wve-form">
            <h3>Style classes</h3>
            <div className="wve-muted" style={{ lineHeight: 1.5 }}>
              Classes share styles between elements: apply them in the Settings panel of an element, then edit the class
              styles from the Style panel. In exported CSS, a class is named <code>.wvc-name</code>.
            </div>
            {project.styleClasses.length === 0 && <div className="wve-muted">No class yet.</div>}
            {project.styleClasses.map((styleClass, index) => (
              <div className="wve-row" key={styleClass.id}>
                <span className="wve-chip wve-primary">.{styleClass.name}</span>
                <div className="wve-grow">
                  <TextInput
                    value={styleClass.name}
                    onChange={name =>
                      slugify(name) &&
                      update(current => ({
                        ...current,
                        styleClasses: current.styleClasses.map((c, i) => (i === index ? { ...c, name: slugify(name) } : c)),
                      }))
                    }
                  />
                </div>
                <span className="wve-muted wve-small">
                  {Object.keys(styleClass.styles.desktop || {}).length} properties
                </span>
                <button
                  className="wve-icon-button"
                  title="Delete the class"
                  onClick={() =>
                    update(current => ({
                      ...current,
                      styleClasses: current.styleClasses.filter(c => c.id !== styleClass.id),
                    }))
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <div>
              <RaisedButton
                icon={<Add />}
                label="Add a class"
                onClick={() => update(current => addStyleClass(current, 'class-' + (current.styleClasses.length + 1)).project)}
              />
            </div>
          </div>
        )}
        {section === 'advanced' && (
          <div className="wve-form" style={{ maxWidth: 'none' }}>
            <h3>Code added in the &lt;head&gt; of every page</h3>
            <div className="wve-muted">Meta tags, analytics, external stylesheets or scripts...</div>
            <div style={{ height: 180, border: '1px solid var(--theme-list-item-separator-color)' }}>
              <CodeEditor language="html" value={project.settings.headHtml} onChange={value => setSetting('headHtml', value)} />
            </div>
            <h3>Global CSS</h3>
            <div className="wve-muted">CSS applied to every page, after the styles of the elements.</div>
            <div style={{ border: '1px solid var(--theme-list-item-separator-color)', display: 'flex' }}>
              <CodeEditorPanel
                language="css"
                height={360}
                value={project.settings.globalCss}
                onChange={value => setSetting('globalCss', value)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SiteSettingsTab;
