// @flow
import VersionMetadata from './VersionMetadata';

/** The version of Webvelop (read from newIDE/electron-app/app/package.json). */
export const getIDEVersion = (): string => VersionMetadata.version;
export const getIDEVersionWithHash = (): string =>
  VersionMetadata.versionWithHash;
