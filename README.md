# electron-json-settings-store

Persistent user settings for Electron apps with async file reading, built-in JSON schema validation and RAM cached settings

*WARNING:* This module is on an early development stage, please be cautious and start an issue if you find any bugs (I promise to continue to update this module as fast as I can)

## Key Features
* **Reading cached setting from memory**
    * Immediately access to the setting value without waiting for a disk reading operation

* **Built-in JSON schema validation**
    * Because you should never trust the user to manually edit the settings file
    * Can fall back to the default value if the validation fails
    * Uses the great fastest-validator library

* **Secure and lightweight**
    * Uses only node/electron native modules besides the validator library
    * The filesystem module (fs) was not exposed to renderer processes
    * Doesn't use the remote module

* **Async operation**
    * Because it's a good practice to access the filesystem asynchronously so you don't block the running process with a slower disk reading (but you can use sync operations if you need to)

* **Centralized settings to prevent conflicts**
    * The settings are managed only by the main process, so you don't have multiple instances of the settings object on your various browser windows

* **Written in TypeScript**

* **Well documented and easy to use**




## Installation
```
npm install --save electron-json-settings-store
```
or

```
yarn add electron-json-settings-store
```

### Requirements
Electron 7.x or later (Node.js v.12.x)




## Quick Usage
You only need to follow 4 simple steps to start using this module:

1. Import the library in the **main process**
```
    const { ElectronJSONSettingsStoreMain } = require('electron-json-settings-store');
```
2. Declare the JSON schema for the settings (check the [fastest-validator documentation](https://github.com/icebob/fastest-validator)) with the *default* values (the *default* key-values is **always required** for proper use of the module feature)
```
    const schema = {
            size: { default: 25, type: 'number', positive: true, integer: true, min: 10, max: 40 },
            darkMode: { default: false, type: 'boolean' },
            name: { default: 'World', type: 'string' }
        };
```
3. Declare the class with your preferred settings and initialize the library to read the values from the JSON file
```
    const config = new ElectronJSONSettingsStoreMain(schema, { watchFile: false, saveBeforeQuit: true });

    // sync mode is easy to use, but experience programmers can use async mode
    config.initSync();
    console.log(config.getAll);
```
4. (Optional: If you need to access the settings on the renderer process) Declare the class with your preferred settings and initialize the library on the renderer preload script
```
    const { ElectronJSONSettingsStoreRenderer } = require('electron-json-settings-store');

    const config = new ElectronJSONSettingsStoreRenderer();

    window.addEventListener('DOMContentLoaded', () => {
        config.init().then(() =>
            console.log(config.getAll)
        );
    });
```

## Test the sample app
[picture]
1. Download or clone this repository
2. Run `npm install` to install the dependencies
3. Run `npm run test-electron` and browse the *sample-app* folder

## Main process
- The use of this module on the main process is mandatory. The main process acts like a centralized hub and communicates to the renderer processes

### Class options (Main process)
Property         | Type     | Default    | Description
---------------- | -------- | ---------- | ----------------------
`fileExtension`  | `string` | `json`     | Extension of the config file.
`fileName`  	 | `string` | `config`   | Filename without extension.
`filePath`  	 | `string` | `app.getPath('userData')`| Settings complete filepath. Storage file location. Don't specify this unless absolutely necessary! By default, it will pick the optimal location by adhering to system conventions.
`prettyPrint`  	 | `boolean` | `true`   | Save formatted (pretty print) JSON file. Disable only  to save a few bytes/add some performance improvement.
`validateFile`  	 | `boolean` | `true`   | Settings will be validated after file reading. Note: the file is read on startup and on changed content (if watch option is true). Prevents the injection of invalid or warmfull config.
`validate`  	 | `boolean` | `true`   | Setting will be validated before is set. Prevents the injection of invalid or warmfull config.
`mkdirOnStartup`  	 | `boolean` | `true`   | Unsure dir on startup. Note: at the moment I didn't write a optimized code to prevent errors so it's recommended to enable this setting.
`defaultOnFailValidation`  	 | `boolean` | `true`   | Return default value defined on schema if check validation failed. Recommended to prevent store invalid config.
`watchFile`  	 | `boolean` | `false`   | Watch File for changes. WARNING: Not recommended (feature in test).
`defaultOnFailValidation`  	 | `boolean` | `false`   | Save settings before app quits. NOTE: uses sync writing process

### init()
> Startup routine (asynchronous file operation). 
```
    config.initSync();
    console.log(config.getAll);
```

### initSync()
> Startup routine (synchronous file operation)
```
    config.init().then(()=> {
        console.log(config.getAll);
    } )
    // or
    await config.init();
```

### get(key)
> Get setting from cache. Return `undefined` if key was not found on cache and schema. WARNING: the JSON file was not read (the value is fectched from cache)
```
    config.get('darkMode');
    > false
```

### getAll
> Returns an object with the current settings
```
    config.getAll;
    > {"size": 2, "darkMode": false, "name": "World"}
```

### getDefaults
> Returns an object with the default settings defined on schema
```
    config.getDefaults;
    > {"size": 25, "darkMode": true, "name": "World"}
```

### getDefault(key)
> Returns the default settings defined on schema. Return undefined if key was not found on schema
```
    config.getDefault('size');
    > 25
    config.getDefault('SomeInvalidKey');
    > undefined
```

### getCompleteFilePath
> Get complete settings file path
```
    config.getCompleteFilePath;
    > c:\users\username\appdata\roaming\app\config.json
```

### validate(key, value)
> Validate key with schema
Returns the custom *ElectronJSONSettingsStoreResult* object.
```  
    const schema = {size: { type: 'number', positive: true, integer: true, default: 25, min: 10, max: 40 }}

    config.validate('size', 12);
    > {status: true, default: 25, errors: false}

    config.validate('size', 50);
    > {status: false, default: 25, errors: ["The 'size' field must be less than or equal to 40."]}
```

### set(key, value)
> Sets the given key to cached memory.
 WARNING: the file is not written. If you also want to write defaults to the file, you need to call writeSync() or write() method after.
 Returns the custom *ElectronJSONSettingsStoreResult* object
```
    // set a single key
    config.set('debug', true);
    // set multiple keys at once
    config.set({debug: true, x: 5, y: -9});

```

### setAll(data)
> Sets the given object to cached memory.
WARNING: the file is not written. If you also want to write defaults to the file, you need to call writeSync() or write() method after
```
    config.setAll({debug: true, x: 5, y: -9});
```     

### setAndWriteSync(key, value)
> Sets the given key to cached memory and write the changes to JSON file (sync file write operation).
``` 
    config.setAndWriteSync('debug', true);
    config.setAndWriteSync({debug: true, x: 5, y: -9});
```

### setAndWrite(key, value) *async*
> Sets the given key to cached memory and write the changes to JSON file (async file write operation).
Returns the custom *ElectronJSONSettingsStoreResult* object
``` 
    await config.setAndWrite('debug', true);
    await config.setAndWrite({debug: true, x: 5, y: -9});
```

### writeSync()
> Write cached settings to file (sync file write operation).
Returns `true` if operation is success or a string with error
``` 
    config.writeSync(); // success operation
    > true
    config.writeSync(); // in case of error
    > 'Error: ENOENT: no such file...'
```

### write() *async*
> Write cached settings to file (async file write operation).
Returns `true` if operation is success or a string with error
``` 
    await config.writeSync(); // success operation
    > true
    await config.writeSync(); // in case of error
    > 'Error: ENOENT: no such file...'
```

### unset(key)
> Unsets the given key from the cached config.
Returns `true` if operation is success
``` 
    config.unset('darkMode'); // success operation
    > true
```

### has(key)
> Checks if the given key is in the cached config.
Returns `true` if the key exists
``` 
    config.has('darkMode');
    > true
    config.has('darkmode');
    > false
```

### reset()
> Reset cached settings to default values defined in schema. WARNING: the file is not written. If you also want to write defaults to the file, you need to call `writeSync()` or `write()` method after.
``` 
    config.reset(); 
```

### resetAndWriteSync()
> Reset cached settings to default values defined in schema and write the changes to file (sync file write operation). Returns `true` if operation is success or a string with error

### resetAndWrite() *async*
> Reset cached settings to default values defined in schema and write the changes to file (async file write operation). Returns `true` if operation is success or a string with error

### disableFileWatcher() 
> Unsets the given key from the cached config.
Returns `true` if operation success, `false` if error or watcher not active
``` 
    config.disableFileWatcher(); // success operation
    > true
```




## Renderer process
- The use of this library in renderer process is optional but you cannot use this library only in renderer process. You must declare and init the library first in the main process.
- You always need to call the init method before start using this library.
- The majority of the methods are async functions who returns a promise because you need to wait for the main process to listen and reply to the IPC message.

### Class options (Renderer process)
Property         | Type     | Default    | Description
---------------- | -------- | ---------- | ----------------------
`emitEventOnUpdated` | `boolean` | `false` | Emits event when settings is updated. Disable if you don't need to 'watch' settings change (can lead to a small performance improvment - less event listeners).

### init()
> Startup routine (async). **Recommended method** to not block the renderer process

### initSync()
> Startup routine (sync). WARNING: Sending a synchronous message will block the whole renderer process until the reply is received, so use this method only as a last resort. It's much better to use the asynchronous version



## Listen the `updated` event
If you enable `emitEventOnUpdated` option, an event is emitted when settings are updated. This option is a renderer process exclusive. You can listen to this event by using this code:
```
    config.on('updated', settings => {
		console.info('Settings updated! New Settings:');
		console.table(settings);

        // deal with the new cached settings object
	});
```

### get(key)
> Get setting from cache. Return `undefined` if key was not found on cache and schema. WARNING: the JSON file was not read (the value is fectched from cache)
```
    config.get('darkMode');
    > false
```

### getAll
> Returns an object with the current settings
```
    config.getAll;
    > {"size": 2, "darkMode": false, "name": "World"}
```

### getDefaults
> Returns an object with the default settings defined on schema
```
    config.getDefaults;
    > {"size": 25, "darkMode": true, "name": "World"}
```

### getDefault(key)
> Returns the default settings defined on schema. Return undefined if key was not found on schema
```
    config.getDefault('size');
    > 25
    config.getDefault('SomeInvalidKey');
    > undefined
```

### validate(key, value) *async*
> Validate key with schema (this is a async function because I don't want to require validation module again on renderer process)
Returns the custom *ElectronJSONSettingsStoreResult* object.
```  
    const schema = {size: { type: 'number', positive: true, integer: true, default: 25, min: 10, max: 40 }}

    await config.validate('size', 12);
    > {status: true, default: 25, errors: false}

    await config.validate('size', 50);
    > {status: false, default: 25, errors: ["The 'size' field must be less than or equal to 40."]}
```

### set(key, value) *async*
> Sets the given key to cached memory.
 WARNING: the file is not written. If you also want to write defaults to the file, you need to call writeSync() or write() method after.
 Returns the custom *ElectronJSONSettingsStoreResult* object
```
    // set a single key
    await config.set('debug', true);
    // set multiple keys at once
    await config.set({debug: true, x: 5, y: -9});

```

### setAll(data) *async*
> Sets the given object to cached memory.
WARNING: the file is not written. If you also want to write defaults to the file, you need to call writeSync() or write() method after
```
    await config.setAll({debug: true, x: 5, y: -9});
```     

### setAndWriteSync(key, value) *async*
> Sets the given key to cached memory and write the changes to JSON file (sync file write operation on the main process, but this method uses an async operation to communicate with the main process, so the result of the function is a promise)
``` 
    await config.setAndWriteSync('debug', true);
    await config.setAndWriteSync({debug: true, x: 5, y: -9});
```

### setAndWrite(key, value) *async*
> Sets the given key to cached memory and write the changes to JSON file (async file write operation on the main process).
Returns the custom *ElectronJSONSettingsStoreResult* object
``` 
    await config.setAndWrite('debug', true);
    await config.setAndWrite({debug: true, x: 5, y: -9});
```

### writeSync() *async*
> Write cached settings to file (sync file write operation on the main process).
Returns `true` if operation is success or a string with error
``` 
    await config.writeSync(); // success operation
    > true
    await config.writeSync(); // in case of error
    > 'Error: ENOENT: no such file...'
```

### write() *async*
> Write cached settings to file (async file write operation on the main process).
Returns `true` if operation is success or a string with error
``` 
    await config.writeSync(); // success operation
    > true
    await config.writeSync(); // in case of error
    > 'Error: ENOENT: no such file...'
```

### unset(key) *async*
> Unsets the given key from the cached config.
Returns `true` if operation is success
``` 
    await config.unset('darkMode'); // success operation
    > true
```

### disableFileWatcher() *async*
> Unsets the given key from the cached config.
Returns `true` if operation success, `false` if error or watcher not active
``` 
    await config.disableFileWatcher(); // success operation
    > true
```

### has(key)
> Checks if the given key is in the cached config.
Returns `true` if the key exists
``` 
    config.has('darkMode');
    > true
    config.has('darkmode');
    > false
```

### reset() *async*
> Reset cached settings to default values defined in schema. WARNING: the file is not written. If you also want to write defaults to the file, you need to call `writeSync()` or `write()` method after.
``` 
    await config.reset(); 
```

### resetAndWriteSync() *async*
> Reset cached settings to default values defined in schema and write the changes to file (sync file write operation on the main process). Returns `true` if operation is success or a string with error

### resetAndWrite() *async*
> Reset cached settings to default values defined in schema and write the changes to file (async file write operation on the main process). Returns `true` if operation is success or a string with error





## The JSON Schema
- You need to define a JSON schema for the settings. I will recommend to check the [fastest-validator documentation](https://github.com/icebob/fastest-validator)) to learn about the schema used.
- You must need to add the *default* value on each key
```
    // invalid: no default value
    const schema = {darkMode: {type: 'boolean' }};
    // valid
    const schema = {darkMode: {default: false, type: 'boolean' }};

    // other samples
    const schema = {
        darkMode: {default: false, type: 'boolean' },
        email: {default: 'john.doe@gmail.com', type: 'email },
        id: { default: 2', type: 'number', positive: true, integer: true },
        name: { default: 'john', type: 'string', min: 3, max: 255 },
        mac: { default: '01:C8:95:4B:65:FE', type: 'mac' },
        uuid: { default: '10ba038e-48da-487b-96e8-8d3b99b6d18a', type: 'uuid' },
        url: { default: 'http://google.com', type: 'url' },
        dob: { default: new Date(), type: 'date' }
    };
    
```
> ### For more details please check this [documentation](https://github.com/icebob/fastest-validator))



## The `ElectronJSONSettingsStoreResult` object
- This object is returned when you call the validate or write methods
- For now I opted to not throw an error object because you can have more control with a custom object and it's easy to deal for begginer programmers, but in the future I can change this part.
```
    // writing operation failed
    config.setAndWriteSync('size', 20);
    > {status: false, default: 25, default: 'Error ENOENT ...'}

    // validation failed
    config.validate('size', 50);
    > {status: false, default: 25, errors: ["The 'size' field must be less than or equal to 40."]}

    // validation passed (option `validate` is enabled)
    config.set('size', 22);
    > {status: true, default: 25, errors: false}
```


## Motivation and history
There are a lot of good store settings libraries out there, I've been using the [electron-store](https://github.com/sindresorhus/electron-store) module in the last years. But this and other modules have a "big problem" in my opinion: each time you want to access a key-value it reads the JSON file, besides that the read operation is synchronous so you block the process with a slow IO operation. I wrote a small class extension to fix the "problem" but I wasn't completed satisfied with the result. So I decided to write my custom library with a different approach. Now the settings file is managed on the main process and the renderer process communicates via IPC with the main process which acts as a "centralized server". It doesn't use the remote module so there is more control over the communication, you can read more about the drawbacks of the remote module on this [link](https://medium.com/@nornagon/electrons-remote-module-considered-harmful-70d69500f31) . Also by default, you can use asynchronously IO operations so you don't block the running process with a slower disk reading. The settings object is cached on memory so you only need to read from the disk if the file is changed and setting a new value doesn't oblige you to immediately write the changes on the file (you can write to the JSON file before the app quits or by using the write method).
This is my first published module written in TypeScript. I tried to follow the standards and the eslint recommended rules so some lines of code don't look much concize or simplified. This module is on an early stage of development so if you find any bugs or do you have any suggestion please contact me.


## Contribution
Please send pull requests improving the usage and fixing bugs, improving documentation and providing better examples, or providing some tests, because these things are important.


## TODO list
- [ ]  Code revision for bug squashing
- [ ]  Add tests


## FAQ
<details>
<summary> Can I use nested objects inside the settings? </summary>
Currently, this feature isn't implemented. I never used nested objects inside the settings (they are simple objects), so I didn't include this option
</details>

## Credits 
 - Icebob for the great [fastest-validator](https://github.com/icebob/fastest-validator) library (used to validate the JSON file)


## Other library alternatives
- [electron-app-settings](https://github.com/kettek/electron-app-settings)
- [electron-store](https://github.com/sindresorhus/electron-store)


## License
- Licensed under MIT

- Copyright (c) 2020 [Samuel Carreira]
