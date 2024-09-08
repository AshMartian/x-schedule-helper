chrome.runtime.onMessage.addListener(async (object) => {
  if (typeof object === 'object') {
    const key = Object.keys(object)[0];
    const value = object[key];
    console.log(`Received message: ${key} = ${value}`);
    
    console.log(`Stored value for ${key}: ${value}`);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Service worker installed.");
});