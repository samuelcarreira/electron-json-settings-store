/*!
 * Electron JSON Settings Store
 *
 *
 * Licensed under MIT
 * Copyright (c) 2020 [Samuel Carreira]
 */
export declare class ValidationError extends Error {
    /**
     * Description of error(s)
     */
    readonly errors: string;
    /**
     * Default value defined in schema
     */
    readonly defaultValue: any;
    constructor(errors: string, defaultValue: any);
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
export { default as ElectronJSONSettingsStoreMain } from './main';
export { default as ElectronJSONSettingsStoreRenderer } from './renderer';
