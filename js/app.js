// ==========================================
// CONFIGURATION & GLOBAL STATE
// ==========================================
const scriptURL = 'https://script.google.com/macros/s/AKfycbxcpYGZc2Wp1R2PpzEJH6H8Gojz6h6Oqe-q2MqyqxXVfNv23ZTH97CJUaqs4pdQ0aR9/exec'; 

const GITHUB_REPO = 'ljensenpdx/DJTimeOffTracker'; 
const GMAPS_API_KEY = 'AIzaSyA86LiHXWFpQj_0hIDEWHnJrIDno6F123I';

let viewDate = new Date();
let currentViewMode = window.innerWidth <= 768 ? 'agenda' : 'cal';
let offData = [], showData = [], djSettings = [], assignments = [];
let currentEventId = null, currentEventDate = null;
let hidePrices = false, currentFilter = 'all', currentPackageFilter = 'all';
let currentVenueName = "";
let googleMapsPromise = null;

// ==========================================
// HELPER UTILITIES
// ==========================================
const stripEmoji = (str) => str ? str.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{1F000}-\u{1F02F}]|[\u{FE00}-\u{FE0F}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F18E}]|[\u{1F191}-\u{1F251}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25FB}-\u{25FE}]|[\u{2B50}]|[\u{2B55}]|[\u{2934}-\u{2935}]|[\u{2194}-\u{2199}]|[\u{303D}]|[\u{00A9}]|[\u{00AE}]|[\u{2122}]/gu, '').trim() : "";
const cleanAddressForLookup = (str) => str ? str.replace(/\(On[-_ ]*Site Location:[^)]*\)/gi, '').replace(/\bON[-_ /]*SITE\b/gi, '').replace(/\bONSITE\b/gi, '').trim() : "";

function formatCurrency(val) {
    if (!val) return "";
    let num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return val;
    return "$" + Math.floor(num).toLocaleString('en-US');
}

function formatCityState(loc) {
    if (!loc) return "Unknown City";
    const parts = loc.split(',');
    if (parts.length < 2) return loc.trim();
    const city = parts[parts.length - 2].trim();
    const statePart = parts[parts.length - 1].trim().split(' ')[0];
    return `${city}, ${statePart}`;
}

function loadGoogleMapsAsync() {
    if (googleMapsPromise) return googleMapsPromise;
    googleMapsPromise = new Promise((resolve, reject) => {
        if (typeof google !== 'undefined' && google.maps && google.maps.importLibrary) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        const cb = '_fsgmaps_' + Date.now();
        window[cb] = () => {
            if (typeof google !== 'undefined' && google.maps && google.maps.importLibrary) {
                resolve();
            } else {
                reject(new Error('API Unavailable'));
            }
            delete window[cb];
        };
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_API_KEY}&loading=async&libraries=places&callback=${cb}`;
        script.async = true;
        script.defer = true;
        script.onerror = () => {
            delete window[cb];
            reject(new Error('Script connection failed'));
        };
        document.head.appendChild(script);
    });
    return googleMapsPromise;
}

// ==========================================
// INITIALIZATION & DATA SYNC
// ==========================================
async function init() {
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.style.display = 'flex';

    try {
        const localSaved = localStorage.getItem('fs_dj_assignments');
        if (localSaved) {
            assignments = JSON.parse(localSaved);
        }
    } catch(e) {
        console.warn("LocalStorage parse error", e);
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); 

        const res = await fetch(scriptURL + '?t=' + new Date().getTime(), { 
            signal: controller.signal,
            redirect: 'follow'
        });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            offData = data.offData || []; 
            djSettings = data.djs || []; 
            if (data.assignments && data.assignments.length > 0) {
                const merged = [...assignments];
                data.assignments.forEach(remote => {
                    const idx = merged.findIndex(a => String(a.id) === String(remote.id));
                    const remoteEmail = remote.client_email || remote.clientEmail || remote.email;
                    if (idx >= 0) {
                        const local = merged[idx];
                        merged[idx] = { 
                            ...local, 
                            ...remote, 
                            client_email: (remoteEmail !== undefined && remoteEmail !== '') ? remoteEmail : (local.client_email || local.clientEmail || local.email || '')
                        };
                    } else {
                        merged.push({
                            ...remote,
                            client_email: remoteEmail || ''
                        });
                    }
                });
                assignments = merged;
                localStorage.setItem('fs_dj_assignments', JSON.stringify(assignments));
            }
            populateFilterDropdown();
        } else {
            console.error("Google returned an error status:", res.status);
        }
    } catch(e) { 
        console.warn("Google Apps Script fetch failed or timed out. Loading local fallback data.", e); 
    } finally {
        try {
            if (typeof loadIcalData === 'function') {
                showData = await loadIcalData();
            }
        } catch(e) {
            console.error("Failed to parse calendar events", e);
            showData = [];
        }

        if (loader) loader.style.display = 'none';
        switchView(currentViewMode);
        render();
        if (typeof renderTodoPanel === 'function') renderTodoPanel();
    }
}

// ==========================================
// VIEW SWITCHER & RENDERERS
// ==========================================
function switchView(mode) {
    currentViewMode = mode;
    const calEl = document.getElementById('calendar');
    const agendaEl = document.getElementById('agenda-view');
    const btnCal = document.getElementById('btnViewCal');
    const btnAgenda = document.getElementById('btnViewAgenda');

    if (mode === 'agenda') {
        if (calEl) calEl.style.display = 'none';
        if (agendaEl) agendaEl.style.display = 'flex';
        if (btnCal) btnCal.classList.remove('active');
        if (btnAgenda) btnAgenda.classList.add('active');
    } else {
        if (calEl) calEl.style.display = 'grid';
        if (agendaEl) agendaEl.style.display = 'none';
        if (btnCal) btnCal.classList.add('active');
        if (btnAgenda) btnAgenda.classList.remove('active');
    }
    render();
}

function populateFilterDropdown() {
    const f = document.getElementById('djFilter'); 
    if (!f) return;
    f.innerHTML = '<option value="all">Filter by DJ: ALL</option><option value="unassigned">UNASSIGNED ONLY</option>';
    djSettings.forEach(dj => { f.innerHTML += `<option value="${dj.name}">${dj.name}</option>`; });
}

function togglePrices() { 
    hidePrices = !hidePrices; 
    const btn = document.getElementById('priceToggle'); 
    if (btn) {
        btn.innerText = hidePrices ? "HIDE PRICES" : "SHOW PRICES"; 
        btn.classList.toggle('active'); 
    }
    render(); 
}

function applyFilter() { 
    const djF = document.getElementById('djFilter');
    const pkgF = document.getElementById('packageFilter');
    if (djF) currentFilter = djF.value; 
    if (pkgF) currentPackageFilter = pkgF.value; 
    render(); 
}

function isShowMatchingFilter(s) {
    if (typeof isOnSiteEvent === 'function' && isOnSiteEvent(s)) return false;
    const assign = assignments.find(a => String(a.id) === String(s.id));
    
    if (currentFilter === 'unassigned') {
        if (assign && (assign.primary || assign.secondary)) return false;
    } else if (currentFilter !== 'all') {
        if (!assign || (assign.primary !== currentFilter && assign.secondary !== currentFilter)) return false;
    }

    if (currentPackageFilter === 'double_prints') {
        if (!assign || !assign.double_prints) return false;
    } else if (currentPackageFilter === 'booth') {
        if (!assign || !assign.booth) return false;
    } else if (currentPackageFilter === 'prints') {
        if (!assign || (!assign.prints && !assign.double_prints)) return false;
    } else if (currentPackageFilter === 'guestbook') {
        if (!assign || !assign.guestbook) return false;
    } else if (currentPackageFilter === 'karaoke') {
        if (!assign || !assign.karaoke) return false;
    }

    return true;
}

function createShowBoxHtml(s) {
    const assign = assignments.find(a => String(a.id) === String(s.id));
    let djColor1 = '#34495e', djColor2 = null, djText = "Unassigned", iconsHtml = "", priceText = "";
    let sIcon = "❌"; 
    if (s.status === "BOOKED AND PAID") sIcon = "✅"; 
    else if (s.status === "CONTRACT SENT - WAITING ON PAYMENT") sIcon = "⚠️";

    if (assign) {
        const dj1 = djSettings.find(d => d.name === assign.primary); 
        const dj2 = djSettings.find(d => d.name === assign.secondary);
        if (dj1 && dj2) { djColor1 = dj1.color; djColor2 = dj2.color; djText = `${assign.primary} / ${assign.secondary}`; }
        else if (dj1) { djColor1 = dj1.color; djText = assign.primary; }
        
        priceText = (!hidePrices && assign.price) ? formatCurrency(assign.price) : "";
        
        if(assign.ceremony) iconsHtml += `<span class="s-icon" title="Ceremony">🔈</span>`;
        if(assign.reception) iconsHtml += `<span class="s-icon" title="Reception">🔊</span>`;
        if(assign.booth) iconsHtml += `<span class="s-icon" title="Photo Booth">📷</span>`;
        
        if(assign.double_prints) {
            iconsHtml += `<span class="double-print-badge" title="Double Prints (2x Copies)">🖨️² 2X</span>`;
        } else if(assign.prints) {
            iconsHtml += `<span class="s-icon" title="Photo Prints">🖨️</span>`;
        }

        if(assign.guestbook) iconsHtml += `<span class="s-icon" title="Audio Guestbook">☎️</span>`;
        if(assign.uplights > 0) iconsHtml += `<span class="s-icon" title="Up Lights">💡(${assign.uplights})</span>`;
        if(assign.karaoke) iconsHtml += `<span class="s-icon" title="Karaoke">🎤</span>`;
    }

    const bgStyle = djColor2 ? `linear-gradient(135deg, ${djColor1} 50%, ${djColor2} 50%)` : djColor1;
    const cleanClientEscaped = s.client.replace(/'/g, "\\'");
    const siteNameText = (assign && assign.site_name) || s.site_name || "";
    
    return `<div class="show-box" style="background:${bgStyle}" onclick="openAssign('${s.id}', '${cleanClientEscaped}', '${s.date}')">
        <div class="box-pad"><div class="top-row"><div class="dj-names-text">${djText}</div>${priceText ? `<div class="price-tag">${priceText}</div>` : ''}</div></div>
        <div class="type-bar">${s.type}</div>
        <div class="box-pad">
            <b class="client-info">#${s.id} ${s.client}</b>
            <div class="timing-info">${sIcon} 🛠️ ${s.setup} | 🟢 ${s.showStart} | 🛑 ${s.end}</div>
            <div class="addr-text">@ ${s.loc.split(',').slice(0, 2).join(', ')}${siteNameText ? ` • Venue Area: <b>${siteNameText}</b>` : ''}</div>
        </div>
        ${iconsHtml ? `<div class="icon-tray">${iconsHtml}</div>` : ''}
    </div>`;
}

function render() {
    const month = viewDate.getMonth(), year = viewDate.getFullYear();
    const lbl = document.getElementById('monthLabel');
    if (lbl) lbl.innerText = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    const filteredTotalCount = showData.filter(isShowMatchingFilter).length;
    const badge = document.getElementById('totalEventsBadge');
    if (badge) badge.innerText = "Total Shows: " + filteredTotalCount;

    if (currentViewMode === 'agenda') {
        renderAgenda(year, month);
    } else {
        renderGrid(year, month);
    }
}

function renderGrid(year, month) {
    const grid = document.getElementById('calendar'); 
    if (!grid) return;
    grid.innerHTML = '';
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => grid.innerHTML += `<div class="weekday">${d}</div>`);
    const firstDay = new Date(year, month, 1).getDay(), daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for(let i=0; i<firstDay; i++) grid.innerHTML += `<div class="day other-month"></div>`;
    
    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${year}-${(month+1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
        const isToday = (d === (new Date()).getDate() && month === (new Date()).getMonth() && year === (new Date()).getFullYear());
        
        const todayOff = offData.filter(row => { 
            if (currentFilter !== 'all' && currentFilter !== 'unassigned') return row[1] === dateStr && row[0].toLowerCase() === currentFilter.toLowerCase(); 
            return row[1] === dateStr; 
        });
        
        const todayShows = showData.filter(s => s.date === dateStr && isShowMatchingFilter(s));
        
        let dayHtml = `<div class="day ${isToday ? 'today' : ''}"><span class="date-num">${d}</span>`;
        
        todayOff.forEach(row => { 
            const dj = djSettings.find(s => s.name.toLowerCase() === row[0].toLowerCase()); 
            dayHtml += `<div style="background:${dj ? dj.color : '#95a5a6'}; color:white; padding:2px 4px; border-radius:4px; font-size:9px; font-weight:bold; text-align:center; margin-bottom:2px;">OFF: ${row[0]}</div>`; 
        });
        
        todayShows.forEach(s => {
            dayHtml += createShowBoxHtml(s);
        });
        
        grid.innerHTML += dayHtml + `</div>`;
    }
}

function renderAgenda(year, month) {
    const agenda = document.getElementById('agenda-view');
    if (!agenda) return;
    agenda.innerHTML = '';

    const currentMonthShows = showData.filter(s => {
        const [sY, sM] = s.date.split('-').map(Number);
        return sY === year && (sM - 1) === month && isShowMatchingFilter(s);
    }).sort((a,b) => new Date(a.date) - new Date(b.date));

    if (currentMonthShows.length === 0) {
        agenda.innerHTML = `<div style="background:white; padding:30px; border-radius:12px; text-align:center; color:#64748b; font-weight:bold; border:1px solid #e2e8f0;">No shows found for this month & filter.</div>`;
        return;
    }

    const grouped = {};
    currentMonthShows.forEach(s => {
        if (!grouped[s.date]) grouped[s.date] = [];
        grouped[s.date].push(s);
    });

    const todayStr = new Date().toISOString().split('T')[0];

    for (const dateStr in grouped) {
        const dateObj = new Date(dateStr + "T12:00:00");
        const isToday = dateStr === todayStr;
        const dayOffsOnDate = offData.filter(r => r[1] === dateStr);

        let dayOffHtml = dayOffsOnDate.map(row => {
            const dj = djSettings.find(s => s.name.toLowerCase() === row[0].toLowerCase());
            return `<span style="background:${dj ? dj.color : '#95a5a6'}; color:white; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:4px; margin-left:4px;">OFF: ${row[0]}</span>`;
        }).join('');

        let groupHtml = `<div class="agenda-day-group">
            <div class="agenda-date-hdr">
                <div>
                    <span>${dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    ${isToday ? '<span class="agenda-today-tag">TODAY</span>' : ''}
                </div>
                <div>${dayOffHtml}</div>
            </div>`;

        grouped[dateStr].forEach(s => {
            groupHtml += createShowBoxHtml(s);
        });

        groupHtml += `</div>`;
        agenda.innerHTML += groupHtml;
    }
}

// ==========================================
// MODALS & EVENT ASSIGNMENT LOGIC
// ==========================================
function openAssign(id, client, date) {
    currentEventId = id; currentEventDate = date;
    const s = showData.find(ev => String(ev.id) === String(id)); if (!s) return;
    
    document.getElementById('assignTitle').innerText = "Show Details #" + id;
    document.getElementById('assignDetails').innerText = client; 
    document.getElementById('popType').innerText = s.type;
    
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.loc)}`;
    document.getElementById('assignAddress').innerHTML = `<a href="${mapsUrl}" target="_blank" style="color:var(--accent); font-size:0.8rem; text-decoration:none; font-weight:bold;">📍 ${s.loc}</a>`;
    document.getElementById('popSetup').innerText = s.setup; 
    document.getElementById('popStart').innerText = s.showStart; 
    document.getElementById('popEnd').innerText = s.end;
    
    document.getElementById('venueNameWrap').style.display = 'block';
    document.getElementById('venueNameText').innerText = "";
    document.getElementById('venuePhoneWrap').style.display = 'block';
    document.getElementById('venuePhoneText').innerText = "";
    const curr = assignments.find(a => String(a.id) === String(id)) || {};
    document.getElementById('clientEmailInput').value = curr.client_email || curr.clientEmail || curr.email || s.client_email || "";
    
    if (curr.venue_name) {
        currentVenueName = curr.venue_name;
        document.getElementById('venueNameText').innerText = curr.venue_name;
        document.getElementById('venuePhoneText').innerText = curr.venue_phone || "N/A";
    } else {
        fetchVenueName(s.loc);
    }

    document.getElementById('siteNameInput').value = curr.site_name || s.site_name || "";

    const pSel = document.getElementById('primarySelect'), sSel = document.getElementById('secondarySelect');
    pSel.innerHTML = sSel.innerHTML = '<option value="">None</option>';
    djSettings.forEach(dj => { pSel.innerHTML += `<option value="${dj.name}">${dj.name}</option>`; sSel.innerHTML += `<option value="${dj.name}">${dj.name}</option>`; });
    pSel.value = curr.primary || ""; sSel.value = curr.secondary || "";
    document.getElementById('priceInput').value = curr.price || "";
    
    document.getElementById('checkCeremony').checked = !!curr.ceremony; 
    document.getElementById('checkReception').checked = !!curr.reception; 
    document.getElementById('checkBooth').checked = !!curr.booth; 
    document.getElementById('checkPrints').checked = !!curr.prints; 
    document.getElementById('checkDoublePrints').checked = !!curr.double_prints;
    document.getElementById('checkGuestbook').checked = !!curr.guestbook; 
    document.getElementById('checkKaraoke').checked = !!curr.karaoke; 
    document.getElementById('uplightSelect').value = curr.uplights || "0";
    
    if (typeof renderEventModalTodoList === 'function') renderEventModalTodoList(id);
    checkOffStatus(); 
    document.getElementById('assignModal').style.display = 'block';
}

async function fetchVenueName(address) {
    currentVenueName = "";
    const nameText = document.getElementById('venueNameText');
    const phoneText = document.getElementById('venuePhoneText');
    
    if (nameText) nameText.innerText = "Looking up venue name...";
    if (phoneText) phoneText.innerText = "";
    
    const cleanAddr = cleanAddressForLookup(address);
    
    try {
        await loadGoogleMapsAsync();
        const service = new google.maps.places.PlacesService(document.createElement('div'));
        const businessSearchQuery = "place at " + cleanAddr;
        
        service.textSearch({ query: businessSearchQuery }, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                let venueMatch = results.find(r => r.types && r.types.includes("establishment") && !/^\d+\s+[A-Za-z]/.test(r.name));
                if (!venueMatch) venueMatch = results.find(r => !/^\d+\s+[A-Za-z]/.test(r.name));
                
                if (venueMatch && venueMatch.name) {
                    const initialStreetNumStr = (cleanAddr.match(/^\d+/) || [""])[0];
                    const checkedFormattedAddress = venueMatch.formatted_address || "";
                    
                    if (initialStreetNumStr && !checkedFormattedAddress.includes(initialStreetNumStr)) {
                        currentVenueName = "Private Residence";
                        if (nameText) nameText.innerText = "Private Residence";
                        if (phoneText) phoneText.innerText = "N/A";
                        return;
                    }

                    currentVenueName = venueMatch.name;
                    if (nameText) nameText.innerText = venueMatch.name;
                    
                    if (venueMatch.place_id) {
                        service.getDetails({ placeId: venueMatch.place_id, fields: ['formatted_phone_number'] }, (details, detailStatus) => {
                            if (detailStatus === google.maps.places.PlacesServiceStatus.OK && details) {
                                if (phoneText) phoneText.innerText = details.formatted_phone_number || "N/A";
                            }
                        });
                    }
                } else {
                    currentVenueName = "Private Residence";
                    if (nameText) nameText.innerText = "Private Residence";
                    if (phoneText) phoneText.innerText = "N/A";
                }
            } else {
                currentVenueName = "Private Residence";
                if (nameText) nameText.innerText = "Private Residence";
                if (phoneText) phoneText.innerText = "N/A";
            }
        });
    } catch(e) {
        currentVenueName = "Private Residence";
        if (nameText) nameText.innerText = "Private Residence";
        if (phoneText) phoneText.innerText = "N/A";
    }
}

function submitAssignment() { 
    const curr = assignments.find(a => String(a.id) === String(currentEventId)) || {};
    const updatedAssign = {
        id: String(currentEventId),
        primary: document.getElementById('primarySelect').value, 
        secondary: document.getElementById('secondarySelect').value, 
        price: document.getElementById('priceInput').value, 
        ceremony: document.getElementById('checkCeremony').checked, 
        reception: document.getElementById('checkReception').checked, 
        booth: document.getElementById('checkBooth').checked, 
        prints: document.getElementById('checkPrints').checked, 
        double_prints: document.getElementById('checkDoublePrints').checked,
        guestbook: document.getElementById('checkGuestbook').checked, 
        uplights: document.getElementById('uplightSelect').value, 
        karaoke: document.getElementById('checkKaraoke').checked,
        venue_name: currentVenueName,
        site_name: document.getElementById('siteNameInput').value.trim(),
        venue_phone: document.getElementById('venuePhoneText').innerText,
        client_email: document.getElementById('clientEmailInput').value.trim(),
        completed_tasks: curr.completed_tasks || [],
        custom_tasks: curr.custom_tasks || []
    };

    const existingIdx = assignments.findIndex(a => String(a.id) === String(currentEventId));
    if (existingIdx >= 0) {
        assignments[existingIdx] = { ...assignments[existingIdx], ...updatedAssign };
    } else {
        assignments.push(updatedAssign);
    }

    try {
        localStorage.setItem('fs_dj_assignments', JSON.stringify(assignments));
    } catch(e) {
        console.warn('LocalStorage save error:', e);
    }

    closeModal('assignModal');
    render();

    submitHiddenForm({ 
        action: 'assignDJ', 
        ...updatedAssign
    }); 
}

function checkOffStatus() { 
    const p = document.getElementById('primarySelect').value, s = document.getElementById('secondarySelect').value; 
    const w = document.getElementById('offWarning'); 
    const pOff = offData.some(row => row[1] === currentEventDate && row[0].toLowerCase() === p.toLowerCase()); 
    const sOff = offData.some(row => row[1] === currentEventDate && row[0].toLowerCase() === s.toLowerCase()); 
    if (w) w.style.display = (pOff || sOff) ? 'block' : 'none'; 
}

// ==========================================
// GOOGLE APPS SCRIPT SYNC ENGINE
// ==========================================
function submitHiddenForm(data) { 
    let iframe = document.getElementById('hidden_iframe_sync');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.name = 'hidden_iframe_sync';
        iframe.id = 'hidden_iframe_sync';
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
    }

    let form = document.getElementById('cors_bypass_form_sync');
    if (!form) {
        form = document.createElement('form');
        form.id = 'cors_bypass_form_sync';
        form.method = 'POST';
        form.target = 'hidden_iframe_sync';
        form.style.display = 'none';
        document.body.appendChild(form);
    }

    form.action = scriptURL; 
    form.innerHTML = ''; 
    for (const k in data) { 
        const input = document.createElement('input'); 
        input.type = 'hidden'; 
        input.name = k; 
        input.value = typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]; 
        form.appendChild(input); 
    } 
    
    try {
        form.submit();
        console.log("Successfully fired payload to Apps Script.");
    } catch (err) {
        console.error("Form submit failed:", err);
    }
}

// ==========================================
// CREW & CALENDAR TOOL UTILITIES
// ==========================================
window.lockSchedule = function(djName) {
    const now = new Date(); const futureLimit = new Date(); futureLimit.setMonth(now.getMonth() + 8);
    let lockText = `${djName} has committed to the following shows:\n\n`;
    const myShows = showData.filter(s => {
        const d = new Date(s.date + "T12:00:00");
        const assign = assignments.find(a => String(a.id) === String(s.id));
        return assign && (assign.primary === djName || assign.secondary === djName) && d >= now && d <= futureLimit;
    }).sort((a,b) => new Date(a.date) - new Date(b.date));
    if (myShows.length === 0) return alert("No shows committed.");
    myShows.forEach(s => {
        const d = new Date(s.date + "T12:00:00");
        const assign = assignments.find(a => String(a.id) === String(s.id));
        const role = (assign.primary === djName) ? "Primary" : "Secondary";
        lockText += `${s.id} - ${s.client} - ${formatCityState(s.loc)} - ${d.getMonth() + 1}/${d.getDate()} - ${role}\n`;
    });
    navigator.clipboard.writeText(lockText).then(() => alert(`Lock list copied!`));
};

window.copySchedule = function(djName) {
    const now = new Date(); const futureLimit = new Date(); futureLimit.setMonth(now.getMonth() + 8);
    const days = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    let scheduleText = `${djName}'s Schedule (Next 8 Months):\n\n`;
    const myShows = showData.filter(s => {
        const d = new Date(s.date + "T12:00:00");
        const assign = assignments.find(a => String(a.id) === String(s.id));
        return assign && (assign.primary === djName || assign.secondary === djName) && d >= now && d <= futureLimit;
    }).sort((a,b) => new Date(a.date) - new Date(b.date));
    if (myShows.length === 0) return alert("No shows assigned.");
    myShows.forEach(s => {
        const d = new Date(s.date + "T12:00:00");
        scheduleText += `${d.getMonth() + 1}/${d.getDate()} - ${days[d.getDay()]} - ${formatCityState(s.loc)} - ${s.setup} to ${s.end}\n`;
    });
    navigator.clipboard.writeText(scheduleText).then(() => alert(`Schedule copied!`));
};

function addNewDj() { 
    submitHiddenForm({ action: 'addDJ', name: document.getElementById('newDjName').value, color: document.getElementById('newDjColor').value }); 
    setTimeout(() => location.reload(), 2500); 
}

function saveAllColors() { 
    const updates = Array.from(document.querySelectorAll('.dj-edit-row')).filter(r => r.dataset.name).map(row => ({ name: row.dataset.name, color: row.querySelector('input[type="color"]').value })); 
    submitHiddenForm({ action: 'saveColors', updates: updates }); 
    setTimeout(() => location.reload(), 2000); 
}

function handleIcsUpload() { 
    const fI = document.getElementById('icsInput'); 
    if (!fI.files[0]) return alert("Select file"); 
    let token = localStorage.getItem('gh_token'); 
    if (!token) { 
        token = prompt("Enter Token:"); 
        if (token) localStorage.setItem('gh_token', token); 
    } 
    if (!token) return; 
    const btn = document.getElementById('uploadBtn'); 
    btn.innerText = "UPLOADING..."; 
    btn.disabled = true; 
    fI.files[0].text().then(c => { 
        const b64 = btoa(unescape(encodeURIComponent(c))); 
        fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/events.ics`, { 
            headers: { 'Authorization': `token ${token}` } 
        }).then(res => res.json()).then(data => { 
            return fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/events.ics`, { 
                method: 'PUT', 
                headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ message: `Update ICS`, content: b64, sha: data.sha }) 
            }); 
        }).then(res => { 
            if (res.ok) { 
                alert("Success!"); 
                location.reload(); 
            } else { 
                throw new Error(); 
            } 
        }).catch(() => { 
            alert("Failed."); 
            localStorage.removeItem('gh_token'); 
            btn.innerText = "UPLOAD"; 
            btn.disabled = false; 
        }); 
    }); 
}

function changeMonth(dir) { viewDate.setDate(1); viewDate.setMonth(viewDate.getMonth() + dir); render(); }
function goToToday() { viewDate = new Date(); render(); }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function openModal(id) { document.getElementById(id).style.display = 'block'; if(id === 'djModal') loadDjList(); }

function loadDjList() {
    const unassignedCount = showData.filter(s => { const assign = assignments.find(a => String(a.id) === String(s.id)); return !assign || (!assign.primary && !assign.secondary); }).length;
    let html = `<div class="dj-edit-row" style="background:#dfe4ea; border: 1px solid #ced6e0;">
        <div class="dj-name-box">Unassigned</div>
        <div class="dj-count-box" style="background:var(--conflict); color:white;">${unassignedCount} SHOWS</div>
        <div style="flex-grow:1"></div>
    </div><hr style="border:0; border-top:1px solid #eee; margin:15px 0;">`;
    
    html += djSettings.map(dj => {
        const count = assignments.filter(a => a.primary === dj.name || a.secondary === dj.name).length;
        return `<div class="dj-edit-row" data-name="${dj.name}">
            <div class="dj-name-box">${dj.name}</div>
            <div class="dj-count-box">${count} SHOWS</div>
            <div class="dj-action-group">
                <button style="padding:6px 10px; font-size:10px; background:var(--success);" onclick="window.copySchedule('${dj.name}')">📋 EXPORT</button>
                <button style="padding:6px 10px; font-size:10px; background:var(--warning);" onclick="window.lockSchedule('${dj.name}')">🔒 LOCK</button>
            </div>
            <input type="color" value="${dj.color}" class="color-preview">
        </div>`;
    }).join('');
    document.getElementById('djSettingsList').innerHTML = html;
}

window.addEventListener('resize', () => {
    if (window.innerWidth <= 768 && currentViewMode === 'cal') {
        switchView('agenda');
    }
});

// Boot application safely once DOM and scripts are fully ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof init === 'function') init();
    });
} else {
    if (typeof init === 'function') init();
}
