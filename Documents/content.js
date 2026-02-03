// DeedGuard Content Script (Migrated from Tampermonkey)

(function() {
    'use strict';

    // ⚠️ IMPORTANT: UPDATE THIS URL TO YOUR NETLIFY SITE URL
    const API_BASE_URL = "https://conflictsolution.netlify.app"; 

    const log = (msg) => console.log(`🛡️ [DeedGuard Extension]: ${msg}`);

    const getField = (keywords) => {
        for (let word of keywords) {
            let el = document.querySelector(`input[id*="${word}" i], select[id*="${word}" i]`);
            if (el && el.value) return el;
        }
        return null;
    };

    const fetchConflict = async (vol, year, range) => {
        if (API_BASE_URL.includes("YOUR_NETLIFY")) {
            alert("DeedGuard Error: Please configure the API_BASE_URL in content.js!");
            return null;
        }

        try {
            const params = new URLSearchParams({
                volume_no: vol,
                volume_year: year,
                page_range: range
            });
            
            const response = await fetch(`${API_BASE_URL}/check-conflict?${params.toString()}`);
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            
            const data = await response.json();
            return data.conflict ? data.deed_no : null;
        } catch (error) {
            console.error("Conflict check failed:", error);
            return null;
        }
    };

    const saveDeed = async (deedNo, vol, year, rangeStr) => {
        try {
            const response = await fetch(`${API_BASE_URL}/create-deed`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    deed_no: deedNo,
                    volume_no: vol,
                    volume_year: year,
                    page_range: rangeStr
                })
            });
            
            if (!response.ok) {
                const err = await response.text();
                if (err.includes("credentials not configured")) {
                    alert("⚠️ DeedGuard Setup Error: Please add SUPABASE_URL and SUPABASE_KEY to your Netlify environment variables!");
                }
                console.error("Failed to save deed:", err);
            } else {
                log("✅ Data synced via Netlify Backend.");
            }
        } catch (error) {
            console.error("Save deed failed:", error);
        }
    };

    const runSync = async (event, originalTarget) => {
        const vol = getField(["volume_no", "VolumeNo", "vol"])?.value;
        const year = getField(["presentation_year", "VolumeYear", "year", "reg_year"])?.value;
        const start = parseInt(getField(["start_page", "PageNoFrom", "PageFrom"])?.value);
        const end = parseInt(getField(["end_page", "PageNoTo", "PageTo"])?.value);
        const deedNo = getField(["doct_no", "deed_no", "DeedNo", "InstrumentNo"])?.value;
        const rangeStr = `[${start},${end}]`;

        if (!vol || !year || !deedNo || isNaN(start) || isNaN(end)) {
            log("⚠️ Missing required fields, skipping check.");
            return;
        }

        // Prevent the original action immediately to allow async check
        if (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }

        log(`🚀 Checking for conflicts: Vol ${vol}, Year ${year}, Pages ${start}-${end}`);

        // 1. FIRST: Check if someone else already has this range
        const conflictDeed = await fetchConflict(vol, year, rangeStr);

        if (conflictDeed) {
            alert(`🚫 CONFLICT DETECTED!\n\nThis page range (${start}-${end}) in Volume ${vol} (${year}) is already recorded.\n\nOwned by DEED NO: ${conflictDeed}\n\nPlease check your entries!`);
            return; // ⛔ STOP!
        }

        // 2. SECOND: If no conflict, save it to our database via backend
        await saveDeed(deedNo, vol, year, rangeStr);
        
        log("✅ No conflicts found. Data synced. Saving to Portal...");
        
        // 3. FINALLY: Trigger the portal's original action
        if (originalTarget.form) {
            originalTarget.form.submit();
        } else {
            originalTarget.click();
        }
    };

    document.addEventListener('mousedown', (e) => {
        const t = e.target;
        const btnText = (t.value || t.innerText || t.id || "").toLowerCase();
        if (btnText.includes('save') || btnText.includes('submit') || btnText.includes('continue')) {
            // Check if it's actually a button or submit input
            if (t.tagName === 'INPUT' || t.tagName === 'BUTTON' || t.closest('button')) {
                 runSync(e, t);
            }
        }
    }, true);
})();
