/**
 * Code.gs — Google Apps Script Web App
 *
 * This script powers the backend for the WhatsApp Mini-CRM Chrome Extension.
 * It uses the active spreadsheet as a lightweight database to store lead data.
 *
 * DEPLOYMENT:
 *   1. Create a new Google Sheet.
 *   2. Add header row in Sheet1:
 *      Phone | Name | LeadSource | Stage | Quantity | City | FollowUpDate | Notes
 *   3. Open Extensions ▸ Apps Script, paste this code.
 *   4. Deploy ▸ New deployment ▸ Web app.
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   5. Copy the Web App URL and paste it into content.js (GAS_URL constant).
 */

/* ------------------------------------------------------------------ */
/*  doGet — Handles read requests                                      */
/* ------------------------------------------------------------------ */

function doGet(e) {
  var params = e.parameter;

  // Action: "getDueToday" — returns phone numbers with today's follow-up date
  if (params.action === "getDueToday") {
    return buildJsonResponse(getDueToday());
  }

  // Action: "getLead" — returns lead data for a given phone number
  if (params.action === "getLead" && params.phone) {
    return buildJsonResponse(getLead(params.phone));
  }

  return buildJsonResponse({ status: "error", message: "Unknown action" });
}

/* ------------------------------------------------------------------ */
/*  doPost — Handles write / upsert requests                           */
/* ------------------------------------------------------------------ */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === "saveLead") {
      return buildJsonResponse(saveLead(data));
    }

    return buildJsonResponse({ status: "error", message: "Unknown action" });
  } catch (err) {
    return buildJsonResponse({ status: "error", message: err.message });
  }
}

/* ------------------------------------------------------------------ */
/*  getLead — Find a row by phone number                               */
/* ------------------------------------------------------------------ */

function getLead(phone) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var sanitized = sanitizePhone(phone);

  for (var i = 1; i < data.length; i++) {
    if (sanitizePhone(String(data[i][0])) === sanitized) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        var val = data[i][j];
        // Format Date objects to YYYY-MM-DD
        if (val instanceof Date) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
        }
        row[headers[j]] = val;
      }
      return { status: "found", data: row };
    }
  }
  return { status: "not_found" };
}

/* ------------------------------------------------------------------ */
/*  saveLead — Upsert: update existing row or append a new one         */
/* ------------------------------------------------------------------ */

function saveLead(payload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var sanitized = sanitizePhone(payload.Phone);
  var existingRow = -1;

  for (var i = 1; i < data.length; i++) {
    if (sanitizePhone(String(data[i][0])) === sanitized) {
      existingRow = i + 1; // 1-based sheet row
      break;
    }
  }

  var rowValues = headers.map(function (h) {
    return payload[h] !== undefined ? payload[h] : "";
  });

  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, headers.length).setValues([rowValues]);
    return { status: "updated", row: existingRow };
  } else {
    sheet.appendRow(rowValues);
    return { status: "created", row: sheet.getLastRow() };
  }
}

/* ------------------------------------------------------------------ */
/*  getDueToday — Return phone numbers with today's follow-up date     */
/* ------------------------------------------------------------------ */

function getDueToday() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var dateColIdx = headers.indexOf("FollowUpDate");

  if (dateColIdx === -1) {
    return { status: "error", message: "FollowUpDate column not found" };
  }

  var today = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );
  var duePhones = [];

  for (var i = 1; i < data.length; i++) {
    var cellVal = data[i][dateColIdx];
    var dateStr = "";

    if (cellVal instanceof Date) {
      dateStr = Utilities.formatDate(
        cellVal,
        Session.getScriptTimeZone(),
        "yyyy-MM-dd"
      );
    } else {
      dateStr = String(cellVal).trim();
    }

    if (dateStr === today) {
      duePhones.push(sanitizePhone(String(data[i][0])));
    }
  }

  return { status: "ok", phones: duePhones };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function sanitizePhone(phone) {
  return String(phone).replace(/[^0-9]/g, "");
}

function buildJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
