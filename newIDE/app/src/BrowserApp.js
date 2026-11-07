// @flow
// The web version of Webvelop (projects are stored in the browser).
import * as React from 'react';
import MainFrame from './MainFrame';
import Providers from './MainFrame/Providers';

export const create = (): React.Node => (
  <Providers>{() => <MainFrame initialFileToOpen={null} />}</Providers>
);
