/*!
 * Electron JSON Settings Store
 *
 *
 * Licensed under MIT
 * Copyright (c) 2020 [Samuel Carreira]
 */

export class ValidationError extends Error {
  /**
   * Description of error(s)
   */
  public readonly errors: string;
  /**
   * Default value defined in schema
   */
  public readonly defaultValue: any;

  constructor(errors: string, defaultValue: any) {
    super(errors);

    Object.setPrototypeOf(this, new.target.prototype);

    this.defaultValue = defaultValue;
    this.errors = errors;

    Error.captureStackTrace(this);
  }
}

export interface ElectronJSONSettingsStoreResult {
  /**
   * Status of the validation or writing operation
   * On validation returns false if validation failed
   * On writing operation returns false if operation was
   * not succeed
   */
  status: boolean;
  /**
   * Default value of the key, useful if you want to apply
   * default value to a setting
   */
  default: any;
  /**
   * False if no errors. String with error description
   * or operation details like defaults applied
   */
  errors: boolean | string | string[];
}

export {default as ElectronJSONSettingsStoreMain} from './main';
export {default as ElectronJSONSettingsStoreRenderer} from './renderer';
// module.exports = (process.type === 'browser' ? require('./main') : require('./renderer'));

/**
 * Checks if current process Node version is lower
 * @param version version major number (like 12)
 */
function checkNodeVersion(version: number): boolean {
  const NODE_MAJOR_VERSION = process.versions.node.split('.')[0];

  return (Number(NODE_MAJOR_VERSION) >= version);
}

/**
 * Checks if current process Electron version is lower
 * @param version version major number (like 7)
 */
function checkElectronVersion(version: number): boolean {
  const NODE_ELECTRON_VERSION = process.versions.electron.split('.')[0];

  return (Number(NODE_ELECTRON_VERSION) >= version);
}

(() => {
  const MINIMAL_NODE_VERSION = 12;
  const MINIMAL_ELECTRON_VERSION = 7;

  if (!checkNodeVersion(MINIMAL_NODE_VERSION)) {
    throw new Error(`This module Requires Node v.${MINIMAL_NODE_VERSION} or higher`);
  }

  if (!checkElectronVersion(MINIMAL_ELECTRON_VERSION)) {
    throw new Error(`This module Requires Electron v.${MINIMAL_ELECTRON_VERSION} or higher because ipcRenderer.invoke method`);
  }
})();
