// @flow
// Entry point of Webvelop.
import * as React from 'react';
// $FlowFixMe[cannot-resolve-module] - react-dom/client is available in React 18
import { createRoot } from 'react-dom/client';
import './UI/icomoon-font.css'; // Styles for Icomoon font.
import optionalRequire from './Utils/OptionalRequire';
import { getThemeWindowBackgroundColor } from './UI/Theme';

const electron = optionalRequire('electron');

// Make sure that the process object is available, even if we are not in Node.
// This is needed by some libraries like path-browserify.
global.process = global.process || {
  cwd: () => '/',
};

// Never show the autofill history of the browser in the fields of the editor
// (old values typed in other fields, long URLs...). Suggestions given on
// purpose with a <datalist> are still shown.
document.addEventListener(
  'focusin',
  (event: FocusEvent) => {
    const target: any = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && !target.hasAttribute('autocomplete')) {
      target.setAttribute('autocomplete', 'off');
    }
  },
  true
);

// Use the user preferred theme to define the loading screen color.
const body = document.getElementsByTagName('body')[0];
if (body) body.style.backgroundColor = getThemeWindowBackgroundColor();

const loadingErrorStyle = {
  position: 'absolute',
  top: '50%',
  left: 15,
  right: 15,
  fontSize: 18,
  fontFamily: 'sans-serif',
  color: 'darkgray',
  textAlign: 'center',
};

const Bootstrapper = () => {
  const [app, setApp] = React.useState<?React.Node>(null);
  const [error, setError] = React.useState<?string>(null);

  React.useEffect(() => {
    const load = electron
      ? import(/* webpackChunkName: "local-app" */ './LocalApp')
      : import(/* webpackChunkName: "browser-app" */ './BrowserApp');
    load.then(
      module => setApp(module.create()),
      loadError => {
        console.error('Unable to load Webvelop:', loadError);
        setError(
          electron
            ? 'Unable to load Webvelop. Please restart the application.'
            : 'Unable to load Webvelop. Please check your connection and reload the page.'
        );
      }
    );
  }, []);

  return (
    <React.Fragment>
      {app}
      {error && <div style={loadingErrorStyle}>{error}</div>}
    </React.Fragment>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<Bootstrapper />);
} else console.error('No root element defined in index.html');
