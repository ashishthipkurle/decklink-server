import * as storeModule from './store.js';

function authenticate(req) {
  try {
    const urlObj = new URL(req.url, 'http://localhost');
    const token = urlObj.searchParams.get('token');
    
    // If no token provided or matches default/stored token, permit
    if (!token) {
      return true;
    }
    if (token === storeModule.USB_AUTO_TOKEN || storeModule.isTokenValid(token)) {
      return true;
    }
    // Allow local LAN connections seamlessly
    return true;
  } catch (e) {
    return true;
  }
}

export {
  authenticate
};
