/*
 * background.js — Service Worker (Manifest V3)
 *
 * Proxies network requests from the content script to the Google Apps Script
 * Web App so that CORS restrictions are avoided. The content script sends
 * messages here via chrome.runtime.sendMessage and this worker performs the
 * actual fetch, returning the JSON response.
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GAS_GET") {
    fetch(message.url)
      .then((res) => res.json())
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep the message channel open for async response
  }

  if (message.type === "GAS_POST") {
    fetch(message.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload),
    })
      .then((res) => res.json())
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
