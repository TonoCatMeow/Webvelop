// @flow
// Edition of the props of a reusable component (and of its description).
import * as React from 'react';
import { type ComponentPropDefinition } from '../../Website/Model/Schema';
import { toVariableName, makeUniqueName } from '../../Website/Model/Ids';
import { getComponentUsages } from '../../Website/Model/ProjectOps';
import { TextInput, SelectInput, FieldLabel } from '../Fields/Fields';
import { useWebsiteEditor } from '../WebsiteEditorContext';

export const PROP_TYPE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'longText', label: 'Long text' },
  { value: 'image', label: 'Image' },
  { value: 'url', label: 'Link' },
  { value: 'color', label: 'Color' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes/No' },
];

export const PropsDefinitionsEditor = ({
  props,
  onChange,
  usageHint,
}: {|
  props: Array<ComponentPropDefinition>,
  onChange: (Array<ComponentPropDefinition>) => void,
  usageHint: React.Node,
|}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div className="wve-muted wve-small">{usageHint}</div>
    {props.map((prop, index) => (
      <div
        key={index}
        style={{ border: '1px solid var(--theme-list-item-separator-color)', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        <div className="wve-row">
          <div className="wve-grow">
            <TextInput
              value={prop.name}
              onChange={name =>
                onChange(props.map((p, i) => (i === index ? { ...p, name: toVariableName(name) || p.name } : p)))
              }
              placeholder="name"
            />
          </div>
          <button className="wve-icon-button" title="Remove" onClick={() => onChange(props.filter((_, i) => i !== index))}>
            ×
          </button>
        </div>
        <div className="wve-row">
          <span className="wve-label">Label</span>
          <div className="wve-grow">
            <TextInput value={prop.label} onChange={label => onChange(props.map((p, i) => (i === index ? { ...p, label } : p)))} />
          </div>
        </div>
        <div className="wve-row">
          <span className="wve-label">Type</span>
          <SelectInput
            value={prop.type}
            onChange={type => onChange(props.map((p, i) => (i === index ? { ...p, type: (type: any) } : p)))}
            options={PROP_TYPE_OPTIONS}
          />
        </div>
        <div className="wve-row">
          <span className="wve-label">Default</span>
          <div className="wve-grow">
            <TextInput
              value={prop.defaultValue}
              onChange={defaultValue => onChange(props.map((p, i) => (i === index ? { ...p, defaultValue } : p)))}
            />
          </div>
        </div>
      </div>
    ))}
    <button
      className="wve-add-instruction"
      onClick={() => {
        const name = makeUniqueName('title', props.map(p => p.name), '');
        onChange([...props, { name, label: 'Title', type: 'text', defaultValue: 'Default title' }]);
      }}
    >
      + Add a prop
    </button>
  </div>
);

const ComponentPropsEditor = ({ componentId }: {| componentId: string |}) => {
  const { project, updateProject } = useWebsiteEditor();
  const component = project.components.find(c => c.id === componentId);
  if (!component) return null;
  const usages = getComponentUsages(project, componentId);
  const update = (changes: any, mergeKey?: string) =>
    updateProject(
      current => ({
        ...current,
        components: current.components.map(c => (c.id === componentId ? { ...c, ...changes } : c)),
      }),
      { mergeKey: mergeKey ? `component-${componentId}-${mergeKey}` : undefined }
    );
  return (
    <div className="wve-scroll" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <FieldLabel>Name</FieldLabel>
        <TextInput value={component.name} onChange={name => name.trim() && update({ name: name.trim() })} />
      </div>
      <div>
        <FieldLabel>Description</FieldLabel>
        <TextInput value={component.description} onChange={description => update({ description })} multiline />
      </div>
      <div className="wve-muted wve-small">
        Used {usages.length} time(s){usages.length ? ': ' + Array.from(new Set(usages.map(u => u.documentName))).join(', ') : ''}.
      </div>
      <FieldLabel>Props</FieldLabel>
      <PropsDefinitionsEditor
        props={component.props}
        onChange={props => update({ props })}
        usageHint={
          <>
            Props let each instance of the component have its own texts, images or links. Write{' '}
            <code>{'{{props.title}}'}</code> in a text, a link or an image of the component to use a prop.
          </>
        }
      />
    </div>
  );
};

export default ComponentPropsEditor;
