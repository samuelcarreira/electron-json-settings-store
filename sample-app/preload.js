/**
 * Electron JSON Settings Store
 * Sample App - Renderer process
 * 
 * based on electron-quick-start
 * https://github.com/electron/electron-quick-start
 */

const { ElectronJSONSettingsStoreRenderer } = require('./../dist/index');
const {ipcRenderer} = require('electron');

const config = new ElectronJSONSettingsStoreRenderer({emitEventOnUpdated: true});

function initSettings() {
	config.init().then(() =>
		applySettings()
	);

	config.on('updated', settings => {
		console.info('Settings updated! New Settings:');
		console.table(settings);
		
		applySettings();
	});
}

function applySettings() {
	document.getElementById('pre-settings').innerText = JSON.stringify(config.getAll, undefined, 4);

	document.getElementById('settings-name').style.fontSize = `${config.get('size')}pt`;
	document.getElementById('settings-name').innerText = `Hello ${config.get('name')}`;

	if (config.get('darkMode')) {
		document.body.classList.add('dark-theme');
	} else {
		document.body.classList.remove('dark-theme');
	}
}

// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener('DOMContentLoaded', () => {
	const replaceText = (selector, text) => {
		const element = document.getElementById(selector);
		if (element) { element.innerText = text };
	};

	for (const type of ['chrome', 'node', 'electron']) {
		replaceText(`${type}-version`, process.versions[type]);
	}

	initSettings();

	document.getElementById('btn-settings').onclick = () => {
		ipcRenderer.send('open-settings-window');
		console.log('Opening settings window...');
	}
});
