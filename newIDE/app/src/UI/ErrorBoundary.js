// @flow
import * as React from 'react';
import ReactErrorBoundary from 'react-error-boundary';
import RaisedButton from './RaisedButton';
import { getIDEVersionWithHash } from '../Version';

type ErrorBoundaryProps = {|
  children: React.Node,
  componentTitle: React.Node,
  scope: string,
  onClose?: () => void,
|};

const ErrorFallback = ({
  error,
  componentStack,
  resetErrorBoundary,
  componentTitle,
}: {
  error: Error,
  componentStack: string,
  resetErrorBoundary: () => void,
  componentTitle: React.Node,
}) => (
  <div style={{ padding: 32, maxWidth: 720, margin: '0 auto', overflow: 'auto' }}>
    <h2 style={{ marginTop: 0 }}>Something went wrong in "{componentTitle}"</h2>
    <p>
      Your work is not lost: save your website, then try again. If the problem persists, restart Webvelop (an autosave
      can be restored when reopening the website).
    </p>
    <pre
      style={{
        whiteSpace: 'pre-wrap',
        fontSize: 12,
        padding: 12,
        borderRadius: 6,
        background: 'rgba(127,127,127,0.12)',
      }}
    >
      {error.message}
      {'\n'}
      {componentStack}
      {'\n'}Webvelop {getIDEVersionWithHash()}
    </pre>
    <RaisedButton primary label="Try again" onClick={resetErrorBoundary} />
  </div>
);

/**
 * Catch errors of a part of the editor, so that the rest of the application
 * keeps working.
 */
const ErrorBoundary = ({ children, componentTitle, scope, onClose }: ErrorBoundaryProps): React.Node => {
  const [key, setKey] = React.useState(0);
  return (
    <ReactErrorBoundary
      key={key}
      FallbackComponent={props => (
        <ErrorFallback {...props} resetErrorBoundary={() => setKey(k => k + 1)} componentTitle={componentTitle} />
      )}
      onError={(error, componentStack) => {
        console.error(`Error caught in "${scope}":`, error, componentStack);
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
};

export default ErrorBoundary;
