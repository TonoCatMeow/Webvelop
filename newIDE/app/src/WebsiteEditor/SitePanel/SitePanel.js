// @flow
// The "Website" panel (replacing the project manager of the original editor):
// pages, components, React components, scripts, custom actions, assets and settings.
import * as React from 'react';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import { useWebsiteEditor } from '../WebsiteEditorContext';
import { usePrompt } from '../Fields/PromptDialog';
import {
  addPage,
  duplicatePage,
  removePage,
  setHomePage,
  movePage,
  addComponent,
  removeComponent,
  addReactComponent,
  addScript,
  addCustomAction,
  getComponentUsages,
  makeUniqueSlug,
  getPageFileName,
} from '../../Website/Model/ProjectOps';
import { buildHero } from '../../Website/Elements/Presets';
import { ElementIcon, ReactIcon } from '../ElementIcons';
import useAlertDialog from '../../UI/Alert/useAlertDialog';
import Add from '../../UI/CustomSvgIcons/Add';
import ThreeDotsMenu from '../../UI/CustomSvgIcons/ThreeDotsMenu';
import Home from '../../UI/CustomSvgIcons/Home';
import Dialog, { DialogPrimaryButton } from '../../UI/Dialog';
import FlatButton from '../../UI/FlatButton';
import { TextInput, FieldLabel } from '../Fields/Fields';
import { slugify } from '../../Website/Model/Ids';

type Props = {|
  currentTabKey: ?string,
  onClose: () => void,
|};

export const Group = ({
  title,
  onAdd,
  addLabel,
  children,
}: {|
  title: string,
  onAdd?: () => void,
  addLabel?: string,
  children: React.Node,
|}) => {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="wve-section">
      <div className="wve-section-header" onClick={() => setOpen(!open)}>
        <span>{open ? '▾' : '▸'}</span>
        <span className="wve-grow">{title}</span>
        {onAdd && (
          <button
            className="wve-icon-button"
            title={addLabel}
            onClick={e => {
              e.stopPropagation();
              onAdd();
            }}
          >
            <Add />
          </button>
        )}
      </div>
      {open && <div style={{ paddingBottom: 6 }}>{children}</div>}
    </div>
  );
};

export const Item = ({
  icon,
  label,
  selected,
  onClick,
  onMenu,
  badge,
}: {|
  icon: React.Node,
  label: React.Node,
  selected?: boolean,
  onClick: () => void,
  onMenu?: (x: number, y: number) => void,
  badge?: React.Node,
|}) => (
  <div
    className={`wve-site-item ${selected ? 'wve-selected' : ''}`}
    onClick={onClick}
    onContextMenu={
      onMenu
        ? e => {
            e.preventDefault();
            onMenu(e.clientX, e.clientY);
          }
        : undefined
    }
  >
    {icon}
    <span className="wve-grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {label}
    </span>
    {badge}
    {onMenu && (
      <span className="wve-row-actions">
        <button
          className="wve-icon-button"
          onClick={e => {
            e.stopPropagation();
            onMenu(e.clientX, e.clientY);
          }}
        >
          <ThreeDotsMenu />
        </button>
      </span>
    )}
  </div>
);

const SitePanel = ({ currentTabKey, onClose }: Props) => {
  const { project, updateProject, openTab } = useWebsiteEditor();
  const prompt = usePrompt();
  const { showDeleteConfirmation, showAlert } = useAlertDialog();
  const [menu, setMenu] = React.useState<?{| x: number, y: number, items: Array<{| label: string, onClick: () => void |}> |}>(null);
  const [editingPageId, setEditingPageId] = React.useState<?string>(null);

  const open = (target: any) => {
    openTab(target);
  };

  const createPage = async () => {
    const name = await prompt({ title: 'New page', label: 'Name of the page', defaultValue: 'New page' });
    if (!name) return;
    let pageId = null;
    updateProject(current => {
      const hero = buildHero();
      const result = addPage(current, name, hero.elements);
      pageId = result.page.id;
      return result.project;
    }, { type: 'ADD' });
    if (pageId) open({ kind: 'page', id: pageId });
  };

  const create = async (kind: 'component' | 'react' | 'script' | 'action') => {
    const defaults = {
      component: ['New component', 'Name of the component', 'Card'],
      react: ['New React component', 'Name of the component (like Counter, PriceCalculator...)', 'MyComponent'],
      script: ['New script', 'Name of the script file', 'analytics'],
      action: ['New custom action', 'Name of the action', 'Highlight element'],
    }[kind];
    const name = await prompt({ title: defaults[0], label: defaults[1], defaultValue: defaults[2] });
    if (!name) return;
    let target = null;
    updateProject(current => {
      if (kind === 'component') {
        const result = addComponent(current, name);
        target = { kind: 'component', id: result.component.id };
        return result.project;
      }
      if (kind === 'react') {
        const result = addReactComponent(current, name);
        target = { kind: 'react-component', id: result.reactComponent.id };
        return result.project;
      }
      if (kind === 'script') {
        const result = addScript(current, name);
        target = { kind: 'script', id: result.script.id };
        return result.project;
      }
      const result = addCustomAction(current, name);
      target = { kind: 'custom-action', id: result.customAction.id };
      return result.project;
    }, { type: 'ADD' });
    if (target) open(target);
  };

  const confirmDelete = async (label: string, message: string, onConfirm: () => void) => {
    const confirmed = await showDeleteConfirmation({ title: `Delete ${label}?`, message });
    if (confirmed) onConfirm();
  };

  const editingPage = editingPageId ? project.pages.find(p => p.id === editingPageId) : null;

  return (
    <div className="wve-site-content">
      <div>
        <Item
          icon={<ElementIcon name="settings" />}
          label="Website settings"
          selected={currentTabKey === 'site-settings'}
          onClick={() => open({ kind: 'site-settings' })}
        />
        <Item
          icon={<ElementIcon name="file" />}
          label={`Assets (${project.assets.length})`}
          selected={currentTabKey === 'assets'}
          onClick={() => open({ kind: 'assets' })}
        />
        <Item
          icon={<ElementIcon name="interactions" />}
          label={`Interactions of all pages (${project.globalEvents.length})`}
          selected={currentTabKey === 'site-events'}
          onClick={() => open({ kind: 'site-events' })}
        />
        <Item
          icon={<ElementIcon name="variables" />}
          label={`Variables (${project.variables.length})`}
          onClick={() => open({ kind: 'site-settings', section: 'variables' })}
        />
        <Group title={`Pages (${project.pages.length})`} onAdd={createPage} addLabel="Add a page">
          {project.pages.map((page, index) => (
            <Item
              key={page.id}
              icon={page.id === project.settings.homePageId ? <Home /> : <ElementIcon name="page" />}
              label={page.name}
              badge={<span className="wve-muted wve-small">{getPageFileName(page)}</span>}
              selected={currentTabKey === 'page-' + page.id}
              onClick={() => open({ kind: 'page', id: page.id })}
              onMenu={(x, y) =>
                setMenu({
                  x,
                  y,
                  items: [
                    { label: 'Open', onClick: () => open({ kind: 'page', id: page.id }) },
                    { label: 'Interactions of the page', onClick: () => open({ kind: 'page-events', id: page.id }) },
                    { label: 'JavaScript and CSS of the page', onClick: () => open({ kind: 'page-code', id: page.id }) },
                    { label: 'Page properties (title, URL...)', onClick: () => setEditingPageId(page.id) },
                    { label: 'Set as the home page', onClick: () => updateProject(current => setHomePage(current, page.id)) },
                    {
                      label: 'Duplicate',
                      onClick: () => updateProject(current => duplicatePage(current, page.id).project, { type: 'ADD' }),
                    },
                    { label: 'Move up', onClick: () => updateProject(current => movePage(current, page.id, index - 1)) },
                    { label: 'Move down', onClick: () => updateProject(current => movePage(current, page.id, index + 1)) },
                    {
                      label: 'Delete',
                      onClick: () => {
                        if (project.pages.length <= 1) {
                          showAlert({ title: 'Cannot delete the page', message: 'A website must have at least one page.' });
                          return;
                        }
                        confirmDelete('the page', `The page "${page.name}" and its interactions will be deleted.`, () =>
                          updateProject(current => removePage(current, page.id), { type: 'DELETE' })
                        );
                      },
                    },
                  ],
                })
              }
            />
          ))}
        </Group>
        <Group title={`Components (${project.components.length})`} onAdd={() => create('component')} addLabel="Add a component">
          {project.components.length === 0 && (
            <div className="wve-muted wve-small" style={{ padding: '2px 26px' }}>
              Reusable blocks (headers, cards...). Tip: right-click an element and convert it to a component.
            </div>
          )}
          {project.components.map(component => (
            <Item
              key={component.id}
              icon={<ElementIcon name="component" />}
              label={component.name}
              selected={currentTabKey === 'component-' + component.id}
              onClick={() => open({ kind: 'component', id: component.id })}
              onMenu={(x, y) =>
                setMenu({
                  x,
                  y,
                  items: [
                    { label: 'Edit', onClick: () => open({ kind: 'component', id: component.id }) },
                    {
                      label: 'Delete',
                      onClick: () =>
                        confirmDelete(
                          'the component',
                          `The component "${component.name}" and its ${getComponentUsages(project, component.id).length} instance(s) will be deleted.`,
                          () => updateProject(current => removeComponent(current, component.id), { type: 'DELETE' })
                        ),
                    },
                  ],
                })
              }
            />
          ))}
        </Group>
        <Group title={`React components (${project.reactComponents.length})`} onAdd={() => create('react')} addLabel="Add a React component">
          {project.reactComponents.map(component => (
            <Item
              key={component.id}
              icon={<ReactIcon />}
              label={component.name}
              selected={currentTabKey === 'react-component-' + component.id}
              onClick={() => open({ kind: 'react-component', id: component.id })}
              onMenu={(x, y) =>
                setMenu({
                  x,
                  y,
                  items: [
                    {
                      label: 'Delete',
                      onClick: () =>
                        confirmDelete('the React component', `"${component.name}" will be deleted. Elements using it will be empty.`, () =>
                          updateProject(
                            current => ({ ...current, reactComponents: current.reactComponents.filter(c => c.id !== component.id) }),
                            { type: 'DELETE' }
                          )
                        ),
                    },
                  ],
                })
              }
            />
          ))}
        </Group>
        <Group title={`Scripts (${project.scripts.length})`} onAdd={() => create('script')} addLabel="Add a JavaScript file">
          {project.scripts.map(script => (
            <Item
              key={script.id}
              icon={<ElementIcon name="script" />}
              label={script.name}
              selected={currentTabKey === 'script-' + script.id}
              onClick={() => open({ kind: 'script', id: script.id })}
              onMenu={(x, y) =>
                setMenu({
                  x,
                  y,
                  items: [
                    {
                      label: 'Delete',
                      onClick: () =>
                        confirmDelete('the script', `"${script.name}" will be deleted.`, () =>
                          updateProject(current => ({ ...current, scripts: current.scripts.filter(s => s.id !== script.id) }), {
                            type: 'DELETE',
                          })
                        ),
                    },
                  ],
                })
              }
            />
          ))}
        </Group>
        <Group title={`Custom actions (${project.customActions.length})`} onAdd={() => create('action')} addLabel="Add an action written in JavaScript">
          {project.customActions.map(customAction => (
            <Item
              key={customAction.id}
              icon={<ElementIcon name="customAction" />}
              label={customAction.label || customAction.name}
              selected={currentTabKey === 'custom-action-' + customAction.id}
              onClick={() => open({ kind: 'custom-action', id: customAction.id })}
              onMenu={(x, y) =>
                setMenu({
                  x,
                  y,
                  items: [
                    {
                      label: 'Delete',
                      onClick: () =>
                        confirmDelete('the action', `"${customAction.label}" will be deleted.`, () =>
                          updateProject(
                            current => ({ ...current, customActions: current.customActions.filter(a => a.id !== customAction.id) }),
                            { type: 'DELETE' }
                          )
                        ),
                    },
                  ],
                })
              }
            />
          ))}
        </Group>
      </div>
      <Menu
        open={!!menu}
        onClose={() => setMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={menu ? { top: menu.y, left: menu.x } : undefined}
      >
        {menu &&
          menu.items.map(item => (
            <MenuItem
              key={item.label}
              dense
              onClick={() => {
                setMenu(null);
                item.onClick();
              }}
            >
              {item.label}
            </MenuItem>
          ))}
      </Menu>
      {editingPage && (
        <PagePropertiesDialog page={editingPage} onClose={() => setEditingPageId(null)} />
      )}
    </div>
  );
};

const PagePropertiesDialog = ({ page, onClose }: {| page: any, onClose: () => void |}) => {
  const { project, updateProject } = useWebsiteEditor();
  const [name, setName] = React.useState(page.name);
  const [title, setTitle] = React.useState(page.title);
  const [description, setDescription] = React.useState(page.description);
  const [slug, setSlug] = React.useState(page.slug);
  const isHome = page.slug === 'index';
  const apply = () => {
    updateProject(current => ({
      ...current,
      pages: current.pages.map(p =>
        p.id === page.id
          ? {
              ...p,
              name: name.trim() || p.name,
              title,
              description,
              slug: isHome ? 'index' : makeUniqueSlug(current, slugify(slug) || slugify(name), p.id),
            }
          : p
      ),
    }));
    onClose();
  };
  return (
    <Dialog
      open
      title={`Properties of the page "${page.name}"`}
      maxWidth="sm"
      onRequestClose={onClose}
      onApply={apply}
      actions={[
        <FlatButton key="cancel" label="Cancel" onClick={onClose} />,
        <DialogPrimaryButton key="apply" primary label="Apply" onClick={apply} />,
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <FieldLabel>Name (in the editor)</FieldLabel>
          <TextInput value={name} onChange={setName} onLiveChange={setName} />
        </div>
        <div>
          <FieldLabel>Title (shown in the browser tab, after the site title)</FieldLabel>
          <TextInput value={title} onChange={setTitle} onLiveChange={setTitle} />
        </div>
        <div>
          <FieldLabel>Description (for search engines)</FieldLabel>
          <TextInput value={description} onChange={setDescription} onLiveChange={setDescription} multiline />
        </div>
        <div>
          <FieldLabel>File name / URL</FieldLabel>
          {isHome ? (
            <div className="wve-muted">This is the home page: it is exported as index.html.</div>
          ) : (
            <div className="wve-row">
              <div className="wve-grow">
                <TextInput value={slug} onChange={setSlug} onLiveChange={setSlug} />
              </div>
              <span className="wve-muted">.html</span>
            </div>
          )}
        </div>
        <div className="wve-muted wve-small">Website: {project.settings.title}</div>
      </div>
    </Dialog>
  );
};

export default SitePanel;
