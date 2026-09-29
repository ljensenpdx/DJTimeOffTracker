// ==========================================
// ICS CALENDAR PARSER & ON-SITE EVENT FILTER
// ==========================================

function clean(str) {
    return str ? str.replace(/\\,/g, ',').replace(/\\n/g, ' ').trim() : "";
}

function stripOnSiteText(str) {
    if (!str) return '';
    return str
        .replace(/\(On[-_ ]*Site Location:\s*([^)]*)\)/gi, '$1')
        .replace(/\bON[-_ /]*SITE\b/gi, '')
        .replace(/\bONSITE\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function isOnSiteEvent(data) {
    const onSiteRegex = /(?:^|[\s_#(\[/,.:;!?-])(?:ON[-_ /]*SITE\vert{}ONSITE)(?:$\vert{}[\s_#)\]/,.:;!?-])/i;
    if (data.type && onSiteRegex.test(data.type)) return true;
    if (data.summary && onSiteRegex.test(data.summary)) return true;
    if (data.client && onSiteRegex.test(data.client)) return true;
    if (data.status && onSiteRegex.test(data.status)) return true;
    if (data.categories && onSiteRegex.test(data.categories)) return true;
    if (data.description) {
        const descNoSiteLoc = data.description.replace(/\(On[-_ ]*Site Location:[^)]*\)/gi, '');
        if (onSiteRegex.test(descNoSiteLoc)) return true;
        if (/(?:Type|Event Type|Package|Category|Status|Consultation|Walkthrough|Meeting):\s*.*(?:ON[-_ /]*SITE|ONSITE)/i.test(descNoSiteLoc)) return true;
    }
    if (data.loc) {
        const locClean = data.loc.replace(/\(On[-_ ]*Site Location:[^)]*\)/gi, '').trim();
        if (/^(?:ON[-_ /]*SITE|ONSITE)$/i.test(locClean)) return true;
    }
    if (data.block) {
        const blockNoSiteLoc = data.block.replace(/\(On[-_ ]*Site Location:[^)]*\)/gi, '');
        if (/(?:SUMMARY|TYPE|CATEGORIES|STATUS|DESCRIPTION|LOCATION):\s*.*(?:ON[-_ /]*SITE|ONSITE)/i.test(blockNoSiteLoc)) return true;
        if (onSiteRegex.test(blockNoSiteLoc)) return true;
    }
    return false;
}

async function loadIcalData() {
    try {
        const res = await fetch('events.ics?t=' + new Date().getTime());
        let text = await res.text();
        text = text.replace(/\r?\n[ \t]/g, ""); 
        const events = [];
        const blocks = text.split("BEGIN:VEVENT");
        blocks.shift(); 
        
        blocks.forEach(block => {
            const startRaw = block.match(/DTSTART(?:;[^:]+)?:(\d{8}(?:T(\d{6}))?)/);
            const endRaw = block.match(/DTEND(?:;[^:]+)?:(\d{8}(?:T(\d{6}))?)/);
            
            const summaryMatch = block.match(/SUMMARY(?:;[^:]+)?:(.*)/);
            const summary = clean(summaryMatch ? summaryMatch[1] : "");

            const descMatch = block.match(/DESCRIPTION(?:;[^:]+)?:((?:[^\r\n]|\r?\n(?![A-Z-]+(?:;[^:]+)?:))*)/s) || block.match(/DESCRIPTION(?:;[^:]+)?:(.*)/);
            const rawDesc = descMatch ? descMatch[1] : "";

            const catMatch = block.match(/CATEGORIES(?:;[^:]+)?:(.*)/i);
            const categories = clean(catMatch ? catMatch[1] : "");

            const typeMatch = rawDesc.match(/(?:Type|Event Type):\s*(.*?)(?:\\n|\r|\n|$)/i);
            const eventType = (typeMatch ? typeMatch[1].trim() : "").replace(/\(On[-_ ]*Site Location:[^)]*\)/gi, '').trim();

            const statusMatch = rawDesc.match(/(?:Status|Event Status):\s*(.*?)(?:\\n|\r|\n|$)/i);
            const eventStatus = statusMatch ? statusMatch[1].trim() : "BOOKED AND PAID";

            let clientName = summary.replace(/DJ Event for /gi, "").replace(/\s*\([^)]*\)/g, "").trim();
            if (!clientName) clientName = "Private Client";

            if (isOnSiteEvent({
                summary: summary,
                description: rawDesc,
                type: eventType,
                status: eventStatus,
                client: clientName,
                categories: categories,
                block: block
            })) {
                return;
            }

            const idMatch = (summary + " " + rawDesc + " " + block).match(/(?:ID:\s*|#)(\d{4,})|(\d{4,})/);
            const fullLoc = clean(block.match(/LOCATION(?:;[^:]+)?:(.*)/)?.[1] || "").replace(/\(On[-_ ]*Site Location:[^)]*\)/gi, '').trim();
            
            const siteMatch = (block.match(/LOCATION(?:;[^:]+)?:(.*)/)?.[1] || "").match(/\(On[-_ ]*Site Location:\s*([^)]+)\)/i)
                || rawDesc.match(/(?:Site Name|On[-_ ]*Site Location|Room|Specific Location|Area):\s*([^\n\\<]+)/i);
            const extractedSite = siteMatch ? clean(siteMatch[1]) : "";
            
            let pS = "---", pSt = "---", pE = "---";
            
            const formatTime = (timeStr) => {
                if (!timeStr) return "---";
                let h = parseInt(timeStr.substring(0, 2), 10);
                let m = timeStr.substring(2, 4);
                let ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
                return `${h}:${m} ${ampm}`;
            };

            if (startRaw && startRaw[2]) pSt = formatTime(startRaw[2]);
            if (endRaw && endRaw[2]) pE = formatTime(endRaw[2]);

            const setupMatch = rawDesc.match(/Setup Time:\s*(\d{1,2}:\d{2}\s*[APM]{2})/i);
            if (setupMatch) {
                pS = setupMatch[1].replace(/\s+/g, ' ');
            } else {
                const cleanDesc = rawDesc.replace(/\\/g, '').replace(/<[^>]*>/g, ' ');
                const tL = cleanDesc.match(/From\s*(\d{1,2}:\d{2}\s*[APM]{2})\s*to\s*(\d{1,2}:\d{2}\s*[APM]{2})\s*\(Setup\s*at\s*(\d{1,2}:\d{2}\s*[APM]{2})\)/i);
                if (tL) { 
                    pSt = tL[1].replace(/\s+/g, ' '); 
                    pE = tL[2].replace(/\s+/g, ' '); 
                    pS = tL[3].replace(/\s+/g, ' '); 
                }
            }

            const emailMatch = rawDesc.match(/(?:Client Email|Email|E-mail|Contact Email):\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
                || block.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
            const extractedEmail = emailMatch ? emailMatch[1].trim() : '';

            if (startRaw && startRaw[1]) {
                const dt = startRaw[1].substring(0, 8);
                events.push({
                    id: idMatch ? String(idMatch[1] || idMatch[2]) : Math.random().toString().slice(2,6),
                    date: `${dt.substring(0, 4)}-${dt.substring(4, 6)}-${dt.substring(6, 8)}`,
                    setup: pS !== '---' ? pS : '2:00 PM', 
                    showStart: pSt !== '---' ? pSt : '4:00 PM', 
                    end: pE !== '---' ? pE : '10:00 PM', 
                    type: stripOnSiteText(eventType) || "EVENT",
                    status: stripOnSiteText(eventStatus) || "BOOKED AND PAID",
                    client: stripOnSiteText(clientName) || "Private Client", 
                    loc: stripOnSiteText(fullLoc) || 'Location TBD',
                    site_name: stripOnSiteText(extractedSite),
                    client_email: extractedEmail
                });
            }
        });
        return events;
    } catch (e) { return []; }
}
