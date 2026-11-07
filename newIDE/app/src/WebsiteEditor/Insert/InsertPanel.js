// @flow
// The "Insert" panel: elements, ready-made blocks, components and React
// components. Items can be clicked (inserted after/inside the selection) or
// dragged onto the canvas.
import * as React from 'react';
import { ELEMENT_TYPES, ELEMENT_CATEGORIES } from '../../Website/Elements/ElementTypes';
import { PRESETS } from '../../Website/Elements/Presets';
import { type WebsiteProject } from '../../Website/Model/Schema';
import { ElementIcon, ReactIcon } from '../ElementIcons';
import { PanelSection, TextInput } from '../Fields/Fields';

export type InsertPayload =
  | {| kind: 'element', type: string, label: string |}
  | {| kind: 'preset', id: string, label: string |}
  | {| kind: 'component', componentId: string, label: string |}
  | {| kind: 'react', reactComponentId: string, label: string |};

type Props = {|
  project: WebsiteProject,
  /** Id of the component being edited (it can't be inserted in itself). */
  editedComponentId: ?string,
  onInsert: (payload: InsertPayload) => void,
  onDragStart: (payload: InsertPayload) => void,
  onDragEnd: () => void,
|};

const makeDraggableItemProps = (
  payload: InsertPayload,
  onInsert: InsertPayload => void,
  onDragStart: InsertPayload => void,
  onDragEnd: () => void,
  setGhost: (?{| label: string, x: number, y: number |}) => void
) => ({
  onMouseDown: (e: SyntheticMouseEvent<>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    const onMove = (event: MouseEvent) => {
      if (!dragging && Math.hypot(event.clientX - startX, event.clientY - startY) > 5) {
        dragging = true;
        onDragStart(payload);
      }
      if (dragging) setGhost({ label: payload.label, x: event.clientX + 12, y: event.clientY + 12 });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setGhost(null);
      if (dragging) {
        // Let the canvas handle the drop first.
        setTimeout(onDragEnd, 0);
      } else onInsert(payload);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  },
});

const InsertPanel = ({ project, editedComponentId, onInsert, onDragStart, onDragEnd }: Props) => {
  const [search, setSearch] = React.useState('');
  const [ghost, setGhost] = React.useState<?{| label: string, x: number, y: number |}>(null);
  const matches = (text: string) => !search || text.toLowerCase().includes(search.toLowerCase());
  const itemProps = (payload: InsertPayload) =>
    makeDraggableItemProps(payload, onInsert, onDragStart, onDragEnd, setGhost);

  const components = project.components.filter(
    component => component.id !== editedComponentId && matches(component.name)
  );
  const reactComponents = project.reactComponents.filter(component => matches(component.name));

  return (
    <div className="wve-scroll">
      <div style={{ padding: 8 }}>
        <TextInput value={search} onChange={setSearch} onLiveChange={setSearch} placeholder="Search elements..." />
      </div>
      {ELEMENT_CATEGORIES.map(category => {
        const types = ELEMENT_TYPES.filter(
          definition =>
            definition.category === category.id &&
            definition.type !== 'component' &&
            definition.type !== 'react' &&
            matches(definition.label + ' ' + definition.description)
        );
        if (!types.length) return null;
        return (
          <PanelSection key={category.id} title={category.label}>
            <div className="wve-insert-grid">
              {types.map(definition => (
                <button
                  key={definition.type}
                  className="wve-insert-item"
                  title={definition.description}
                  {...itemProps({ kind: 'element', type: definition.type, label: definition.label })}
                >
                  <ElementIcon name={definition.icon} />
                  {definition.label}
                </button>
              ))}
            </div>
          </PanelSection>
        );
      })}
      {['sections', 'widgets'].map(categoryId => {
        const presets = PRESETS.filter(preset => preset.category === categoryId && matches(preset.label + ' ' + preset.description));
        if (!presets.length) return null;
        return (
          <PanelSection key={categoryId} title={categoryId === 'sections' ? 'Ready-made sections' : 'Interactive widgets'}>
            {presets.map(preset => (
              <button
                key={preset.id}
                className="wve-insert-wide"
                {...itemProps({ kind: 'preset', id: preset.id, label: preset.label })}
              >
                <strong>{preset.label}</strong>
                <span>{preset.description}</span>
              </button>
            ))}
          </PanelSection>
        );
      })}
      <PanelSection title="Components of the website">
        {components.length === 0 && (
          <div className="wve-muted wve-small">
            No component yet. Right-click an element and choose "Convert to a component" to reuse it.
          </div>
        )}
        {components.map(component => (
          <button
            key={component.id}
            className="wve-insert-wide"
            {...itemProps({ kind: 'component', componentId: component.id, label: component.name })}
          >
            <strong>
              <ElementIcon name="component" /> {component.name}
            </strong>
            {component.description && <span>{component.description}</span>}
          </button>
        ))}
      </PanelSection>
      <PanelSection title="React components">
        {reactComponents.length === 0 && (
          <div className="wve-muted wve-small">No React component yet. Create one from the website panel.</div>
        )}
        {reactComponents.map(component => (
          <button
            key={component.id}
            className="wve-insert-wide"
            {...itemProps({ kind: 'react', reactComponentId: component.id, label: component.name })}
          >
            <strong>
              <ReactIcon style={{ width: 14, height: 14, verticalAlign: 'middle' }} /> {component.name}
            </strong>
            {component.description && <span>{component.description}</span>}
          </button>
        ))}
      </PanelSection>
      {ghost && (
        <div className="wve-drag-ghost" style={{ left: ghost.x, top: ghost.y }}>
          {ghost.label}
        </div>
      )}
    </div>
  );
};

export default InsertPanel;
