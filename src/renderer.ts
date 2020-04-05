/*!
 * Electron JSON Settings Store
 * Renderer process
 *
 * Licensed under MIT
 * Copyright (c) 2020 [Samuel Carreira]
 */

import {ipcRenderer} from 'electron';
import {EventEmitter} from 'events';
import {ElectronJSONSettingsStoreResult} from '.';

interface ElectronJSONSettingsStoreRendererOptions {
  /**
   * Emits event when settings is updated. Disable if you don't
   * need to 'watch' settings change (can lead to a small
   * performance improvment - less event listeners)
   *
   * @default false
   */
  emitEventOnUpdated: boolean;
}

export default class ElectronJSONSettingsStoreRenderer extends EventEmitter {
  /**
   * Settings object in memory
   * Speeds up the access to the value because you don't need
   * to read the file
   */
  private _cachedSettings: {[index: string]: any};
  /**
   * Store defaults object (defined from shema)
   */
  private _defaults: {[index: string]: any};
  /**
   * Class Options
   */
  private readonly _options: ElectronJSONSettingsStoreRendererOptions;
  /**
   * Flag to check if init method has been initialized
   * if not the system can warn the user to initialize
   * the module
   */
  private _hasInitialized = false;

  /**
   * Electron JSON Settings Store (Renderer)
   * @param options options
   */
  constructor(options: ElectronJSONSettingsStoreRendererOptions) {
    super();

    if (!this._checkProcessType('renderer')) {
      throw new Error('This module can only be used on the renderer process. Use the `ElectronJSONSettingsStoreMain` on main process.');
    }

    const defaultOptions: ElectronJSONSettingsStoreRendererOptions = {
      emitEventOnUpdated: false
    };

    this._options = {...defaultOptions, ...options};

    this._cachedSettings = {};

    this._defaults = {};
  }

  /**
   * Validate key with schema
   * (this is a async function because I don't want to require
   * validation module again on renderer process)
   *
   * @param key key name
   * @param value value to check
   *
   * @example
   * const schema = {size: { type: 'number', positive: true, integer: true, default: 25, min: 10, max: 40 }}
   * await settings.validate('size', 12)
   *  -> {status: true, default: 25}
   * await settings.validate('size', 50)
   *  -> {status: false, default: 25, errors: ["The 'size' field must be less than or equal to 40."]}
   */
  public async validate(key: string, value: any): Promise<ElectronJSONSettingsStoreResult> {
    if (!this._hasInitialized) {
      throw new Error('Init the module first (method init). If you are using a async operation please wait until the init promise is resolved');
    }

    if (typeof key !== 'string') {
      throw new TypeError(
        `Expected ’key’ to be of type ’string’, got ${typeof key}`
      );
    }

    if (typeof key === 'string' && key.length === 0) {
      throw new TypeError('Enter a valid key name');
    }

    return ipcRenderer.invoke('ElectronJSONSettingsStore_validate', key, value);
  }

  /**
   * Sets the given key to cached memory
   * WARNING: the file is not written. If you also want to write
   * defaults to the file, you need to call writeSync() or
   * write() method after
   *
   * @param key key name or object to set multiple values at once
   * @param value value to store
   *
   * @example
   * await settings.set('debug', true);
   * await settings.set({debug: true, x: 5, y: -9})
   */
  public async set(key: string | object, value?: any): Promise<ElectronJSONSettingsStoreResult> {
    if (!this._hasInitialized) {
      throw new Error('Init the module first (method init). If you are using a async operation please wait until the init promise is resolved');
    }

    if (typeof key !== 'string' && typeof key !== 'object') {
      throw new TypeError(
        `Expected ’key’ to be of type ’string’ or ’object’, got ${typeof key}`
      );
    }

    if (typeof key !== 'object' && value === undefined) {
      throw new TypeError('You need to define a object');
    }

    if (typeof key === 'string' && key.length === 0) {
      throw new TypeError('Enter a valid key name');
    }

    return ipcRenderer.invoke('ElectronJSONSettingsStore_set', key, value);
  }

  /**
   * Sets the given object to cached memory
   * WARNING: the file is not written. If you also want to write
   * defaults to the file, you need to call writeSync() or
   * write() method after
   *
   * @param data settings object
   *
   * @example
   * await settings.setAll({debug: true, x: 5, y: -9})
   */
  public async setAll(data: object): Promise<ElectronJSONSettingsStoreResult> {
    if (!this._hasInitialized) {
      throw new Error('Init the module first (method init). If you are using a async operation please wait until the init promise is resolved');
    }

    return ipcRenderer.invoke('ElectronJSONSettingsStore_setAll', data);
  }

  /**
   * Sets the given key to cached memory and write the changes
   * to JSON file (sync file write operation on the main process)
   *
   * @param key key name or object to set multiple values at once
   * @param value value to store
   *
   * @example
   * await settings.setAndWriteSync('debug', true);
   * await settings.setAndWriteSync({debug: true, x: 5, y: -9})
   */
  public async setAndWriteSync(key: string | object, value?: any): Promise<ElectronJSONSettingsStoreResult> {
    const setOperation = await this.set(key, value);
    if (!setOperation.status) {
      return setOperation; // Return the error
    }

    const writeResult = await this.writeSync();

    if (writeResult !== true) {
      setOperation.errors = `Write operation failed! ${writeResult.toString()}`;
      setOperation.status = false;
    }

    return setOperation;
  }

  /**
   * Sets the given key to cached memory and write the changes
   * to JSON file (async file write operation on the main process)
   *
   * @param key key name or object to set multiple values at once
   * @param value value to store
   *
   * @example
   * await settings.setAndWrite('debug', true);
   * await settings.setAndWrite({debug: true, x: 5, y: -9})
   */
  public async setAndWrite(key: string | object, value?: any): Promise<ElectronJSONSettingsStoreResult> {
    const setOperation = await this.set(key, value);
    if (!setOperation.status) {
      return setOperation; // Return the error
    }

    const writeResult = await this.write();

    if (writeResult !== true) {
      setOperation.errors = `Write operation failed! ${writeResult.toString()}`;
      setOperation.status = false;
    }

    return setOperation;
  }

  /**
   * Write cached settings to file (sync file write operation on the main process)
   */
  public async writeSync(): Promise<boolean | string> {
    return ipcRenderer.invoke('ElectronJSONSettingsStore_writeSync');
  }

  /**
   * Write cached settings to file (async file write operation on the main process)
   */
  public async write(): Promise<boolean | string> {
    return ipcRenderer.invoke('ElectronJSONSettingsStore_write');
  }

  /**
   * Unsets the given key from the cached settings
   * @param key key
   */
  public async unset(key: string): Promise<boolean> {
    if (!this._hasInitialized) {
      throw new Error('Init the module first (method init). If you are using a async operation please wait until the init promise is resolved');
    }

    if (key.length === 0 || typeof key !== 'string') {
      throw new TypeError('Enter a valid key name');
    }

    // If key wasn't found return false
    if (!Object.prototype.hasOwnProperty.call(this._cachedSettings, key)) {
      return false;
    }

    delete this._cachedSettings[key];

    return ipcRenderer.invoke('ElectronJSONSettingsStore_unset', key);
  }

  /**
   * Disable file watcher
   * @returns true if operation success, false if error or
   * watcher not active
   */
  public async disableFileWatcher(): Promise<boolean> {
    return ipcRenderer.invoke('ElectronJSONSettingsStore_disableFileWatcher');
  }

  /**
   * Get setting from cache
   *
   * Return undefined if key was not found on cache and schema
   * WARNING: the file was not read
   * @param key key
   */
  public get(key: string): any {
    if (!this._hasInitialized) {
      throw new Error('Init the module first (method init). If you are using a async operation please wait until the init promise is resolved');
    }

    if (key.length === 0 || typeof key !== 'string') {
      throw new TypeError('Enter a valid key name');
    }

    if (!Object.prototype.hasOwnProperty.call(this._cachedSettings, key)) {
      if (Object.prototype.hasOwnProperty.call(this._defaults, key)) {
        return this._defaults[key]; // Return schema default value
      }

      return undefined; // Failsave
    }

    return this._cachedSettings[key];
  }

  /**
   * Get default
   *
   * Return undefined if key was not found on schema
   * @param key key
   */
  public getDefault(key: string): any {
    if (!this._hasInitialized) {
      throw new Error('Init the module first (method init). If you are using a async operation please wait until the init promise is resolved');
    }

    if (key.length === 0 || typeof key !== 'string') {
      throw new TypeError('Enter a valid key name');
    }

    if (Object.prototype.hasOwnProperty.call(this._defaults, key)) {
      return this._defaults[key]; // Return schema default value
    }

    return undefined; // Failsave
  }

  /**
   * Checks if the given key is in the cached settings
   * @param key key
   */
  public has(key: string): boolean {
    if (!this._hasInitialized) {
      throw new Error('Init the module first (method init). If you are using a async operation please wait until the init promise is resolved');
    }

    if (key.length === 0 || typeof key !== 'string') {
      throw new TypeError('Enter a valid key name');
    }

    // If key wasn't found return false
    return Object.prototype.hasOwnProperty.call(this._cachedSettings, key);
  }

  /**
   * Reset cached settings to default values defined in schema
   * WARNING: the file is not written. If you also want to write
   * defaults to the file, you need to call writeSync() or
   * write() method after
   */
  public async reset(): Promise<void> {
    this._cachedSettings = this._defaults;
    return ipcRenderer.invoke('ElectronJSONSettingsStore_reset');
  }

  /**
   * Reset cached settings to default values defined in schema
   * and write the changes to file (sync operation)
   */
  public async resetAndWriteSync(): Promise<boolean | string> {
    this._cachedSettings = this._defaults;
    return ipcRenderer.invoke('ElectronJSONSettingsStore_resetAndWriteSync');
  }

  /**
   * Reset cached settings to default values defined in schema
   * and write the changes to file (async operation)
   */
  public async resetAndWrite(): Promise<boolean | string> {
    this._cachedSettings = this._defaults;
    return ipcRenderer.invoke('ElectronJSONSettingsStore_resetAndWrite');
  }

  /**
   * Get All Settings
   * Returns an object with the current settings
   */
  get getAll(): object {
    return this._cachedSettings;
  }

  /**
   * Get default settings defined on schema
   */
  get getDefaults(): object {
    return this._defaults;
  }

  /**
   * Startup routine (async)
   * Recommended method to not block the renderer process
   */
  public async init(): Promise<void> {
    this._cachedSettings = await ipcRenderer.invoke('ElectronJSONSettingsStore_getAll');
    this._defaults = await ipcRenderer.invoke('ElectronJSONSettingsStore_getDefaults');
    this._hasInitialized = true;

    if (
      typeof this._defaults !== 'object' ||
      typeof this._cachedSettings !== 'object'
    ) {
      throw new TypeError('Invalid settings received');
    }

    // Register this renderer instance to the main process
    ipcRenderer.send('ElectronJSONSettingsStore_addListener');

    ipcRenderer.on(
      'ElectronJSONSettingsStore_updateSettings',
      (_event, settings) => {
        this._cachedSettings = settings;

        if (this._options.emitEventOnUpdated) {
          this.emit('updated', this._cachedSettings);
        }
      }
    );
  }

  /**
   * Startup routine (sync)
   * WARNING: Sending a synchronous message will block the whole
   * renderer process until the reply is received, so use this method
   * only as a last resort. It's much better to use the asynchronous version
   */
  public initSync(): void {
    // Send only one sync message to optimize the process
    const getData = ipcRenderer.sendSync('ElectronJSONSettingsStore_getAllAndDefaultsSync');
    this._cachedSettings = getData.cachedSettings;
    this._defaults = getData.defaults;
    this._hasInitialized = true;

    if (
      typeof this._defaults !== 'object' ||
      typeof this._cachedSettings !== 'object'
    ) {
      throw new TypeError('Invalid settings received');
    }

    // Register this renderer instance to the main process
    ipcRenderer.send('ElectronJSONSettingsStore_addListener');

    ipcRenderer.on(
      'ElectronJSONSettingsStore_updateSettings',
      (_event, settings) => {
        this._cachedSettings = settings;

        if (this._options.emitEventOnUpdated) {
          this.emit('updated', this._cachedSettings);
        }
      }
    );
  }

  /**
   * Check Process Type
   * @param processType a string representing the current process's type, can be "browser"
   * (i.e. main process), "renderer", or "worker"
   */
  private _checkProcessType(processType: string): boolean {
    return process.type === processType;
  }
}
