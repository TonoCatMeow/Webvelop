// @flow
import * as React from 'react';
import DragAndDropContextProvider from '../UI/DragAndDrop/DragAndDropContextProvider';
import PreferencesProvider from './Preferences/PreferencesProvider';
import PreferencesContext from './Preferences/PreferencesContext';
import GDI18nProvider from '../Utils/i18n/GDI18nProvider';
import { I18n } from '@lingui/react';
import { type I18n as I18nType } from '@lingui/core';
import { UnsavedChangesContextProvider } from './UnsavedChangesContext';
import AlertProvider from '../UI/Alert/AlertProvider';
import ErrorBoundary from '../UI/ErrorBoundary';
import { FullThemeProvider } from '../UI/Theme/FullThemeProvider';

type Props = {|
  children: ({| i18n: I18nType |}) => React.Node,
|};

/**
 * Wrap the children with the providers used by the editor: drag and drop,
 * preferences, i18n, theme, alerts and unsaved changes.
 */
const Providers = ({ children }: Props): React.Node => (
  <DragAndDropContextProvider>
    <UnsavedChangesContextProvider>
      <PreferencesProvider>
        <PreferencesContext.Consumer>
          {({ values }) => (
            <GDI18nProvider language={values.language.replace('_', '-')}>
              <FullThemeProvider>
                <ErrorBoundary componentTitle="Webvelop" scope="app">
                  <AlertProvider>
                    <I18n update>{({ i18n }) => children({ i18n })}</I18n>
                  </AlertProvider>
                </ErrorBoundary>
              </FullThemeProvider>
            </GDI18nProvider>
          )}
        </PreferencesContext.Consumer>
      </PreferencesProvider>
    </UnsavedChangesContextProvider>
  </DragAndDropContextProvider>
);

export default Providers;
