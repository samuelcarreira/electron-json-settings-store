/*!
 * Electron JSON Settings Store
 * Main process
 *
 * Licensed under MIT
 * Copyright (c) 2020 [Samuel Carreira]
 */

import {app, ipcMain} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {ValidationSchema, ValidationError} from 'fastest-validator';
import * as Validator from 'fastest-validator';
import {ElectronJSONSettingsStoreResult} from '.';

export interface ElectronJSONSettingsStoreMainOptions {
  /**
   * Extension of the config file
   *
   * @default 'json'
   */
  fileExtension: string;
  /**
   * Filename without extension
   *
   * @default 'config'
   */
  fileName: string;
  /**
   * Settings complete filepath
   * Storage file location. Don't specify this unless absolutely necessary! By default,
   * it will pick the optimal location by adhering to system conventions
   *
   * @default app.getPath('userData')
   */
  filePath: string;
  /**
   * Save formatted (pretty print) JSON file
   *
   * Disable only  to save a few bytes/add some performance improvement
   * @default true
   */
  prettyPrint: boolean;
  /**
   * Settings will be validated after file reading
   * Note: the file is read on startup and on changed
   * content (if watch option is true)
   * Prevents the injection of invalid or warmfull settings
   *
   * @default true
   */
  validateFile: boolean;
  /**
   * Setting will be validated before is set
   * Prevents the injection of invalid or warmfull settings
   *
   * @default true
   */
  validate: boolean;
  /**
   * Unsure dir on startup
   * Note: at the moment I didn't write a optimized code to prevent errors
   * so it's recommended to enable this setting
   *
   * @default true
   */
  mkdirOnStartup: boolean;
  /**
   * Return default value defined on schema
   * if check validation failed
   * Recommended to prevent store invalid settings
   *
   * @default true
   */
  defaultOnFailValidation: boolean;
  /**
   * Watch File for changes
   * WARNING: Not recommended (feature in test)
   *
   * @default false
   */
  watchFile: boolean;
  /**
   * Save settings before app quits
   * NOTE: uses sync writing process
   *
   * @default false
   */
  writeBeforeQuit: boolean;
}

// interface ElectronJSONSettingsStoreResult {
//   status: boolean;
//   default: any;
//   errors?: string | string[];
// }

export default class ElectronJSONSettingsStoreMain {
  /**
   * Library Options
   */
  public options: ElectronJSONSettingsStoreMainOptions;
  /**
   * Save path and filename with extension
   * eg.: c:/users/name/appdata/roaming/myapp/config.json
   */
  public completeFilePath: string;
  /**
   * Settings object in memory
   * Speeds up the access to the value because you don't need
   * to read the file
   */
  public cachedSettings: {[index: string]: any};
  /**
   * Flag to check if file is current be written (for async mode)
   */
  private _isWritingFlag = false;
  /**
   * Validation schema and defaults
   */
  private readonly _schema: {[index: string]: any};
  /**
   * File watcher
   */
  private _watcher: any; // FSWatcher type
  /**
   * Last Time file was written
   * Used on watch file function
   */
  private _lastWriteHrtime: bigint;
  /**
   * Flag to trigger write operation again
   * Case: two almost simultanious async write operations
   * if true the system will write the file again
   */
  private _writeAgainFlag = false;
  /**
   * Flag to check quiting state (needed to
   * write before quit function )
   */
  private _isQuitingFlag = false;
  /**
   * Flag to check if init method has been initialized
   * if not the system can warn the user to initialize
   * the module. Usefull to help users who use async
   * operation an want to access to a setting before the
   * file read is completed
   */
  private _hasInitialized = false;
  /**
   * Compiled "checker" function
   */
  private readonly _check: (object: any) => true | ValidationError[];
  /**
   * Store defaults object (defined from shema)
   */
  private readonly _defaults: {[index: string]: any};

  private readonly _windowListeners: [Electron.WebContents | null];

  /**
   * Electron JSON Settings Store (Main)
   *
   * @param schema fastValidator schema
   * @param options options
   */
  constructor(schema: object, options: ElectronJSONSettingsStoreMainOptions) {
    if (!this._checkProcessType('browser')) {
      throw new Error('This module can only be used on the main process. Use the `ElectronJSONSettingsStoreRenderer` on renderer processes.');
    }

    if (typeof options !== 'object' || options === null) {
      throw new TypeError('You must specify a configuration object');
    }

    this._checkValidSchemaObject(schema); // Invalid schema will throw an error
    this._schema = schema;

    const defaultOptions: ElectronJSONSettingsStoreMainOptions = {
      filePath: app.getPath('userData'),
      fileExtension: 'json',
      fileName: 'config',
      prettyPrint: true,
      validateFile: true,
      validate: true,
      defaultOnFailValidation: true,
      mkdirOnStartup: true,
      watchFile: false,
      writeBeforeQuit: false
    };

    this.options = {...defaultOptions, ...options};

    this.completeFilePath = path.resolve(
      this.options.filePath,
      `${this.options.fileName}.${this.options.fileExtension}`
    );

    // Const v = new validator.default();
    // @ts-ignore
    const v = new Validator();
    this._check = v.compile(schema as ValidationSchema);

    this._defaults = this._retreiveDefaults(schema);

    this._watcher = null;

    this._lastWriteHrtime = process.hrtime.bigint();

    this.cachedSettings = {};

    this._windowListeners = [null];

    if (this.options.writeBeforeQuit) {
      this._writeBeforeQuit();
    }

    this._handleIpc();
  }

  /**
   * Get complete settings file path
   * @example
   * settings.getCompleteFilePath
   * 	=> c:\app\config.json
   */
  get getCompleteFilePath(): string {
    return this.completeFilePath;
  }

  // Set getCompleteFilePath(filepath: string) {
  // 	this.completeFilePath = filepath;
  // }

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
      return this._schema[key].default; // Return schema default value
    }

    return undefined; // Failsave
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

    if (!Object.prototype.hasOwnProperty.call(this.cachedSettings, key)) {
      if (Object.prototype.hasOwnProperty.call(this._schema, key)) {
        return this._schema[key].default; // Return schema default value
      }

      return undefined; // Failsave
    }

    return this.cachedSettings[key];
  }

  /**
   * Validate key with schema
   *
   * @param key key name
   * @param value value to check
   *
   * @example
   * const schema = {size: { type: 'number', positive: true, integer: true, default: 25, min: 10, max: 40 }}
   * settings.validate('size', 12)
   *  -> {status: true, default: 25}
   * settings.validate('size', 50)
   *  -> {status: false, default: 25, errors: ["The 'size' field must be less than or equal to 40."]}
   */
  public validate(key: string, value: any): ElectronJSONSettingsStoreResult {
    if (typeof key !== 'string') {
      throw new TypeError(
        `Expected ’key’ to be of type ’string’, got ${typeof key}`
      );
    }

    if (typeof key === 'string' && key.length === 0) {
      throw new TypeError('Enter a valid key name');
    }

    const object = {};

    Object.defineProperty(object, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    });

    const validationResults:
    | boolean
    | ValidationError[] = this._fastValidateSettings(object);

    if (validationResults === true) {
      return {
        status: true,
        default: this.getDefault(key),
        errors: false
      };
    }

    // Show errors
    const errorsList: string[] = [];

    // @ts-ignore
    Object.entries(validationResults).forEach(([_key, value]) => {
      if (Object.prototype.hasOwnProperty.call(value, 'message')) {
        const errorMessage: string = value.message.toString();
        errorsList.push(errorMessage);
      }
    });

    return {
      status: false,
      default: this.getDefault(key),
      errors: errorsList
    };
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
   * settings.set('debug', true);
   * settings.set({debug: true, x: 5, y: -9})
   */
  public set(key: string | object, value?: any): ElectronJSONSettingsStoreResult {
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

    try {
      if (typeof key === 'string') {
        const setResult: ElectronJSONSettingsStoreResult = this._set(key, value);
        // if (setResult !== true) {
        //   throw new Error(setResult.toString());
        // }

        return setResult;
      }

      const setResultArrayGroup: ElectronJSONSettingsStoreResult = {
        status: true,
        default: undefined,
        errors: []
      };

      // @ts-ignore
      Object.entries(key).forEach(([_key, _value]) => {
        const setResultArray = this._set(_key, _value);
        if (!setResultArray.status) {
          setResultArrayGroup.status = false;
          // @ts-ignore - Property 'push' does not exist on type 'string | string[]'
          setResultArrayGroup.errors.push(setResultArray.errors);
        }
      });

      return setResultArrayGroup;
    } catch (error) {
      return error;
    }
  }

  /**
   * Sets the given key to cached memory and write the changes
   * to JSON file (sync operation)
   *
   * @param key key name or object to set multiple values at once
   * @param value value to store
   *
   * @example
   * settings.setAndWriteSync('debug', true);
   * settings.setAndWriteSync({debug: true, x: 5, y: -9})
   */
  public setAndWriteSync(key: string | object, value?: any): ElectronJSONSettingsStoreResult {
    const setOperation = this.set(key, value);
    if (!setOperation.status) {
      return setOperation; // Return the error
    }

    const writeResult = this.writeSync();

    if (writeResult !== true) {
      setOperation.errors = `Write operation failed! ${writeResult.toString()}`;
      setOperation.status = false;
    }

    return setOperation;
  }

  /**
   * Sets the given key to cached memory and write the changes
   * to JSON file (async operation)
   *
   * @param key key name or object to set multiple values at once
   * @param value value to store
   *
   * @example
   * settings.setAndWrite('debug', true);
   * settings.setAndWrite({debug: true, x: 5, y: -9})
   */
  public async setAndWrite(key: string | object, value?: any): Promise<ElectronJSONSettingsStoreResult> {
    const setOperation = this.set(key, value);
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
   * Get All Settings
   */
  get getAll(): object {
    if (!this._hasInitialized) {
      throw new Error('Init the module first (method init). If you are using a async operation please wait until the init promise is resolved');
    }

    return this.cachedSettings;
  }

  /**
   * Get default settings defined on schema
   */
  get getDefaults(): object {
    return this._defaults;
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
   * settings.setAll({debug: true, x: 5, y: -9})
   */
  public setAll(data: object): void {
    if (!this._hasInitialized) {
      throw new Error('Init the module first (method init). If you are using a async operation please wait until the init promise is resolved');
    }

    if (!this.options.validate) {
      this._setCachedSettings(data);
      return;
    }

    const validationResults:
    | boolean
    | ValidationError[] = this._fastValidateSettings(data);

    if (validationResults === true) {
      this._setCachedSettings(data);
      return;
    }

    // Failed validation
    if (this.options.defaultOnFailValidation) {
      this._setCachedSettings(this._defaults);
    } else {
      // Show errors
      Object.entries(validationResults).forEach(([_key, value]) => {
        if (Object.prototype.hasOwnProperty.call(value, 'message')) {
          const errorMessage: string = value.message.toString();
          throw new Error(`Set All validation fail: ’${errorMessage}’`);
        }
      });
    }
  }

  /**
   * Unsets the given key from the cached settings
   * @param key key
   */
  public unset(key: string): boolean {
    if (key.length === 0 || typeof key !== 'string') {
      throw new TypeError('Enter a valid key name');
    }

    // If key wasn't found return false
    if (!Object.prototype.hasOwnProperty.call(this.cachedSettings, key)) {
      return false;
    }

    delete this.cachedSettings[key];

    return true;
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
    return Object.prototype.hasOwnProperty.call(this.cachedSettings, key);
  }

  /**
   * Reset cached settings to default values defined in schema
   * WARNING: the file is not written. If you also want to write
   * defaults to the file, you need to call writeSync() or
   * write() method after
   */
  public reset(): void {
    this._setCachedSettings(this._defaults);
  }

  /**
     * Reset cached settings to default values defined in schema
     * and write the changes to file (sync operation)
     */
  public resetAndWriteSync(): boolean | string {
    this.reset();

    return this.writeSync();
  }

  /**
   * Reset cached settings to default values defined in schema
   * and write the changes to file (async operation)
   */
  public async resetAndWrite(): Promise<boolean | string> {
    this.reset();

    return this.write();
  }

  /**
   * Write cached settings to file (sync operation)
   */
  public writeSync(): boolean | string {
    try {
      this._writeJSONFileSync(this.cachedSettings);
      return true;
    } catch (error) {
      return error.toString();
    }
  }

  /**
   * Write cached settings to file (async operation)
   */
  public async write(): Promise<boolean | string> {
    try {
      await this._writeJSONFile(this.cachedSettings);
      return true;
    } catch (error) {
      return error.toString();
    }
  }

  /**
   * Disable file watcher
   * @returns true if operation success, false if error or
   * watcher not active
   */
  public disableFileWatcher(): boolean {
    try {
      if (this._watcher !== null && this.options.watchFile) {
        this._watcher.close();
        this._watcher = null;
        this.options.watchFile = false;

        return true;
      }

      return false;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  public initSync(): void {
    try {
      fs.mkdirSync(this.options.filePath, {recursive: true});
    } catch (error) {
      console.error(error);
      throw new Error(
        `Cannot create folder ’${this.options.filePath}’. Make sure that you have the right writing permissions.`
      );
    }

    try {
      const jsonData: string = fs.readFileSync(this.completeFilePath, 'utf8');

      const parsedResult = this._parseJSON(jsonData);

      if (parsedResult instanceof Error) {
        console.log('defaults will be written');

        this._setCachedSettings(this._defaults);

        this._writeJSONFileSync(this.cachedSettings);

        if (this.options.watchFile) {
          this._watchFile();
        }

        this._hasInitialized = true;
        return;
      }

      this._setCachedSettings(parsedResult);

      if (this.options.validateFile) {
        this._validateSettingsSync(this.cachedSettings);
      }

      if (this.options.watchFile) {
        this._watchFile();
      }

      this._hasInitialized = true;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  public async init(): Promise<any> {
    if (this.options.mkdirOnStartup) {
      await fs.promises
        .mkdir(this.options.filePath, {recursive: true})
        .catch(() => {
          throw new Error(
            `Cannot create folder ’${this.options.filePath}’. Make sure that you have the right writing permissions.`
          );
        });
    }

    const jsonData: string = await fs.promises.readFile(this.completeFilePath, 'utf8');

    const parsedResult = this._parseJSON(jsonData);

    if (parsedResult instanceof Error) {
      console.log('defaults will be written');

      this._setCachedSettings(this._defaults);

      await this._writeJSONFile(this.cachedSettings);

      if (this.options.watchFile) {
        this._watchFile();
      }

      this._hasInitialized = true;
      return;
    }

    this._setCachedSettings(parsedResult);

    if (!this.options.validateFile) {
      if (this.options.watchFile) {
        this._watchFile();
      }

      this._hasInitialized = true;
      return;
    }

    if (this.options.validateFile) {
      await this._validateSettings(this.cachedSettings);
    }

    if (this.options.watchFile) {
      this._watchFile();
    }

    this._hasInitialized = true;
  }

  /**
   * Set to cached settings and send to other processes (renderer) via
   * IPC channel if settings are new (prevent polute IPC channel with unecessary
   * message if settings wasn't changed)
   * @param settings new settings object
   */
  private _setCachedSettings(settings: object): void {
    const changedSettings = deepEqual(settings, this.cachedSettings);

    if (!changedSettings) {
      this.cachedSettings = settings;
      this._sendIPCUpdateSettings();
    }
  }

  private _setCachedSettingsKey(key: string, value: any): void {
    const changedSettings = this.cachedSettings[key] === value;

    if (!changedSettings) {
      this.cachedSettings[key] = value;
      this._sendIPCUpdateSettings();
    }
  }

  private _sendIPCUpdateSettings(): void {
    this._windowListeners.forEach(listener => {
      if (listener) {
        listener.send(
          'ElectronJSONSettingsStore_updateSettings',
          this.cachedSettings
        );
      }
    });
  }

  /**
   * Set value to cached
   * @param key key name or object to set multiple values at once
   * @param value value to store
   * @returns true if operation is completed | error message if validation failed
   * and no default is applied
   */
  private _set(key: string, value: any): ElectronJSONSettingsStoreResult {
    // If key wasn't found
    if (!Object.prototype.hasOwnProperty.call(this.cachedSettings, key)) {
      if (Object.prototype.hasOwnProperty.call(this._defaults, key)) {
        this._setCachedSettingsKey(key, this._defaults[key]);
        return {
          status: true,
          default: this.getDefault(key),
          errors: false
        };
      }

      // Failsave
      return {
        status: false,
        default: undefined,
        errors: 'Key not found in cached settings'
      };
    }

    // No validation
    if (!this.options.validate) {
      this._setCachedSettingsKey(key, value);
      return {
        status: true,
        default: this.getDefault(key),
        errors: false
      };
    }

    const validationResults = this.validate(key, value);

    if (validationResults.status) {
      // Validation ok: true
      this._setCachedSettingsKey(key, value);
      return validationResults;
    }

    // Failed validation
    if (this.options.defaultOnFailValidation) {
      this._setCachedSettingsKey(key, this._defaults[key]); // Apply defaults
      return {
        status: true,
        default: this.getDefault(key),
        errors: 'Default setting was applied'
      };
    }

    return validationResults;
  }

  private _validateSettingsSync(settings: object): void {
    const validationResults:
    | boolean
    | ValidationError[] = this._fastValidateSettings(settings);

    // Validation failed
    if (validationResults !== true) {
      if (this.options.defaultOnFailValidation) {
        // Apply defaults only to errors
        Object.entries(validationResults).forEach(([_key, value]) => {
          const keyField: string = value.field.toString();
          Object.defineProperty(this.cachedSettings, keyField, {
            value: this._schema[keyField].default,
            writable: true,
            enumerable: true,
            configurable: true
          });
        });

        this._writeJSONFileSync(this.cachedSettings);
      } else {
        // Show errors
        Object.entries(validationResults).forEach(([_key, value]) => {
          if (Object.prototype.hasOwnProperty.call(value, 'message')) {
            const errorMessage: string = value.message.toString();
            throw new Error(
              `Initial settings validation fail: ’${errorMessage}’`
            );
          }
        });
      }
    }
  }

  private async _validateSettings(settings: object): Promise<any> {
    const validationResults:
    | boolean
    | ValidationError[] = this._fastValidateSettings(settings);

    // Validation failed
    if (validationResults !== true) {
      if (this.options.defaultOnFailValidation) {
        // Apply defaults only to errors
        Object.entries(validationResults).forEach(([_key, value]) => {
          const keyField: string = value.field.toString();
          Object.defineProperty(this.cachedSettings, keyField, {
            value: this._schema[keyField].default,
            writable: true,
            enumerable: true,
            configurable: true
          });
        });

        await this._writeJSONFile(this.cachedSettings);
      } else {
        // Show errors
        Object.entries(validationResults).forEach(([_key, value]) => {
          if (Object.prototype.hasOwnProperty.call(value, 'message')) {
            const errorMessage: string = value.message.toString();
            throw new Error(
              `Initial settings validation fail: ’${errorMessage}’`
            );
          }
        });
      }
    }
  }

  /**
     * Get default settings based on schema definition
     * @returns {object} default settings
     */
  private _retreiveDefaults(schema: object): object {
    const defaults = {};

    Object.entries(schema).forEach(([key, value]) => {
      Object.defineProperty(defaults, key, {
        value: value.default,
        writable: true,
        enumerable: true,
        configurable: true
      });
    });

    return defaults;
  }

  private _parseJSON(data: string): object | any {
    try {
      return JSON.parse(data);
    } catch (error) {
      // Console.log(`Error parsing JSON: ${error}`);
      return error;
    }
  }

  /**
     * Write JSON file ( Operation)
     * @param data object to be stringified
     */
  private async _writeJSONFile(data: object): Promise<void> {
    if (this._isWritingFlag) {
      // Console.log('write again flag');
      this._writeAgainFlag = true;
      return;
    }

    if (this._watcher !== null) {
      this._watcher.close();
      this._watcher = null;
    }

    this._isWritingFlag = true;

    const dataString: string = JSON.stringify(data, undefined, this.options.prettyPrint ? 4 : undefined);

    // Console.log('writing');
    await fs.promises.writeFile(this.completeFilePath, dataString);

    this._isWritingFlag = false;

    this._lastWriteHrtime = process.hrtime.bigint();

    if (this.options.watchFile && this._watcher === null) {
      this._watchFile();
    }

    if (this._writeAgainFlag) {
      this._writeAgainFlag = false;
      this._writeJSONFile(data);
    }
  }

  /**
   * Write JSON file (Sync Operation)
   * @param plainData object to be stringified
   */
  private _writeJSONFileSync(data: object): void {
    try {
      if (this._isWritingFlag) {
        this._writeAgainFlag = true;
        return;
      }

      if (this._watcher !== null) {
        this._watcher.close();
        this._watcher = null;
      }

      this._isWritingFlag = true;
      const dataString: string = JSON.stringify(data, undefined, this.options.prettyPrint ? 4 : undefined);

      // Console.log('writing...');
      fs.writeFileSync(this.completeFilePath, dataString);

      this._isWritingFlag = false;

      this._lastWriteHrtime = process.hrtime.bigint();

      if (this.options.watchFile && this._watcher === null) {
        this._watchFile();
      }

      if (this._writeAgainFlag) {
        this._writeAgainFlag = false;
        this._writeJSONFileSync(data);
      }
    } catch (error) {
      throw new Error(error);
    }
  }

  private _fileChanged(): void {
    try {
      // Console.log('file changed');

      const jsonData: string = fs.readFileSync(this.completeFilePath, 'utf8');

      const parsedResult = this._parseJSON(jsonData);

      if (parsedResult instanceof Error) {
        return;
      }

      if (!this.options.validateFile) {
        this._setCachedSettings(parsedResult);
        return;
      }

      const validationResults: | boolean | ValidationError[] = this._fastValidateSettings(parsedResult);

      // Validation failed
      if (validationResults === true) {
        this._setCachedSettings(parsedResult);
        return;
      }

      if (this.options.defaultOnFailValidation) {
        // Apply defaults only to errors
        Object.entries(validationResults).forEach(([_key, value]) => {
          const keyField: string = value.field.toString();
          Object.defineProperty(this.cachedSettings, keyField, {
            value: this._schema[keyField].default,
            writable: true,
            enumerable: true,
            configurable: true
          });
        });

        this._writeJSONFileSync(this.cachedSettings);
      } else {
        console.log('invalid settings ignore');
        return;
      }
    } catch (error) {
      console.log(error);
    }
  }

  private _watchFile(): void {
    let fsWait: boolean | NodeJS.Timeout = false;

    this._watcher = fs.watch(this.completeFilePath, (eventType, filename) => {
      if (filename && eventType === 'change') {
        if (fsWait || this._isWritingFlag) {
          return;
        }

        if (process.hrtime.bigint() - this._lastWriteHrtime < 1e10) {
          return;
        }

        fsWait = setTimeout(() => {
          fsWait = false;

          this._fileChanged();
        }, 1000);
      }
    });
  }

  private _fastValidateSettings(object: object): boolean | ValidationError[] {
    return this._check(object);
  }

  /**
   * Validate Schema Object
   * Throws error on invalid options
   * @param schema object
   */
  private _checkValidSchemaObject(schema: object): void {
    if (typeof schema !== 'object') {
      throw new TypeError('The `schema` option must be an object.');
    }

    if (Object.entries(schema).length === 0 && schema.constructor === Object) {
      throw new TypeError('The `schema` option cannot be empty.');
    }

    // Check if key has default value
    Object.entries(schema).forEach(([key, value]) => {
      if (!Object.prototype.hasOwnProperty.call(value, 'default')) {
        throw new Error(`The key ’${key}’ does not have a default value`);
      }
    });
  }

  /**
   * Check Process Type
   * @param processType a string representing the current process's type, can be "browser"
   * (i.e. main process), "renderer", or "worker"
   */
  private _checkProcessType(processType: string): boolean {
    return process.type === processType;
  }

  /**
   * Write Settings Before Quit
   * (sync operation)
   */
  private _writeBeforeQuit(): void {
    app.on('before-quit', event => {
      if (!this._isQuitingFlag && !this._isWritingFlag) {
        try {
          this._isQuitingFlag = true;
          event.preventDefault();
          this.writeSync();
        } catch (error) {
          console.log(error);
        } finally {
          app.quit();
        }
      }
    });
  }

  private async _handleIpc(): Promise<void> {
    ipcMain.on('ElectronJSONSettingsStore_addListener', event => {
      const listener: Electron.WebContents = event.sender;

      if (!this._windowListeners.includes(listener)) {
        this._windowListeners.push(listener);
      }
    });

    ipcMain.on('ElectronJSONSettingsStore_getAllAndDefaultsSync', event => {
      const sendData = {cachedSettings: this.cachedSettings, defaults: this._defaults};

      event.returnValue = sendData;
    });

    ipcMain.handle('ElectronJSONSettingsStore_validate', (_event, key, value) => {
      return this.validate(key, value);
    });

    ipcMain.handle('ElectronJSONSettingsStore_set', (_event, key, value) => {
      return this.set(key, value);
    });

    ipcMain.handle('ElectronJSONSettingsStore_setAll', (_event, data) => {
      return this.setAll(data);
    });

    ipcMain.handle('ElectronJSONSettingsStore_setAndWriteSync', async (_event, key, value) => {
      return this.setAndWriteSync(key, value);
    });

    ipcMain.handle('ElectronJSONSettingsStore_setAndWrite', async (_event, key, value) => {
      return this.setAndWrite(key, value);
    });

    ipcMain.handle('ElectronJSONSettingsStore_writeSync', async () => {
      return this.writeSync();
    });

    ipcMain.handle('ElectronJSONSettingsStore_write', async () => {
      return this.write();
    });

    ipcMain.handle('ElectronJSONSettingsStore_getAll', () => {
      return this.cachedSettings;
    });

    ipcMain.handle('ElectronJSONSettingsStore_getDefaults', () => {
      return this._defaults;
    });

    ipcMain.handle('ElectronJSONSettingsStore_unset', (_event, key) => {
      return this.unset(key);
    });

    ipcMain.handle('ElectronJSONSettingsStore_disableFileWatcher', () => {
      return this.disableFileWatcher();
    });

    ipcMain.handle('ElectronJSONSettingsStore_reset', () => {
      return this.reset();
    });

    ipcMain.handle('ElectronJSONSettingsStore_resetAndWriteSync', async () => {
      return this.resetAndWriteSync();
    });

    ipcMain.handle('ElectronJSONSettingsStore_resetAndWrite', async () => {
      return this.resetAndWrite();
    });
  }
}

/**
 * Checks if Objects are equal
 * @author https://stackoverflow.com/a/201265
 * @param x object 1
 * @param y object 2
 * @returns true if equals
 */
function deepEqual(x: object, y: object): boolean {
  const ok = Object.keys;
  const tx = typeof x;
  const ty = typeof y;

  // @ts-ignore
  return x && y && tx === 'object' && tx === ty ? ok(x).length === ok(y).length && ok(x).every(key => deepEqual(x[key], y[key])) : x === y;
}
