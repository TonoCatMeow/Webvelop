// @flow
// Display and edition of the parameters of triggers, conditions and actions.
import * as React from 'react';
import { type WebsiteProject, type WebsiteElement, BREAKPOINTS } from '../../Website/Model/Schema';
import { walkElements, findElement } from '../../Website/Model/Tree';
import { getElementType } from '../../Website/Elements/ElementTypes';
import {
  OPERATOR_OPTIONS,
  type ParamDefinition,
} from '../../Website/Interactions/InteractionsRegistry';
import { ALL_CSS_PROPERTIES } from '../../Website/Styles/StyleProperties';
import { addVariable } from '../../Website/Model/ProjectOps';
import { TextInput, SelectInput, CheckboxInput, FieldLabel } from '../Fields/Fields';
import { useWebsiteEditor } from '../WebsiteEditorContext';
import { usePrompt } from '../Fields/PromptDialog';
import { ElementParamInput, CodeElementsInput, CodeParamInput } from './ElementParams';

export const SELF_TARGET = '$self';
export const PAGE_TARGET = '$page';

export const getElementOptions = (
  root: ?WebsiteElement,
  { includeSelf = true }: {| includeSelf?: boolean |} = {}
): Array<{| value: string, label: string |}> => {
  const options = includeSelf ? [{ value: SELF_TARGET, label: 'This element (the one that triggered it)' }] : [];
  if (!root) return options;
  walkElements(root, (element, parent, depth) => {
    if (depth === 0) return;
    options.push({
      value: element.id,
      label: `${'  '.repeat(depth - 1)}${element.name} (${getElementType(element.type).label})`,
    });
  });
  return options;
};

export const describeElement = (root: ?WebsiteElement, target: string): {| text: string, missing: boolean |} => {
  if (!target || target === SELF_TARGET) return { text: 'this element', missing: false };
  if (target === PAGE_TARGET) return { text: 'the page', missing: false };
  const element = root ? findElement(root, target) : null;
  return element ? { text: element.name, missing: false } : { text: 'missing element', missing: true };
};

export const formatParamValue = (
  project: WebsiteProject,
  root: ?WebsiteElement,
  param: ?ParamDefinition,
  value: any
): {| text: string, missing: boolean, code?: boolean |} => {
  if (!param) return { text: String(value == null ? '' : value), missing: false };
  switch (param.type) {
    case 'element':
    case 'form':
      return describeElement(root, value);
    case 'page': {
      const page = project.pages.find(p => p.id === value || p.slug === value || p.name === value);
      return page ? { text: page.name, missing: false } : { text: 'choose a page', missing: true };
    }
    case 'variable':
      if (!value) return { text: 'choose a variable', missing: true };
      return {
        text: value,
        missing: !project.variables.some(variable => variable.name === value),
      };
    case 'boolean':
      return { text: value ? 'yes' : 'no', missing: false };
    case 'select': {
      const option = (param.options || []).find(o => o.value === value);
      return { text: option ? option.label : String(value), missing: false };
    }
    case 'operator': {
      const option = OPERATOR_OPTIONS.find(o => o.value === value);
      return { text: option ? option.label : String(value), missing: false };
    }
    case 'breakpoint': {
      const breakpoint = BREAKPOINTS.find(b => b.id === value);
      return { text: breakpoint ? breakpoint.label.toLowerCase() : String(value), missing: false };
    }
    case 'elements': {
      const entries = Array.isArray(value) ? value : [];
      if (!entries.length) return { text: 'with no element', missing: false, code: true };
      return {
        text: 'with ' + entries.map(entry => `elements.${entry.as} (${describeElement(root, entry.id).text})`).join(', '),
        missing: entries.some(entry => describeElement(root, entry.id).missing),
        code: true,
      };
    }
    case 'code': {
      const code = String(value || '').trim();
      return { text: code.length > 70 ? code.substring(0, 67) + '...' : code || '(empty)', missing: false, code: true };
    }
    default: {
      const text = String(value == null ? '' : value);
      return { text: text === '' ? '""' : `"${text}"`, missing: false };
    }
  }
};

/** Render a sentence like "Show {target}" with its formatted parameters. */
export const renderSentence = (
  project: WebsiteProject,
  root: ?WebsiteElement,
  sentence: string,
  params: Array<ParamDefinition>,
  values: { [string]: any },
  extraValues: { [string]: {| text: string, missing: boolean |} } = {}
): React.Node => {
  const parts = sentence.split(/(\{[\w$]+\})/g);
  return parts.map((part, index) => {
    const match = /^\{([\w$]+)\}$/.exec(part);
    if (!match) return <React.Fragment key={index}>{part}</React.Fragment>;
    const name = match[1];
    const formatted = extraValues[name] || formatParamValue(project, root, params.find(p => p.name === name), values[name]);
    return (
      <span
        key={index}
        className={`wve-param ${formatted.missing ? 'wve-missing-param' : ''} ${formatted.code ? 'wve-code-param' : ''}`}
      >
        {formatted.text}
      </span>
    );
  });
};

const ParamInput = ({
  param,
  value,
  onChange,
  root,
  allowSelf,
}: {|
  param: ParamDefinition,
  value: any,
  onChange: any => void,
  root: ?WebsiteElement,
  allowSelf: boolean,
|}) => {
  const { project, updateProject } = useWebsiteEditor();
  const prompt = usePrompt();
  switch (param.type) {
    case 'element':
    case 'form':
      return (
        <ElementParamInput
          value={value || ''}
          onChange={onChange}
          root={root}
          options={getElementOptions(root, { includeSelf: allowSelf })}
        />
      );
    case 'elements':
      return <CodeElementsInput value={value || []} onChange={onChange} root={root} />;
    case 'page':
      return (
        <SelectInput
          value={value || ''}
          onChange={onChange}
          placeholder="Choose a page"
          options={project.pages.map(page => ({ value: page.id, label: page.name }))}
        />
      );
    case 'variable':
      return (
        <div className="wve-row">
          <div className="wve-grow">
            <SelectInput
              value={value || ''}
              onChange={onChange}
              placeholder="Choose a variable"
              options={project.variables.map(variable => ({
                value: variable.name,
                label: `${variable.name} (${variable.type})`,
              }))}
            />
          </div>
          <button
            className="wve-link-button"
            onClick={async () => {
              const name = await prompt({
                title: 'New variable',
                label: 'Name of the variable',
                defaultValue: 'myVariable',
                description:
                  'Variables hold the state of the website. They can be displayed in texts with {{state.name}}, used by interactions and by React components.',
              });
              if (!name) return;
              let createdName = name;
              updateProject(current => {
                const result = addVariable(current, name);
                createdName = result.variable.name;
                return result.project;
              });
              setTimeout(() => onChange(createdName), 0);
            }}
          >
            New variable
          </button>
        </div>
      );
    case 'boolean':
      return <CheckboxInput checked={!!value} onChange={onChange} label={param.label} />;
    case 'select':
      return (
        <SelectInput
          value={value || ''}
          onChange={onChange}
          options={(param.options || []).map(o => ({ value: o.value, label: o.label }))}
        />
      );
    case 'operator':
      return <SelectInput value={value || '=='} onChange={onChange} options={OPERATOR_OPTIONS} />;
    case 'breakpoint':
      return (
        <SelectInput
          value={value || 'mobile'}
          onChange={onChange}
          options={BREAKPOINTS.map(b => ({ value: b.id, label: b.label }))}
        />
      );
    case 'number':
      return <TextInput value={value == null ? '' : String(value)} onChange={text => onChange(text === '' ? '' : Number(text))} type="number" />;
    case 'code':
      return <CodeParamInput value={value || ''} onChange={onChange} root={root} />;
    case 'longText':
      return <TextInput value={value || ''} onChange={onChange} multiline rows={3} />;
    case 'cssProperty':
      return (
        <>
          <TextInput value={value || ''} onChange={onChange} list="wve-param-css-properties" />
          <datalist id="wve-param-css-properties">
            {ALL_CSS_PROPERTIES.map(prop => (
              <option key={prop} value={prop} />
            ))}
          </datalist>
        </>
      );
    case 'className':
      return (
        <>
          <TextInput value={value || ''} onChange={onChange} list="wve-param-classes" />
          <datalist id="wve-param-classes">
            <option value="is-active" />
            {project.styleClasses.map(styleClass => (
              <option key={styleClass.id} value={'wvc-' + styleClass.name} />
            ))}
          </datalist>
        </>
      );
    default:
      return <TextInput value={value == null ? '' : String(value)} onChange={onChange} />;
  }
};

export const ParamsForm = ({
  params,
  values,
  onChange,
  root,
  allowSelf = true,
}: {|
  params: Array<ParamDefinition>,
  values: { [string]: any },
  onChange: ({ [string]: any }) => void,
  root: ?WebsiteElement,
  allowSelf?: boolean,
|}) => (
  <>
    {params.map(param => (
      <div key={param.name}>
        {param.type !== 'boolean' && <FieldLabel>{param.label}</FieldLabel>}
        <ParamInput
          param={param}
          value={values[param.name]}
          onChange={value => onChange({ ...values, [param.name]: value })}
          root={root}
          allowSelf={allowSelf}
        />
        {param.description && <div className="wve-small wve-muted">{param.description}</div>}
      </div>
    ))}
  </>
);
