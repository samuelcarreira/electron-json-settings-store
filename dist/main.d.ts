/*!
 * Electron JSON Settings Store
 * Main process
 *
 * Licensed under MIT
 * Copyright (c) 2020 [Samuel Carreira]
 */
import { ElectronJSONSettingsStoreResult } from '.';
interface ElectronJSONSettingsStoreMainOptions {
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
export default class ElectronJSONSettingsStoreMain {
    /**
     * Library Options
     */
    options: ElectronJSONSettingsStoreMainOptions;
    /**
     * Save path and filename with extension
     * eg.: c:/users/name/appdata/roaming/myapp/config.json
     */
    completeFilePath: string;
    /**
     * Settings object in memory
     * Speeds up the access to the value because you don't need
     * to read the file
     */
    cachedSettings: {
        [index: string]: any;
    };
    /**
     * Flag to check if file is current be written (for async mode)
     */
    private _isWritingFlag;
    /**
     * Validation schema and defaults
     */
    private readonly _schema;
    /**
     * File watcher
     */
    private _watcher;
    /**
     * Last Time file was written
     * Used on watch file function
     */
    private _lastWriteHrtime;
    /**
     * Flag to trigger write operation again
     * Case: two almost simultanious async write operations
     * if true the system will write the file again
     */
    private _writeAgainFlag;
    /**
     * Flag to check quiting state (needed to
     * write before quit function )
     */
    private _isQuitingFlag;
    /**
     * Flag to check if init method has been initialized
     * if not the system can warn the user to initialize
     * the module. Usefull to help users who use async
     * operation an want to access to a setting before the
     * file read is completed
     */
    private _hasInitialized;
    /**
     * Compiled "checker" function
     */
    private readonly _check;
    /**
     * Store defaults object (defined from shema)
     */
    private readonly _defaults;
    private readonly _windowListeners;
    /**
     * Electron JSON Settings Store (Main)
     *
     * @param schema fastValidator schema
     * @param options options
     */
    constructor(schema: object, options: ElectronJSONSettingsStoreMainOptions);
    /**
     * Get complete settings file path
     * @example
     * settings.getCompleteFilePath
     * 	=> c:\app\config.json
     */
    get getCompleteFilePath(): string;
    /**
     * Get default
     *
     * Return undefined if key was not found on schema
     * @param key key
     */
    getDefault(key: string): any;
    /**
     * Get setting from cache
     *
     * Return undefined if key was not found on cache and schema
     * WARNING: the file was not read
     * @param key key
     */
    get(key: string): any;
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
    validate(key: string, value: any): ElectronJSONSettingsStoreResult;
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
    set(key: string | object, value?: any): ElectronJSONSettingsStoreResult;
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
    setAndWriteSync(key: string | object, value?: any): ElectronJSONSettingsStoreResult;
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
    setAndWrite(key: string | object, value?: any): Promise<ElectronJSONSettingsStoreResult>;
    /**
     * Get All Settings
     */
    get getAll(): object;
    /**
     * Get default settings defined on schema
     */
    get getDefaults(): object;
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
    setAll(data: object): void;
    /**
     * Unsets the given key from the cached settings
     * @param key key
     */
    unset(key: string): boolean;
    /**
     * Checks if the given key is in the cached settings
     * @param key key
     */
    has(key: string): boolean;
    /**
     * Reset cached settings to default values defined in schema
     * WARNING: the file is not written. If you also want to write
     * defaults to the file, you need to call writeSync() or
     * write() method after
     */
    reset(): void;
    /**
       * Reset cached settings to default values defined in schema
       * and write the changes to file (sync operation)
       */
    resetAndWriteSync(): boolean | string;
    /**
     * Reset cached settings to default values defined in schema
     * and write the changes to file (async operation)
     */
    resetAndWrite(): Promise<boolean | string>;
    /**
     * Write cached settings to file (sync operation)
     */
    writeSync(): boolean | string;
    /**
     * Write cached settings to file (async operation)
     */
    write(): Promise<boolean | string>;
    /**
     * Disable file watcher
     * @returns true if operation success, false if error or
     * watcher not active
     */
    disableFileWatcher(): boolean;
    initSync(): void;
    init(): Promise<any>;
    /**
     * Set to cached settings and send to other processes (renderer) via
     * IPC channel if settings are new (prevent polute IPC channel with unecessary
     * message if settings wasn't changed)
     * @param settings new settings object
     */
    private _setCachedSettings;
    private _setCachedSettingsKey;
    private _sendIPCUpdateSettings;
    /**
     * Set value to cached
     * @param key key name or object to set multiple values at once
     * @param value value to store
     * @returns true if operation is completed | error message if validation failed
     * and no default is applied
     */
    private _set;
    private _validateSettingsSync;
    private _validateSettings;
    /**
       * Get default settings based on schema definition
       * @returns {object} default settings
       */
    private _retreiveDefaults;
    private _parseJSON;
    /**
       * Write JSON file ( Operation)
       * @param data object to be stringified
       */
    private _writeJSONFile;
    /**
     * Write JSON file (Sync Operation)
     * @param plainData object to be stringified
     */
    private _writeJSONFileSync;
    private _fileChanged;
    private _watchFile;
    private _fastValidateSettings;
    /**
     * Validate Schema Object
     * Throws error on invalid options
     * @param schema object
     */
    private _checkValidSchemaObject;
    /**
     * Check Process Type
     * @param processType a string representing the current process's type, can be "browser"
     * (i.e. main process), "renderer", or "worker"
     */
    private _checkProcessType;
    /**
     * Write Settings Before Quit
     * (sync operation)
     */
    private _writeBeforeQuit;
    private _handleIpc;
}
export {};
