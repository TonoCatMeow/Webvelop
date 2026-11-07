// @flow
import * as React from 'react';
import PreferencesContext, {
  initialPreferences,
  type PreferencesValues,
} from './PreferencesContext';
import { type FileMetadataAndStorageProviderName } from '../../ProjectsStorage';

// The preferences of Webvelop. On the desktop app, they are stored in the
// data folder of Webvelop (never shared with any other application).
const localStorageItem = 'webvelop-preferences';
const MAX_RECENT_FILES = 15;

export const loadPreferencesFromLocalStorage = (): ?PreferencesValues => {
  try {
    const persistedState = localStorage.getItem(localStorageItem);
    if (!persistedState) return null;
    const values = JSON.parse(persistedState);
    return values && typeof values === 'object' ? values : null;
  } catch (error) {
    return null;
  }
};

const isSameFile = (a: FileMetadataAndStorageProviderName, b: FileMetadataAndStorageProviderName) =>
  a.storageProviderName === b.storageProviderName &&
  a.fileMetadata.fileIdentifier === b.fileMetadata.fileIdentifier;

type Props = {| children: React.Node |};

const PreferencesProvider = ({ children }: Props): React.Node => {
  const [values, setValuesState] = React.useState<PreferencesValues>(() => ({
    ...initialPreferences.values,
    ...(loadPreferencesFromLocalStorage() || {}),
  }));

  React.useEffect(
    () => {
      try {
        localStorage.setItem(localStorageItem, JSON.stringify(values));
      } catch (error) {
        console.warn('Unable to persist the preferences:', error);
      }
    },
    [values]
  );

  const setValues = React.useCallback(
    (changes: $Shape<PreferencesValues>) => setValuesState(current => ({ ...current, ...changes })),
    []
  );

  const preferences = React.useMemo(
    () => ({
      values,
      setValues,
      getRecentProjectFiles: () => values.recentProjectFiles,
      insertRecentProjectFile: (item: FileMetadataAndStorageProviderName) =>
        setValuesState(current => ({
          ...current,
          recentProjectFiles: [item, ...current.recentProjectFiles.filter(other => !isSameFile(other, item))].slice(
            0,
            MAX_RECENT_FILES
          ),
        })),
      removeRecentProjectFile: (item: FileMetadataAndStorageProviderName) =>
        setValuesState(current => ({
          ...current,
          recentProjectFiles: current.recentProjectFiles.filter(other => !isSameFile(other, item)),
        })),
      showAlertMessage: (identifier: string, show: boolean) =>
        setValuesState(current => ({
          ...current,
          hiddenAlertMessages: { ...current.hiddenAlertMessages, [identifier]: !show },
        })),
      resetHiddenAlertMessages: () => setValuesState(current => ({ ...current, hiddenAlertMessages: {} })),
    }),
    [values, setValues]
  );

  return <PreferencesContext.Provider value={preferences}>{children}</PreferencesContext.Provider>;
};

export default PreferencesProvider;
