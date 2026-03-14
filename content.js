/* ============================================================
   content.js — WhatsApp Mini-CRM Content Script
   Injected into web.whatsapp.com via Manifest V3.
   ============================================================ */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /*  CONFIGURATION — paste your GAS Web App URL below                   */
  /* ------------------------------------------------------------------ */

  const GAS_URL = "YOUR_GAS_WEB_APP_URL_HERE";

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  let currentContact = { name: "", phone: "" };
  let dueTodayPhones = [];
  let sidebarEl = null;
  let toggleBtnEl = null;

  /* ================================================================== */
  /*  1. SIDEBAR HTML BUILDER                                            */
  /* ================================================================== */

  function buildSidebarHTML() {
    return `
      <div class="wcrm-header">
        <span>📋 Mini-CRM</span>
        <button id="wcrm-close-btn" title="Collapse">✕</button>
      </div>
      <div class="wcrm-body">
        <div id="wcrm-status"></div>

        <label for="wcrm-name">Name</label>
        <input id="wcrm-name" type="text" placeholder="Contact name" />

        <label for="wcrm-phone">Phone</label>
        <input id="wcrm-phone" type="text" placeholder="Phone number" readonly />

        <label for="wcrm-source">Lead Source</label>
        <select id="wcrm-source">
          <option value="">-- Select --</option>
          <option value="Google">Google</option>
          <option value="IndiaMart">IndiaMart</option>
          <option value="Offline">Offline</option>
          <option value="Meta">Meta</option>
        </select>

        <label for="wcrm-stage">Stage</label>
        <select id="wcrm-stage">
          <option value="">-- Select --</option>
          <option value="Open">Open</option>
          <option value="Won">Won</option>
          <option value="Lost">Lost</option>
        </select>

        <label for="wcrm-qty">Quantity</label>
        <input id="wcrm-qty" type="number" placeholder="0" min="0" />

        <label for="wcrm-city">City / Location</label>
        <input id="wcrm-city" type="text" placeholder="City" />

        <label for="wcrm-followup">Next Follow-up Date</label>
        <input id="wcrm-followup" type="date" />

        <label for="wcrm-notes">Notes / Last Interaction</label>
        <textarea id="wcrm-notes" placeholder="Write notes here…"></textarea>

        <button id="wcrm-save-btn" class="wcrm-btn wcrm-btn-primary">💾 Save Lead</button>

        <div class="wcrm-section-title">Quick Templates</div>
        <button class="wcrm-template-btn" id="wcrm-tpl-followup">
          📩 Follow-up Message
        </button>
        <button class="wcrm-template-btn" id="wcrm-tpl-ping">
          👋 Quick Ping
        </button>
      </div>
    `;
  }

  /* ================================================================== */
  /*  2. INJECT UI ELEMENTS                                              */
  /* ================================================================== */

  function injectUI() {
    if (document.getElementById("wcrm-sidebar")) return;

    // Sidebar
    sidebarEl = document.createElement("div");
    sidebarEl.id = "wcrm-sidebar";
    sidebarEl.classList.add("wcrm-hidden");
    sidebarEl.innerHTML = buildSidebarHTML();
    document.body.appendChild(sidebarEl);

    // Toggle button
    toggleBtnEl = document.createElement("button");
    toggleBtnEl.id = "wcrm-toggle-btn";
    toggleBtnEl.textContent = "📋";
    toggleBtnEl.title = "Toggle Mini-CRM";
    document.body.appendChild(toggleBtnEl);

    // Event listeners
    toggleBtnEl.addEventListener("click", toggleSidebar);
    document.getElementById("wcrm-close-btn").addEventListener("click", toggleSidebar);
    document.getElementById("wcrm-save-btn").addEventListener("click", handleSave);
    document.getElementById("wcrm-tpl-followup").addEventListener("click", () => injectTemplate("followup"));
    document.getElementById("wcrm-tpl-ping").addEventListener("click", () => injectTemplate("ping"));
  }

  function toggleSidebar() {
    if (!sidebarEl) return;
    sidebarEl.classList.toggle("wcrm-hidden");
    toggleBtnEl.style.right = sidebarEl.classList.contains("wcrm-hidden") ? "0" : "340px";
  }

  /* ================================================================== */
  /*  3. CONTACT DETECTION (header observer)                             */
  /* ================================================================== */

  /**
   * Extracts the contact name and phone number from WhatsApp Web's
   * chat header area. WhatsApp may show a phone number as the title
   * (for unsaved contacts) or a name + phone in the subtitle.
   */
  function detectContact() {
    // The main header for the active chat
    const header = document.querySelector("header");
    if (!header) return null;

    // WhatsApp renders the contact/group name in a <span> with
    // dir="auto" inside the header's title area.
    const nameSpan = header.querySelector("span[dir='auto'][title]");
    if (!nameSpan) return null;

    const rawTitle = (nameSpan.getAttribute("title") || "").trim();
    if (!rawTitle) return null;

    // Determine if the title itself is a phone number
    const phoneLike = /^\+?[\d\s\-()]{7,}$/;
    let name = "";
    let phone = "";

    if (phoneLike.test(rawTitle.replace(/[\s\-()]/g, ""))) {
      phone = rawTitle;
      name = rawTitle; // no saved name
    } else {
      name = rawTitle;
      // Try to get phone from the subtitle / "about" area
      const spans = header.querySelectorAll("span[title]");
      for (const sp of spans) {
        const t = (sp.getAttribute("title") || "").trim();
        if (t !== rawTitle && phoneLike.test(t.replace(/[\s\-()]/g, ""))) {
          phone = t;
          break;
        }
      }
      // Fallback: use header text that matches phone pattern
      if (!phone) {
        const allText = header.innerText || "";
        const match = allText.match(/\+?\d[\d\s\-()]{6,}\d/);
        if (match) phone = match[0];
      }
    }

    return { name, phone: sanitizePhone(phone) };
  }

  /* ================================================================== */
  /*  4. FETCH / SAVE LEAD DATA                                          */
  /* ================================================================== */

  function fetchLead(phone) {
    if (!phone || GAS_URL === "YOUR_GAS_WEB_APP_URL_HERE") return;

    setStatus("Loading…", "info");

    const url = GAS_URL + "?action=getLead&phone=" + encodeURIComponent(phone);

    chrome.runtime.sendMessage({ type: "GAS_GET", url }, (res) => {
      if (chrome.runtime.lastError) {
        setStatus("Extension error: " + chrome.runtime.lastError.message, "error");
        return;
      }
      if (!res || !res.success) {
        setStatus("Network error", "error");
        return;
      }

      const payload = res.data;
      if (payload.status === "found") {
        populateForm(payload.data);
        setStatus("Lead loaded ✓", "success");
      } else {
        clearForm();
        setStatus("New contact — fill in details", "info");
      }
    });
  }

  function handleSave() {
    const phone = document.getElementById("wcrm-phone").value.trim();
    if (!phone) {
      setStatus("No phone number detected", "error");
      return;
    }

    if (GAS_URL === "YOUR_GAS_WEB_APP_URL_HERE") {
      setStatus("Set GAS_URL in content.js first", "error");
      return;
    }

    const payload = {
      action: "saveLead",
      Phone: phone,
      Name: document.getElementById("wcrm-name").value.trim(),
      LeadSource: document.getElementById("wcrm-source").value,
      Stage: document.getElementById("wcrm-stage").value,
      Quantity: document.getElementById("wcrm-qty").value,
      City: document.getElementById("wcrm-city").value.trim(),
      FollowUpDate: document.getElementById("wcrm-followup").value,
      Notes: document.getElementById("wcrm-notes").value.trim(),
    };

    setStatus("Saving…", "info");
    const saveBtn = document.getElementById("wcrm-save-btn");
    saveBtn.disabled = true;

    chrome.runtime.sendMessage({ type: "GAS_POST", url: GAS_URL, payload }, (res) => {
      saveBtn.disabled = false;

      if (chrome.runtime.lastError) {
        setStatus("Extension error: " + chrome.runtime.lastError.message, "error");
        return;
      }
      if (!res || !res.success) {
        setStatus("Save failed — check network", "error");
        return;
      }

      const d = res.data;
      if (d.status === "updated") {
        setStatus("Lead updated ✓ (row " + d.row + ")", "success");
      } else if (d.status === "created") {
        setStatus("New lead created ✓ (row " + d.row + ")", "success");
      } else {
        setStatus("Unexpected response", "error");
      }
    });
  }

  /* ================================================================== */
  /*  5. DUE-TODAY BADGE LOGIC                                           */
  /* ================================================================== */

  function fetchDueToday() {
    if (GAS_URL === "YOUR_GAS_WEB_APP_URL_HERE") return;

    const url = GAS_URL + "?action=getDueToday";
    chrome.runtime.sendMessage({ type: "GAS_GET", url }, (res) => {
      if (chrome.runtime.lastError || !res || !res.success) return;
      if (res.data && res.data.status === "ok") {
        dueTodayPhones = res.data.phones || [];
        applyBadges();
      }
    });
  }

  /**
   * Scans visible chat list items and injects a "Follow-up Due" badge
   * next to contacts whose phone number is in the dueTodayPhones list.
   */
  function applyBadges() {
    if (dueTodayPhones.length === 0) return;

    // Each chat list row is rendered inside a div with role="listitem"
    // or inside a specific container. We look for all chat entries.
    const chatItems = document.querySelectorAll('[role="listitem"], [data-testid="cell-frame-container"]');

    chatItems.forEach((item) => {
      // Skip if badge already injected
      if (item.querySelector(".wcrm-followup-badge")) return;

      const text = item.innerText || "";
      // Try to find a phone number in the chat row
      const match = text.match(/\+?\d[\d\s\-()]{6,}\d/);
      if (match) {
        const cleaned = sanitizePhone(match[0]);
        if (dueTodayPhones.includes(cleaned)) {
          injectBadge(item);
        }
      }

      // Also check span titles for saved contacts (phone in title attr)
      const spans = item.querySelectorAll("span[title]");
      for (const sp of spans) {
        const t = sp.getAttribute("title") || "";
        const cleaned = sanitizePhone(t);
        if (cleaned.length >= 7 && dueTodayPhones.includes(cleaned)) {
          injectBadge(item);
          break;
        }
      }
    });
  }

  function injectBadge(chatItem) {
    if (chatItem.querySelector(".wcrm-followup-badge")) return;
    const badge = document.createElement("span");
    badge.className = "wcrm-followup-badge";
    badge.textContent = "🔔 Follow-up Due";
    // Insert badge into the first text container found
    const nameContainer = chatItem.querySelector("span[dir='auto']");
    if (nameContainer && nameContainer.parentNode) {
      nameContainer.parentNode.appendChild(badge);
    }
  }

  /* ================================================================== */
  /*  6. TEMPLATE INJECTION                                              */
  /* ================================================================== */

  function injectTemplate(type) {
    const name = currentContact.name || "there";
    const qty = document.getElementById("wcrm-qty").value || "[Quantity]";

    let text = "";
    if (type === "followup") {
      text =
        "Hello " +
        name +
        ", following up on your inquiry for " +
        qty +
        " revolving chairs. Please let me know if you need any further information or updates regarding the bid!";
    } else if (type === "ping") {
      text = "Hi " + name + ", just checking in. Let me know if we can move forward with your order.";
    }

    if (!text) return;

    // WhatsApp Web's message input uses a contenteditable div
    const inputBox = document.querySelector(
      'div[contenteditable="true"][data-tab="10"], footer div[contenteditable="true"]'
    );
    if (!inputBox) {
      setStatus("Message input box not found", "error");
      return;
    }

    // Focus and insert text
    inputBox.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);

    // Dispatch input event so WhatsApp picks up the change
    inputBox.dispatchEvent(new Event("input", { bubbles: true }));

    setStatus("Template injected ✓", "success");
  }

  /* ================================================================== */
  /*  7. FORM HELPERS                                                    */
  /* ================================================================== */

  function populateForm(data) {
    setVal("wcrm-name", data.Name);
    setVal("wcrm-phone", data.Phone);
    setVal("wcrm-source", data.LeadSource);
    setVal("wcrm-stage", data.Stage);
    setVal("wcrm-qty", data.Quantity);
    setVal("wcrm-city", data.City);
    setVal("wcrm-followup", data.FollowUpDate);
    setVal("wcrm-notes", data.Notes);
  }

  function clearForm() {
    ["wcrm-name", "wcrm-source", "wcrm-stage", "wcrm-qty", "wcrm-city", "wcrm-followup", "wcrm-notes"].forEach(
      (id) => setVal(id, "")
    );
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || "";
  }

  function setStatus(msg, type) {
    const el = document.getElementById("wcrm-status");
    if (!el) return;
    el.textContent = msg;
    el.className = type || "";
  }

  function sanitizePhone(str) {
    return String(str).replace(/[^0-9]/g, "");
  }

  /* ================================================================== */
  /*  8. MUTATION OBSERVERS                                              */
  /* ================================================================== */

  /**
   * Observes the chat header area to detect when the user switches chats.
   * When a new chat is opened, the contact is re-detected and data is fetched.
   */
  function startHeaderObserver() {
    let lastPhone = "";

    const observer = new MutationObserver(() => {
      const contact = detectContact();
      if (!contact || !contact.phone) return;
      if (contact.phone === lastPhone) return;

      lastPhone = contact.phone;
      currentContact = contact;

      // Update form with detected info
      setVal("wcrm-name", contact.name);
      setVal("wcrm-phone", contact.phone);
      clearForm();
      setVal("wcrm-name", contact.name);
      setVal("wcrm-phone", contact.phone);

      // Fetch existing lead data from Google Sheet
      fetchLead(contact.phone);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Observes the chat list panel to re-apply "Due Today" badges as new
   * chat rows are rendered (WhatsApp lazy-loads chat rows on scroll).
   */
  function startChatListObserver() {
    const observer = new MutationObserver(() => {
      applyBadges();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /* ================================================================== */
  /*  9. BOOT                                                            */
  /* ================================================================== */

  function boot() {
    injectUI();
    startHeaderObserver();
    startChatListObserver();
    fetchDueToday();

    // Refresh due-today list every 15 minutes
    setInterval(fetchDueToday, 15 * 60 * 1000);
  }

  // WhatsApp Web loads dynamically; wait for main UI to appear
  function waitForWhatsApp() {
    const check = setInterval(() => {
      if (document.querySelector("#app, #main, [data-testid='chat-list']")) {
        clearInterval(check);
        boot();
      }
    }, 1000);
  }

  waitForWhatsApp();
})();
