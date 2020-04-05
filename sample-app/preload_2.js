/**
 * Electron JSON Settings Store
 * Sample App - Renderer process
 * 
 * A sample settings window eith async start of settings
 */

const { ElectronJSONSettingsStoreRenderer } = require('../dist/index');

const config = new ElectronJSONSettingsStoreRenderer({ emitEventOnUpdated: false });

async function initSettings() {
  await config.init();

  document.getElementById('dark').checked = config.get('darkMode');
  document.getElementById('name').value = config.get('name');
  document.getElementById('size').value = config.get('size');
  document.body.style.opacity = 1;

  document.getElementById('dark').onchange = function () {
    config.set('darkMode', this.checked);

    // just to show validation function
    config.validate('darkMode', 'text').then(validation => {
      console.info('darkMode setting validation:');
      console.table(validation);
    });
  }

  document.getElementById('name').onchange = function () {
    config.set('name', this.value);
  }

  document.getElementById('size').onchange = function () {
    
    config.set('size', Number(this.value)).then((result) => {
      if (result.errors) {
        document.getElementById('size-error').innerText = result.errors;
        this.value = Number(config.getDefault('size'));
      } else {
        document.getElementById('size-error').innerText = '';
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initSettings();  
});
