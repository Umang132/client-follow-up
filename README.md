# WhatsApp Mini-CRM — Chrome/Edge Extension

A private, production-ready Chrome/Edge Extension (Manifest V3) that injects a powerful Mini-CRM sidebar directly into WhatsApp Web. All data is stored in a Google Sheet via a Google Apps Script Web App — **zero paid services required**.

## Features

| Feature | Description |
|---|---|
| **Native Sidebar** | Collapsible CRM panel on the right side of the active chat, styled to match WhatsApp Web |
| **Auto-Detection** | Automatically extracts contact Name & Phone when you click a chat |
| **2-Way Sync** | Reads existing lead data from Google Sheets on chat open; writes back on "Save Lead" |
| **CRM Fields** | Name, Lead Source, Stage, Quantity, City, Follow-up Date, Notes |
| **1-Click Templates** | Inject pre-written follow-up or quick-ping messages into the chat input box |
| **Due-Today Badges** | Highlights contacts in the chat list whose follow-up date is today with a 🔔 badge |

## File Structure

```
├── manifest.json    # Manifest V3 configuration
├── background.js    # Service worker — proxies fetch requests to bypass CORS
├── content.js       # Core logic — DOM observation, sidebar, API calls
├── styles.css       # WhatsApp-native CSS for the sidebar & badges
├── Code.gs          # Google Apps Script — doGet / doPost for Google Sheets
├── icons/           # Extension icons (16, 48, 128 px)
└── README.md        # This file
```

## Deployment Guide

### Step 1 — Set Up Google Sheets Backend

1. **Create a new Google Sheet** at [sheets.google.com](https://sheets.google.com).
2. In the first row of **Sheet1**, add these exact headers (case-sensitive):

   | A | B | C | D | E | F | G | H |
   |---|---|---|---|---|---|---|---|
   | Phone | Name | LeadSource | Stage | Quantity | City | FollowUpDate | Notes |

3. Open **Extensions → Apps Script**.
4. Delete any boilerplate code and paste the entire contents of `Code.gs`.
5. Click **Deploy → New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Deploy** and **authorize** when prompted.
7. **Copy the Web App URL** (it looks like `https://script.google.com/macros/s/AKfyc.../exec`).

### Step 2 — Configure the Extension

1. Open `content.js` in a text editor.
2. Find the line:
   ```js
   const GAS_URL = "YOUR_GAS_WEB_APP_URL_HERE";
   ```
3. Replace `YOUR_GAS_WEB_APP_URL_HERE` with the Web App URL you copied in Step 1.
4. Save the file.

### Step 3 — Load the Unpacked Extension

#### Chrome
1. Navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right).
3. Click **Load unpacked** and select the folder containing `manifest.json`.

#### Edge
1. Navigate to `edge://extensions/`.
2. Enable **Developer mode** (toggle in the bottom-left).
3. Click **Load unpacked** and select the folder containing `manifest.json`.

### Step 4 — Use the Extension

1. Open [web.whatsapp.com](https://web.whatsapp.com) and log in.
2. You will see a green **📋** toggle button on the right edge of the screen.
3. Click it to open the Mini-CRM sidebar.
4. Click on any chat — the extension automatically detects the contact and loads their data.
5. Fill in fields and click **💾 Save Lead** to sync to your Google Sheet.
6. Use the **Quick Templates** buttons to inject pre-written messages.
7. Contacts with today's follow-up date will show a **🔔 Follow-up Due** badge in the chat list.

## Technical Notes

- **CORS**: The background service worker (`background.js`) proxies all network requests to the GAS Web App to avoid CORS issues on `web.whatsapp.com`.
- **DOM Observers**: `MutationObserver` instances watch for chat switches (header changes) and new chat list items (lazy loading) to keep the CRM and badges in sync.
- **No Build Step**: Pure Vanilla JS/CSS/HTML — just "Load Unpacked" and go.
- **Privacy**: All data stays in your own Google Sheet. No third-party services are used.