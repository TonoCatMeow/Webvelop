// @flow
// The "Settings" panel: properties of the selected element, values given to
// a component/React component, shared classes and behaviors.
import * as React from 'react';
import {
  type WebsiteElement,
  type ComponentPropDefinition,
} from '../../Website/Model/Schema';
import {
  getElementType,
  COMMON_FIELDS,
  type PropField,
} from '../../Website/Elements/ElementTypes';
import {
  BEHAVIOR_TYPES,
  getBehaviorType,
  getDefaultBehaviorConfig,
} from '../../Website/Behaviors/BehaviorTypes';
import { wouldCreateComponentCycle, addStyleClass } from '../../Website/Model/ProjectOps';
import {
  TextInput,
  SelectInput,
  CheckboxInput,
  FieldLabel,
  AssetPicker,
  HrefInput,
  IconPicker,
  ColorInput,
  PanelSection,
} from '../Fields/Fields';
import { useWebsiteEditor } from '../WebsiteEditorContext';
import { usePrompt } from '../Fields/PromptDialog';

type Props = {|
  element: WebsiteElement,
  isRoot: boolean,
  editedComponentId: ?string,
  onChangeElement: (updater: (WebsiteElement) => WebsiteElement, mergeKey?: string) => void,
|};

const PropFieldInput = ({
  field,
  value,
  onChange,
  editedComponentId,
}: {|
  field: PropField,
  value: any,
  onChange: any => void,
  editedComponentId: ?string,
|}) => {
  const { project } = useWebsiteEditor();
  switch (field.type) {
    case 'longText':
    case 'lines':
      return <TextInput value={value || ''} onChange={onChange} multiline rows={field.type === 'lines' ? 4 : 3} />;
    case 'html':
      return <TextInput value={value || ''} onChange={onChange} multiline code rows={8} />;
    case 'select':
      return (
        <SelectInput value={value || ''} onChange={onChange} options={(field.options || []).map(o => ({ value: o.value, label: o.label }))} />
      );
    case 'boolean':
      return <CheckboxInput checked={!!value} onChange={onChange} label={field.label} />;
    case 'number':
      return <TextInput value={value == null ? '' : String(value)} onChange={onChange} type="number" />;
    case 'image':
      return <AssetPicker kind="image" value={value || ''} onChange={onChange} />;
    case 'video':
      return <AssetPicker kind="video" value={value || ''} onChange={onChange} />;
    case 'href':
      return <HrefInput value={value || ''} onChange={onChange} />;
    case 'icon':
      return <IconPicker value={value || ''} onChange={onChange} allowNone />;
    case 'component':
      return (
        <SelectInput
          value={value || ''}
          onChange={onChange}
          placeholder="Choose a component"
          options={project.components
            .filter(
              component =>
                !editedComponentId ||
                (component.id !== editedComponentId &&
                  !wouldCreateComponentCycle(project, component.id, editedComponentId))
            )
            .map(component => ({ value: component.id, label: component.name }))}
        />
      );
    case 'reactComponent':
      return (
        <SelectInput
          value={value || ''}
          onChange={onChange}
          placeholder="Choose a React component"
          options={project.reactComponents.map(component => ({ value: component.id, label: component.name }))}
        />
      );
    default:
      return <TextInput value={value == null ? '' : String(value)} onChange={onChange} />;
  }
};

const ComponentPropInput = ({
  prop,
  value,
  onChange,
}: {|
  prop: ComponentPropDefinition,
  value: any,
  onChange: any => void,
|}) => {
  switch (prop.type) {
    case 'longText':
      return <TextInput value={value || ''} placeholder={prop.defaultValue} onChange={onChange} multiline />;
    case 'image':
      return <AssetPicker kind="image" value={value || ''} onChange={onChange} />;
    case 'url':
      return <HrefInput value={value || ''} onChange={onChange} />;
    case 'color':
      return <ColorInput value={value || ''} onChange={onChange} placeholder={prop.defaultValue} />;
    case 'boolean':
      return (
        <CheckboxInput
          checked={(value === '' || value === undefined ? prop.defaultValue : value) === 'true' || value === true}
          onChange={checked => onChange(checked ? 'true' : 'false')}
          label={prop.label || prop.name}
        />
      );
    case 'number':
      return <TextInput value={value == null ? '' : String(value)} placeholder={prop.defaultValue} onChange={onChange} type="number" />;
    default:
      return <TextInput value={value == null ? '' : String(value)} placeholder={prop.defaultValue} onChange={onChange} />;
  }
};

const renderFields = (
  fields: Array<PropField>,
  element: WebsiteElement,
  setProp: (name: string, value: any) => void,
  editedComponentId: ?string
) =>
  fields
    .filter(field => !field.isVisible || field.isVisible(element.props))
    .map(field => (
      <div key={field.name}>
        {field.type !== 'boolean' && <FieldLabel>{field.label}</FieldLabel>}
        <PropFieldInput
          field={field}
          value={element.props[field.name]}
          onChange={value => setProp(field.name, value)}
          editedComponentId={editedComponentId}
        />
        {field.description && <div className="wve-small wve-muted">{field.description}</div>}
      </div>
    ));

const SettingsInspector = ({ element, isRoot, editedComponentId, onChangeElement }: Props) => {
  const { project, updateProject, openTab } = useWebsiteEditor();
  const prompt = usePrompt();
  const definition = getElementType(element.type);
  const setProp = (name: string, value: any) =>
    onChangeElement(current => ({ ...current, props: { ...current.props, [name]: value } }), `prop-${name}`);

  if (isRoot) {
    return (
      <div className="wve-empty">
        This is the body of the page. Select an element in the canvas or in the Layers panel to edit it, or use the
        Style tab to change the background of the whole page.
      </div>
    );
  }

  const component =
    element.type === 'component' ? project.components.find(c => c.id === element.props.componentId) : null;
  const reactComponent =
    element.type === 'react' ? project.reactComponents.find(c => c.id === element.props.reactComponentId) : null;
  const setValue = (name: string, value: any) =>
    onChangeElement(
      current => ({ ...current, props: { ...current.props, values: { ...(current.props.values || {}), [name]: value } } }),
      `value-${name}`
    );

  return (
    <>
      <PanelSection title="Element">
        <div>
          <FieldLabel>Name (used in the layers and interactions)</FieldLabel>
          <TextInput value={element.name} onChange={name => name.trim() && onChangeElement(current => ({ ...current, name: name.trim() }))} />
        </div>
        <CheckboxInput
          checked={!!element.locked}
          onChange={locked => onChangeElement(current => ({ ...current, locked }))}
          label="Lock (can't be moved in the canvas)"
        />
      </PanelSection>
      {definition.fields.length > 0 && (
        <PanelSection title={definition.label}>{renderFields(definition.fields, element, setProp, editedComponentId)}</PanelSection>
      )}
      {component && (
        <PanelSection
          title={`Component: ${component.name}`}
          actions={
            <button className="wve-link-button" onClick={() => openTab({ kind: 'component', id: component.id })}>
              Edit the component
            </button>
          }
        >
          {component.props.length === 0 && (
            <div className="wve-muted wve-small">
              This component has no props. Add props in the component editor to customize each instance (texts, images...).
            </div>
          )}
          {component.props.map(prop => (
            <div key={prop.name}>
              {prop.type !== 'boolean' && <FieldLabel>{prop.label || prop.name}</FieldLabel>}
              <ComponentPropInput
                prop={prop}
                value={(element.props.values || {})[prop.name]}
                onChange={value => setValue(prop.name, value)}
              />
            </div>
          ))}
        </PanelSection>
      )}
      {reactComponent && (
        <PanelSection
          title={`React: ${reactComponent.name}`}
          actions={
            <button className="wve-link-button" onClick={() => openTab({ kind: 'react-component', id: reactComponent.id })}>
              Edit the code
            </button>
          }
        >
          {reactComponent.props.length === 0 && <div className="wve-muted wve-small">This React component has no props.</div>}
          {reactComponent.props.map(prop => (
            <div key={prop.name}>
              {prop.type !== 'boolean' && <FieldLabel>{prop.label || prop.name}</FieldLabel>}
              <ComponentPropInput
                prop={prop}
                value={(element.props.values || {})[prop.name]}
                onChange={value => setValue(prop.name, value)}
              />
            </div>
          ))}
        </PanelSection>
      )}
      <PanelSection title="Shared style classes" defaultOpen={element.classIds.length > 0}>
        <div className="wve-row" style={{ flexWrap: 'wrap' }}>
          {element.classIds.map(classId => {
            const styleClass = project.styleClasses.find(c => c.id === classId);
            if (!styleClass) return null;
            return (
              <span key={classId} className="wve-chip wve-primary">
                .{styleClass.name}
                <button
                  title="Remove the class"
                  onClick={() => onChangeElement(current => ({ ...current, classIds: current.classIds.filter(id => id !== classId) }))}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
        <SelectInput
          value=""
          placeholder="Apply a class..."
          onChange={async value => {
            if (value === '__new__') {
              const name = await prompt({ title: 'New style class', label: 'Name of the class', defaultValue: 'my-class' });
              if (!name) return;
              let createdId = '';
              updateProject(current => {
                const result = addStyleClass(current, name);
                createdId = result.styleClass.id;
                return result.project;
              });
              setTimeout(() => onChangeElement(current => ({ ...current, classIds: [...current.classIds, createdId] })), 0);
              return;
            }
            if (value) onChangeElement(current => ({ ...current, classIds: [...current.classIds, value] }));
          }}
          options={[
            ...project.styleClasses
              .filter(c => !element.classIds.includes(c.id))
              .map(c => ({ value: c.id, label: '.' + c.name })),
            { value: '__new__', label: 'Create a new class...' },
          ]}
        />
        <div className="wve-muted wve-small">
          Classes share styles between elements. Edit their styles from the Style tab (choose the class at the top).
        </div>
      </PanelSection>
      <PanelSection title="Visibility and advanced" defaultOpen={!!element.props.initiallyHidden || !!element.props.visibleIf}>
        {renderFields(COMMON_FIELDS, element, setProp, editedComponentId)}
        <div>
          <FieldLabel>Only show when (JavaScript condition, e.g. state.loggedIn)</FieldLabel>
          <TextInput value={element.props.visibleIf || ''} onChange={value => setProp('visibleIf', value)} placeholder="Always shown" />
        </div>
      </PanelSection>
      <PanelSection title="Behaviors" defaultOpen={element.behaviors.length > 0} badge={element.behaviors.length ? <span className="wve-chip wve-primary">{element.behaviors.length}</span> : null}>
        {element.behaviors.map((behavior, index) => {
          const behaviorType = getBehaviorType(behavior.type);
          return (
            <div key={behavior.type + index} style={{ border: '1px solid var(--theme-list-item-separator-color)', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="wve-row">
                <strong className="wve-grow">{behaviorType ? behaviorType.label : behavior.type}</strong>
                <button
                  className="wve-icon-button"
                  title="Remove the behavior"
                  onClick={() => onChangeElement(current => ({ ...current, behaviors: current.behaviors.filter((_, i) => i !== index) }))}
                >
                  ×
                </button>
              </div>
              {behaviorType && <div className="wve-muted wve-small">{behaviorType.structure}</div>}
              {behaviorType &&
                behaviorType.fields.map(field => {
                  const value = behavior.config[field.name];
                  const setConfig = (newValue: any) =>
                    onChangeElement(
                      current => ({
                        ...current,
                        behaviors: current.behaviors.map((b, i) => (i === index ? { ...b, config: { ...b.config, [field.name]: newValue } } : b)),
                      }),
                      `behavior-${index}-${field.name}`
                    );
                  if (field.type === 'boolean') return <CheckboxInput key={field.name} checked={!!value} onChange={setConfig} label={field.label} />;
                  return (
                    <div key={field.name}>
                      <FieldLabel>{field.label}</FieldLabel>
                      {field.type === 'select' ? (
                        <SelectInput value={value || ''} onChange={setConfig} options={(field.options || []).map(o => ({ value: o.value, label: o.label }))} />
                      ) : (
                        <TextInput
                          value={value == null ? '' : String(value)}
                          type={field.type === 'number' ? 'number' : 'text'}
                          onChange={text => setConfig(field.type === 'number' ? Number(text) : text)}
                        />
                      )}
                    </div>
                  );
                })}
            </div>
          );
        })}
        <SelectInput
          value=""
          placeholder="Add a behavior..."
          onChange={type => {
            if (!type) return;
            onChangeElement(current => ({ ...current, behaviors: [...current.behaviors, { type, config: getDefaultBehaviorConfig(type) }] }));
          }}
          options={BEHAVIOR_TYPES.filter(b => !element.behaviors.some(existing => existing.type === b.type)).map(b => ({
            value: b.type,
            label: `${b.label} — ${b.description}`,
          }))}
        />
      </PanelSection>
    </>
  );
};

export default SettingsInspector;
