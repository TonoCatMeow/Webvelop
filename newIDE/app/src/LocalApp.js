// @flow
// The desktop (Electron) version of Webvelop.
import * as React from 'react';
import MainFrame from './MainFrame';
import Providers from './MainFrame/Providers';
import Window from './Utils/Window';
import { PROJECT_FILE_EXTENSION } from './Website/Model/Schema';
import { LocalFileStorageProvider } from './ProjectsStorage/WebvelopStorageProviders';

export const create = (): React.Node => {
  Window.setUpContextMenu();
  const appArguments = Window.getArguments() || {};
  const positional: Array<string> = appArguments._ || [];
  const fileToOpen = positional.find(argument => String(argument).endsWith('.' + PROJECT_FILE_EXTENSION));
  return (
    <Providers>
      {() => (
        <MainFrame
          initialFileToOpen={
            fileToOpen
              ? {
                  fileMetadata: { fileIdentifier: fileToOpen },
                  storageProviderName: LocalFileStorageProvider.internalName,
                }
              : null
          }
        />
      )}
    </Providers>
  );
};
