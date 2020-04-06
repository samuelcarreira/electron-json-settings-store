/*!
 * Electron JSON Settings Store
 * Renderer process
 *
 * Licensed under MIT
 * Copyright (c) 2020 [Samuel Carreira]
 */
/// <reference types="node" />
import { EventEmitter } from 'events';
import { ElectronJSONSettingsStoreResult } from '.';
export interface ElectronJSONSettingsStoreRendererOptions {
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
    private _cachedSettings;
    /**
     * Store defaults object (defined from shema)
     */
    private _defaults;
    /**
     * Class Options
     */
    private readonly _options;
    /**
     * Flag to check if init method has been initialized
     * if not the system can warn the user to initialize
     * the module
     */
    private _hasInitialized;
    /**
     * Electron JSON Settings Store (Renderer)
     * @param options options
     */
    constructor(options: ElectronJSONSettingsStoreRendererOptions);
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
    validate(key: string, value: any): Promise<ElectronJSONSettingsStoreResult>;
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
    set(key: string | object, value?: any): Promise<ElectronJSONSettingsStoreResult>;
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
    setAll(data: object): Promise<ElectronJSONSettingsStoreResult>;
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
    setAndWriteSync(key: string | object, value?: any): Promise<ElectronJSONSettingsStoreResult>;
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
    setAndWrite(key: string | object, value?: any): Promise<ElectronJSONSettingsStoreResult>;
    /**
     * Write cached settings to file (sync file write operation on the main process)
     */
    writeSync(): Promise<boolean | string>;
    /**
     * Write cached settings to file (async file write operation on the main process)
     */
    write(): Promise<boolean | string>;
    /**
     * Unsets the given key from the cached settings
     * @param key key
     */
    unset(key: string): Promise<boolean>;
    /**
     * Disable file watcher
     * @returns true if operation success, false if error or
     * watcher not active
     */
    disableFileWatcher(): Promise<boolean>;
    /**
     * Get setting from cache
     *
     * Return undefined if key was not found on cache and schema
     * WARNING: the file was not read
     * @param key key
     */
    get(key: string): any;
    /**
     * Get default
     *
     * Return undefined if key was not found on schema
     * @param key key
     */
    getDefault(key: string): any;
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
    reset(): Promise<void>;
    /**
     * Reset cached settings to default values defined in schema
     * and write the changes to file (sync operation)
     */
    resetAndWriteSync(): Promise<boolean | string>;
    /**
     * Reset cached settings to default values defined in schema
     * and write the changes to file (async operation)
     */
    resetAndWrite(): Promise<boolean | string>;
    /**
     * Get All Settings
     * Returns an object with the current settings
     */
    get getAll(): object;
    /**
     * Get default settings defined on schema
     */
    get getDefaults(): object;
    /**
     * Startup routine (async)
     * Recommended method to not block the renderer process
     */
    init(): Promise<void>;
    /**
     * Startup routine (sync)
     * WARNING: Sending a synchronous message will block the whole
     * renderer process until the reply is received, so use this method
     * only as a last resort. It's much better to use the asynchronous version
     */
    initSync(): void;
    /**
     * Check Process Type
     * @param processType a string representing the current process's type, can be "browser"
     * (i.e. main process), "renderer", or "worker"
     */
    private _checkProcessType;
}
