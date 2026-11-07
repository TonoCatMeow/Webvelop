// @flow
import * as React from 'react';
import Dialog from '../UI/Dialog';
import FlatButton from '../UI/FlatButton';
import { getIDEVersion, getIDEVersionWithHash } from '../Version';
import { WebvelopLogoIcon } from '../WebsiteEditor/ElementIcons';
import { getWebvelopPaths } from '../Website/Services/WebsiteExporter';
import optionalRequire from '../Utils/OptionalRequire';

const electron = optionalRequire('electron');

type Props = {| onClose: () => void |};

const AboutDialog = ({ onClose }: Props): React.Node => {
  const paths = getWebvelopPaths();
  return (
    <Dialog
      open
      title="About Webvelop"
      maxWidth="sm"
      onRequestClose={onClose}
      actions={[<FlatButton key="close" label="Close" primary onClick={onClose} />]}
    >
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <WebvelopLogoIcon style={{ width: 72, height: 72, flexShrink: 0 }} />
        <div style={{ lineHeight: 1.6 }}>
          <h2 style={{ margin: '0 0 4px' }}>Webvelop {getIDEVersion()}</h2>
          <div className="wve-muted wve-small">Build {getIDEVersionWithHash()}</div>
          <p>
            Webvelop is a visual website builder: design responsive pages, add interactions, write React components and
            JavaScript, preview your website and export it as a static website or a React project.
          </p>
          <p className="wve-small wve-muted">
            {electron ? 'Desktop application' : 'Web application'}
            {paths ? (
              <>
                {' '}— data folder: <code>{paths.dataDir}</code>
              </>
            ) : null}
          </p>
          <p className="wve-small wve-muted">
            Webvelop is open-source software released under the MIT license. It is built from the source code of an
            open-source editor; the full copyright and license notices are in the LICENSE.md files distributed with the
            application.
          </p>
        </div>
      </div>
    </Dialog>
  );
};

export default AboutDialog;
