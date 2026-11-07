// @flow
// Context shared by all the editors of a website project.
import * as React from 'react';
import { type WebsiteProject, type WebsiteAsset } from '../Website/Model/Schema';

export type UpdateProjectOptions = {|
  /** Changes with the same merge key, done quickly, are merged in one undo step. */
  mergeKey?: string,
  type?: 'ADD' | 'DELETE' | 'EDIT',
  /** Stored with the change, to restore the selection on undo. */
  changeContext?: any,
|};

export type EditorTabTarget =
  | {| kind: 'home' |}
  | {| kind: 'page', id: string, elementId?: string |}
  | {| kind: 'page-events', id: string, eventId?: string |}
  | {| kind: 'page-code', id: string |}
  | {| kind: 'component', id: string |}
  | {| kind: 'react-component', id: string |}
  | {| kind: 'script', id: string |}
  | {| kind: 'custom-action', id: string |}
  | {| kind: 'site-events' |}
  | {| kind: 'site-settings', section?: string |}
  | {| kind: 'assets' |};

export type WebsiteEditorContextValue = {|
  project: WebsiteProject,
  projectFilePath: ?string,
  updateProject: (
    updater: (project: WebsiteProject) => WebsiteProject,
    options?: UpdateProjectOptions
  ) => void,
  resolveAssetUrl: (assetId: string) => string,
  importAssets: (files: Array<File>) => Promise<Array<WebsiteAsset>>,
  openTab: (target: EditorTabTarget) => void,
  openPreview: (pageId?: string) => void,
  canvasSettings: {| showOutlines: boolean, showHiddenElements: boolean |},
  setCanvasSettings: ({| showOutlines: boolean, showHiddenElements: boolean |}) => void,
  undo: () => void,
  redo: () => void,
  canUndo: boolean,
  canRedo: boolean,
|};

// $FlowFixMe[incompatible-type]
const WebsiteEditorContext = React.createContext<WebsiteEditorContextValue>(null);

export const useWebsiteEditor = (): WebsiteEditorContextValue =>
  React.useContext(WebsiteEditorContext);

export default WebsiteEditorContext;
