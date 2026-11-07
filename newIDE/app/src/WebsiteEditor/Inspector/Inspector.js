// @flow
// The right panel of the page editor: Style, Settings and Interactions of
// the selected element.
import * as React from 'react';
import {
  type WebsiteElement,
  type InteractionEvent,
  type BreakpointId,
  type StyleKey,
  type ElementStyles,
  STYLE_STATES,
  getBreakpoint,
} from '../../Website/Model/Schema';
import { getElementType } from '../../Website/Elements/ElementTypes';
import StyleInspector from './StyleInspector';
import SettingsInspector from './SettingsInspector';
import EventsList from '../Interactions/EventsList';
import { SelectInput } from '../Fields/Fields';
import { useWebsiteEditor } from '../WebsiteEditorContext';
import { ElementIcon } from '../ElementIcons';

export type InspectorTab = 'style' | 'settings' | 'interactions';

type Props = {|
  root: WebsiteElement,
  element: ?WebsiteElement,
  events: Array<InteractionEvent>,
  breakpoint: BreakpointId,
  editedComponentId: ?string,
  tab: InspectorTab,
  onTabChange: InspectorTab => void,
  onChangeElement: (updater: (WebsiteElement) => WebsiteElement, mergeKey?: string) => void,
  onChangeEvents: (events: Array<InteractionEvent>, mergeKey?: string) => void,
|};

const Inspector = ({
  root,
  element,
  events,
  breakpoint,
  editedComponentId,
  tab,
  onTabChange,
  onChangeElement,
  onChangeEvents,
}: Props) => {
  const { project, updateProject } = useWebsiteEditor();
  const [styleState, setStyleState] = React.useState<?StyleKey>(null);
  const [styleTarget, setStyleTarget] = React.useState<string>('element');

  React.useEffect(
    () => {
      setStyleTarget('element');
    },
    [element ? element.id : null]
  );

  if (!element) {
    return <div className="wve-empty">Select an element to edit it.</div>;
  }
  const definition = getElementType(element.type);
  const isRoot = element.id === root.id;
  const styleKey: StyleKey = styleState || breakpoint;
  const styleClass =
    styleTarget !== 'element' ? project.styleClasses.find(c => c.id === styleTarget) : null;
  const interactionsCount = events.filter(event => event.trigger.target === element.id).length;

  const styles: ElementStyles = styleClass ? styleClass.styles : element.styles;
  const onChangeStyles = (newStyles: ElementStyles, mergeKey?: string) => {
    if (styleClass) {
      updateProject(
        current => ({
          ...current,
          styleClasses: current.styleClasses.map(c => (c.id === styleClass.id ? { ...c, styles: newStyles } : c)),
        }),
        { mergeKey: mergeKey ? `class-${styleClass.id}-${mergeKey}` : undefined }
      );
    } else {
      onChangeElement(current => ({ ...current, styles: newStyles }), mergeKey);
    }
  };

  return (
    <>
      <div className="wve-row" style={{ padding: '8px 10px 4px' }}>
        <ElementIcon name={definition.icon} />
        <strong className="wve-grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isRoot ? 'Page body' : element.name}
        </strong>
        <span className="wve-muted wve-small">{definition.label}</span>
      </div>
      <div className="wve-panel-tabs">
        <button className={`wve-panel-tab ${tab === 'style' ? 'wve-active' : ''}`} onClick={() => onTabChange('style')}>
          Style
        </button>
        <button className={`wve-panel-tab ${tab === 'settings' ? 'wve-active' : ''}`} onClick={() => onTabChange('settings')}>
          Settings
        </button>
        <button
          className={`wve-panel-tab ${tab === 'interactions' ? 'wve-active' : ''}`}
          onClick={() => onTabChange('interactions')}
        >
          Interactions{interactionsCount ? ` (${interactionsCount})` : ''}
        </button>
      </div>
      <div className="wve-scroll">
        {tab === 'style' && (
          <>
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {element.classIds.length > 0 && (
                <div className="wve-row">
                  <span className="wve-label wve-muted" style={{ width: 70 }}>Editing</span>
                  <SelectInput
                    value={styleTarget}
                    onChange={setStyleTarget}
                    options={[
                      { value: 'element', label: 'This element only' },
                      ...element.classIds
                        .map(id => project.styleClasses.find(c => c.id === id))
                        .filter(Boolean)
                        .map(c => ({ value: c.id, label: `Class .${c.name} (all elements using it)` })),
                    ]}
                  />
                </div>
              )}
              <div className="wve-row">
                <span className="wve-label wve-muted" style={{ width: 70 }}>State</span>
                <div className="wve-segmented">
                  <button className={!styleState ? 'wve-active' : ''} onClick={() => setStyleState(null)}>
                    Normal
                  </button>
                  {STYLE_STATES.map(state => (
                    <button
                      key={state.id}
                      title={state.label}
                      className={styleState === state.id ? 'wve-active' : ''}
                      onClick={() => setStyleState(styleState === state.id ? null : state.id)}
                    >
                      {state.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="wve-muted wve-small">
                {styleState
                  ? `Editing the "${(STYLE_STATES.find(s => s.id === styleState) || { label: '' }).label}" state (all screen sizes).`
                  : breakpoint === 'desktop'
                  ? 'Editing the base styles, used on every screen size unless overridden for tablets or mobiles.'
                  : `Editing the styles for ${getBreakpoint(breakpoint).label.toLowerCase()} screens (${getBreakpoint(breakpoint).maxWidth || ''}px and less). Orange labels are inherited.`}
              </div>
            </div>
            <StyleInspector styles={styles} onChange={onChangeStyles} styleKey={styleKey} elementType={element.type} />
          </>
        )}
        {tab === 'settings' && (
          <SettingsInspector
            element={element}
            isRoot={isRoot}
            editedComponentId={editedComponentId}
            onChangeElement={onChangeElement}
          />
        )}
        {tab === 'interactions' &&
          (isRoot ? (
            <div className="wve-empty">
              Select an element to add interactions to it (clicks, forms...). Interactions of the page (page loaded,
              scrolling, keys, timers) are in the Interactions tab of the page.
            </div>
          ) : (
            <EventsList
              events={events}
              onChange={onChangeEvents}
              root={root}
              filterTargetId={element.id}
              compact
              emptyText={`No interaction on "${element.name}" yet. Add one to react to clicks, form submissions, hovering...`}
            />
          ))}
      </div>
    </>
  );
};

export default Inspector;
