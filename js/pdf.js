// ==========================================
// PDF GENERATION & CLIENT EMAIL REMINDER
// ==========================================

const LOGO_URL = 'https://raw.githubusercontent.com/ljensenpdx/DJTimeOffTracker/main/LARGE%20LOGO.png';
let logoBase64 = null;

function getImageDataUrl(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = function() {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch(e) { reject(e); }
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = url;
    });
}

async function ensureLogo(timeout = 2000) {
    if (logoBase64) return logoBase64;
    try {
        logoBase64 = await Promise.race([
            getImageDataUrl(LOGO_URL),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))
        ]);
    } catch(e) {
        console.log("Logo load failed, defaulting to text banner.");
        logoBase64 = null;
    }
    return logoBase64;
}

async function generateEventPDF() {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) return alert("PDF Engine loading. Try again.");
    const s = showData.find(ev => String(ev.id) === String(currentEventId));
    const assign = assignments.find(a => String(a.id) === String(currentEventId)) || {};
    if (!s) return;

    const primary = assign.primary || "UNASSIGNED";
    const secondary = assign.secondary || "";
    const doc = new jsPDF();

    await ensureLogo();

    let headerBottomY = 0;
    if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 0, 0, 210, 50);
        headerBottomY = 56;
    } else {
        doc.setFillColor(44, 62, 80);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont(undefined, 'bold');
        doc.text("FUN SQUAD DJs", 105, 20, { align: 'center' });
        doc.setFontSize(11);
        doc.setTextColor(241, 196, 15);
        doc.text("DISPATCH PLAN", 105, 30, { align: 'center' });
        headerBottomY = 46;
    }

    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.setFont(undefined, 'normal');
    const eventTypeClean = stripEmoji(s.type);
    doc.text(`Event #${s.id}  |  ${eventTypeClean}`, 200, headerBottomY - 2, { align: 'right' });

    const boxY = headerBottomY + 2;
    const boxW = 58;
    const boxH = 28;
    const gap = 8;

    doc.setFillColor(241, 196, 15);
    doc.rect(10, boxY, boxW, boxH, 'F');
    doc.setFontSize(9);
    doc.setTextColor(44, 62, 80);
    doc.setFont(undefined, 'bold');
    doc.text("SETUP", 10 + boxW/2, boxY + 7, { align: 'center' });
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text(s.setup, 10 + boxW/2, boxY + 21, { align: 'center' });

    doc.setFillColor(39, 174, 96);
    doc.rect(10 + boxW + gap, boxY, boxW, boxH, 'F');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text("START", 10 + boxW + gap + boxW/2, boxY + 7, { align: 'center' });
    doc.setFontSize(16);
    doc.text(s.showStart, 10 + boxW + gap + boxW/2, boxY + 21, { align: 'center' });

    doc.setFillColor(192, 57, 43);
    doc.rect(10 + (boxW + gap)*2, boxY, boxW, boxH, 'F');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text("END", 10 + (boxW + gap)*2 + boxW/2, boxY + 7, { align: 'center' });
    doc.setFontSize(16);
    doc.text(s.end, 10 + (boxW + gap)*2 + boxW/2, boxY + 21, { align: 'center' });

    const d = new Date(s.date + "T12:00:00");
    const dateStr = `${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}-${d.getFullYear()}`;
    const dayName = d.toLocaleString('en-US', { weekday: 'long' });
    const dateBannerY = boxY + boxH + 6;

    doc.setFillColor(173, 216, 230);
    doc.rect(10, dateBannerY, 190, 16, 'F');
    doc.setFontSize(16);
    doc.setTextColor(0, 51, 102);
    doc.setFont(undefined, 'bold');
    doc.text(`${dateStr}  -  ${dayName}`, 105, dateBannerY + 11, { align: 'center' });

    let y = dateBannerY + 26;
    doc.setDrawColor(200);
    doc.line(10, y, 200, y);
    y += 10;

    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.setFont(undefined, 'bold');
    doc.text("DJ ASSIGNMENT", 10, y);
    doc.setDrawColor(44, 62, 80);
    doc.line(10, y + 2, 200, y + 2);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    y += 10;
    doc.text(`Primary: ${primary}`, 10, y); y += 7;
    if (secondary) { doc.text(`Secondary: ${secondary}`, 10, y); y += 7; }

    y += 5;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("EVENT DETAILS", 10, y);
    doc.setDrawColor(44, 62, 80);
    doc.line(10, y + 2, 200, y + 2);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    y += 10;

    const currentSavedVenueName = assign.venue_name || currentVenueName;
    if (currentSavedVenueName) {
        doc.setFont(undefined, 'bold');
        doc.setTextColor(39, 174, 96);
        doc.text(stripEmoji(currentSavedVenueName), 10, y);
        doc.setTextColor(44, 62, 80);
        doc.setFont(undefined, 'normal');
        y += 7;
    }

    const currentSavedSiteName = assign.site_name || document.getElementById('siteNameInput').value.trim() || s.site_name || "";
    if (currentSavedSiteName) {
        doc.setFont(undefined, 'bold');
        doc.setTextColor(230, 126, 34);
        doc.text(`Room / Specific Area: ${stripEmoji(currentSavedSiteName)}`, 10, y);
        doc.setTextColor(44, 62, 80);
        doc.setFont(undefined, 'normal');
        y += 7;
    }

    const currentSavedVenuePhone = assign.venue_phone || document.getElementById('venuePhoneText').innerText;
    if (currentSavedVenuePhone && currentSavedVenuePhone !== "N/A" && currentSavedVenuePhone !== "--") {
        doc.text(`Phone: ${currentSavedVenuePhone}`, 10, y);
        y += 7;
    }

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.loc)}`;
    const addrLine = stripEmoji(s.loc);
    doc.setTextColor(0, 102, 204);
    doc.text(addrLine, 10, y);
    const addrW = doc.getTextWidth(addrLine);
    doc.setDrawColor(0, 102, 204);
    doc.line(10, y + 1, 10 + addrW, y + 1);
    doc.link(10, y - 4, addrW, 6, { url: mapsUrl });
    doc.setTextColor(44, 62, 80);
    doc.setDrawColor(200);
    y += 7;

    doc.text(`Date: ${dateStr} (${dayName})`, 10, y); y += 12;

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("EQUIPMENT & SERVICES", 10, y);
    doc.setDrawColor(44, 62, 80);
    doc.line(10, y + 2, 200, y + 2);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    y += 10;

    const items = [
        assign.ceremony ? 'Ceremony System' : null,
        assign.reception ? 'Reception System' : null,
        assign.booth ? 'Photo Booth' : null,
        assign.double_prints ? 'Double Prints (2x Strips per session)' : (assign.prints ? 'Photo Prints' : null),
        assign.guestbook ? 'Audio Guestbook' : null,
        assign.karaoke ? 'Karaoke' : null,
        (assign.uplights || 0) > 0 ? `Up Lights x${assign.uplights}` : null
    ].filter(Boolean);

    if (items.length === 0) {
        doc.setTextColor(150);
        doc.setFontSize(10);
        doc.setFont(undefined, 'italic');
        doc.text("No equipment assigned for this event.", 14, y);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(44, 62, 80);
        y += 7;
    } else {
        items.forEach(label => {
            doc.text(`- ${label}`, 14, y);
            y += 7;
        });
    }

    doc.setFontSize(8);
    doc.setTextColor(180);
    doc.text("Generated by Fun Squad DJs Master Planner", 105, 285, { align: 'center' });

    doc.save(`Event-${s.id}-${primary}.pdf`);
}

async function generateClientReminderPDF() {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) return alert("PDF Engine loading. Try again.");
    const s = showData.find(ev => String(ev.id) === String(currentEventId));
    const assign = assignments.find(a => String(a.id) === String(currentEventId)) || {};
    if (!s) return;

    const isWedding = s.type && s.type.toLowerCase().includes("wedding");
    const cleanedEventLabelName = stripEmoji(s.type).trim();
    const formattedTitleCaseEventLabel = cleanedEventLabelName.charAt(0).toUpperCase() + cleanedEventLabelName.slice(1).toLowerCase();
    
    const doc = new jsPDF();

    await ensureLogo();

    doc.setFillColor(228, 0, 124);
    doc.rect(0, 0, 210, 36, 'F');

    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', 12, 3, 62, 24);
        } catch(e) {
            doc.setTextColor(255, 255, 255);
            doc.setFont(undefined, 'bold');
            doc.setFontSize(28);
            doc.text("FUN SQUAD DJS", 105, 22, { align: 'center' });
        }
    } else {
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(28);
        doc.text("FUN SQUAD DJS", 105, 22, { align: 'center' });
    }

    doc.setFont(undefined, 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("E L E V A T E   T H E   P A R T Y   W I T H   F U N !", 105, 31, { align: 'center' });

    doc.setFillColor(200, 0, 105);
    doc.rect(0, 36, 210, 8, 'F');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("PORTLAND WEDDING DJ   -   MT HOOD DJ", 105, 41.5, { align: 'center' });

    let y = 50;

    const headerText = isWedding ? "YOUR WEDDING DAY BACKSTAGE CHECKLIST" : "YOUR EVENT DAY BACKSTAGE CHECKLIST";
    doc.setFontSize(13);
    doc.setTextColor(200, 0, 105);
    doc.setFont(undefined, 'bold');
    doc.text(headerText, 105, y, { align: 'center' });
    y += 2;
    doc.setDrawColor(200, 0, 105);
    doc.setLineWidth(0.6);
    doc.line(20, y, 190, y);
    y += 7;

    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.setFont(undefined, 'normal');
    doc.text(`Hello ${stripEmoji(s.client)},`, 20, y);
    y += 5;

    const showEventDateObj = new Date(s.date + "T12:00:00");
    const targetWeekdayString = showEventDateObj.toLocaleString('en-US', { weekday: 'long' });
    const cleanFullFormattedDate = showEventDateObj.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    const wednesdayCalculatedObj = new Date(showEventDateObj.getTime());
    const rawDayIndexNum = showEventDateObj.getDay(); 
    const daysToSubtractToHitWednesday = (rawDayIndexNum >= 3) ? (rawDayIndexNum - 3) : (rawDayIndexNum + 4);
    wednesdayCalculatedObj.setDate(showEventDateObj.getDate() - daysToSubtractToHitWednesday);
    const wednesdayFormattedString = (wednesdayCalculatedObj.getMonth() + 1) + "/" + wednesdayCalculatedObj.getDate();

    const postEventTuesdayObj = new Date(showEventDateObj.getTime());
    const daysUntilNextTuesday = (2 - rawDayIndexNum + 7) % 7 || 7;
    postEventTuesdayObj.setDate(showEventDateObj.getDate() + daysUntilNextTuesday);
    const postTuesdayFormattedString = postEventTuesdayObj.toLocaleString('en-US', { month: 'short', day: 'numeric' });

    const plannedArrivalTime = s.setup || "1:00PM";

    const introParagraph = isWedding 
        ? `We are so excited to celebrate with you this ${targetWeekdayString}! To make sure your big day is absolutely perfect and everything runs smoothly, please double-check that your venue has these basic setup items ready for us:`
        : `We are so excited to celebrate with you this ${targetWeekdayString}! To make sure your celebration is absolutely perfect and everything runs smoothly, please double-check that your venue has these basic setup items ready for us:`;
    
    doc.setFontSize(9.2);
    doc.setTextColor(51, 65, 85);
    doc.text(introParagraph, 20, y, { maxWidth: 170 });
    y += 12;

    const boxHeight = 22;
    doc.setFillColor(254, 242, 248);
    doc.rect(20, y, 170, boxHeight, 'F');
    doc.setDrawColor(244, 114, 182);
    doc.setLineWidth(0.4);
    doc.line(20, y, 20, y + boxHeight);
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("CELEBRATION DATE", 45, y + 5.5, { align: 'center' });
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(200, 0, 105);
    doc.text(cleanFullFormattedDate, 45, y + 12, { align: 'center' });
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`(${targetWeekdayString})`, 45, y + 17.5, { align: 'center' });

    const venueOrLoc = (assign && assign.venue_name && assign.venue_name !== "Private Residence")
        ? assign.venue_name
        : (currentVenueName || (s.loc ? stripEmoji(s.loc).split(',')[0].trim() : "Private Venue"));
    const locTitle = venueOrLoc.length > 24 ? venueOrLoc.substring(0, 22) + '...' : venueOrLoc;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("VENUE & LOCATION", 105, y + 5.5, { align: 'center' });
    doc.setFont(undefined, 'bold');
    doc.setFontSize(locTitle.length > 18 ? 9 : 10.5);
    doc.setTextColor(200, 0, 105);
    doc.text(locTitle, 105, y + 12, { align: 'center' });
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Arrival Setup: ${plannedArrivalTime}`, 105, y + 17.5, { align: 'center' });

    const startColLabel = isWedding ? "CEREMONY START" : "EVENT START";
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(startColLabel, 165, y + 5.5, { align: 'center' });
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(200, 0, 105);
    doc.text(s.showStart || "---", 165, y + 12, { align: 'center' });
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Music Ends: ${s.end || "---"}`, 165, y + 17.5, { align: 'center' });

    y += boxHeight + 7;

    const checklistItems = [
        { title: "- Cover from the Sun & Weather", desc: "If we are outdoors, we need a tent, canopy, or solid roof over the DJ booth. Direct sunlight and heat can damage sensitive music gear, and it keeps your DJ cool so they can perform at their best!" },
        { title: "- One 6-Foot Rectangle Table & Chair", desc: "Please have the venue provide one sturdy 6-foot rectangular table for our mixing boards, laptops, and controllers, along with a standard chair for downtime or dinner breaks." },
        { title: "- Plug-In Power for the Ceremony", desc: "We need a standard, working wall outlet within 30 feet of where the ceremony music and microphones will be set up." },
        { title: "- Plug-In Power for the Reception", desc: "We need a standard, working wall outlet within 30 feet of our main reception speaker systems." },
        { title: "- Smoke & Marijuana Free Zone", desc: "To protect our expensive electronic gear and keep the air clear for your DJ, please make sure any designated guest smoking or marijuana spaces are set up far away from our speakers and equipment booths." }
    ];

    checklistItems.forEach(item => {
        doc.setFont(undefined, 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);
        doc.text(item.title, 20, y);
        y += 4;

        doc.setFont(undefined, 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(item.desc, 23, y, { maxWidth: 167 });
        y += 9.5;
    });

    y += 1;

    doc.setFont(undefined, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(200, 0, 105);

    const deadlineText = `MUSIC DEADLINE: Final playlist selections or adjustments must be submitted by Wednesday evening (${wednesdayFormattedString}) to lock in for the event.`;
    const wrapDeadlineLines = doc.splitTextToSize(deadlineText, 156);
    const deadlineHeight = (wrapDeadlineLines.length * 4.2) + 5;

    doc.setFillColor(255, 241, 248);
    doc.rect(20, y, 170, deadlineHeight, 'F');
    doc.setDrawColor(228, 0, 124);
    doc.setLineWidth(0.6);
    doc.rect(20, y, 170, deadlineHeight, 'D');

    let deadY = y + 4.5;
    wrapDeadlineLines.forEach(line => {
        doc.text(line, 23, deadY);
        deadY += 4.2;
    });

    y += deadlineHeight + 4;

    const reachoutText = "QUESTIONS OR CHANGES? If you have last-minute questions or want to review your timeline, feel free to give me a call directly or book a quick 15-minute meeting directly onto my calendar dashboard link here:\nhttps://cal.com/djlane/15min";
    const wrapReachoutLines = doc.splitTextToSize(reachoutText, 164);
    const reachoutHeight = (wrapReachoutLines.length * 4.2) + 5;

    doc.setFillColor(248, 250, 252);
    doc.rect(20, y, 170, reachoutHeight, 'F');
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.5);
    doc.rect(20, y, 170, reachoutHeight, 'D');

    doc.setFontSize(8.5);
    let reachY = y + 4.5;
    wrapReachoutLines.forEach(line => {
        if (line.startsWith("QUESTIONS OR CHANGES?")) {
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
        } else {
            doc.setFont(undefined, 'normal');
            doc.setTextColor(51, 65, 85);
        }

        if (line.includes("https://cal.com/djlane/15min")) {
            doc.setTextColor(2, 132, 199);
            doc.text(line, 23, reachY);
            const targetTextStringWidth = doc.getTextWidth(line);
            doc.link(23, reachY - 3, targetTextStringWidth, 4.5, { url: "https://cal.com/djlane/15min" });
        } else {
            doc.text(line, 23, reachY);
        }
        reachY += 4.2;
    });

    y += reachoutHeight + 6;

    doc.setFont(undefined, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(22, 163, 74);
    const closingTag = isWedding 
        ? "We can't wait to get everyone out on the dance floor! Thank you for helping us make your wedding perfect!" 
        : "We can't wait to get everyone out on the dance floor! Thank you for helping us make your event perfect!";
    doc.text(closingTag, 20, y, { maxWidth: 170 });

    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Fun Squad DJs  |  lane@funsquaddjs.com", 105, 286, { align: 'center' });

    const fileName = `Fun-Squad-DJs-Reminder-${s.id}.pdf`;
    doc.save(fileName);

    const destinationClientEmail = document.getElementById('clientEmailInput').value.trim();

    const updatedAssign = {
        id: String(s.id),
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
        client_email: destinationClientEmail,
        completed_tasks: assign.completed_tasks || [],
        custom_tasks: assign.custom_tasks || []
    };
    const existingIdx = assignments.findIndex(a => String(a.id) === String(s.id));
    if (existingIdx >= 0) {
        assignments[existingIdx] = { ...assignments[existingIdx], ...updatedAssign };
    } else {
        assignments.push(updatedAssign);
    }
    try {
        localStorage.setItem('fs_dj_assignments', JSON.stringify(assignments));
    } catch(e) {}
    submitHiddenForm({ 
        action: 'assignDJ', 
        ...updatedAssign
    });

    let emailSubject = `Quick Setup Reminder for Your Event! - Show #${s.id}`;
    let emailBodyText = "";

    const hasBooth = !!(assign.booth || document.getElementById('checkBooth').checked);
    const hasGuestbook = !!(assign.guestbook || document.getElementById('checkGuestbook').checked);
    const hasDoublePrints = !!(assign.double_prints || document.getElementById('checkDoublePrints').checked);

    let mediaEmailParagraph = "";
    if (hasBooth && hasGuestbook) {
        mediaEmailParagraph = `\n\n📸 🎙️ Digital Media Delivery: Since your package includes our Photo Booth${hasDoublePrints ? ' (with Double Prints)' : ''} and Audio Guestbook, you will receive email links to access all of your digital photo gallery images and audio recordings by Tuesday, ${postTuesdayFormattedString}!`;
    } else if (hasBooth) {
        mediaEmailParagraph = `\n\n📸 Digital Media Delivery: Since your package includes our Photo Booth${hasDoublePrints ? ' (with Double Prints)' : ''}, you will receive an email link to your complete digital gallery by Tuesday, ${postTuesdayFormattedString}!`;
    } else if (hasGuestbook) {
        mediaEmailParagraph = `\n\n🎙️ Digital Media Delivery: Since your package includes our Audio Guestbook, you will receive an email link to listen to all of your guest audio messages by Tuesday, ${postTuesdayFormattedString}!`;
    }

    if (isWedding) {
        emailSubject = `🎵 Your Wedding Day is This ${targetWeekdayString}! Final Details & Checklist - Show #${s.id}`;
        emailBodyText = `Hi ${s.client},\n\nWe are getting so close! We are absolutely thrilled and looking forward to celebrating with you this ${targetWeekdayString} on your big day!\n\nOne of our highly talented wedding DJs will be arriving at your venue at ${plannedArrivalTime} to get completely set up and run soundchecks long before your first guests walk through the door so that everything goes flawlessly and your wedding is absolutely perfect.\n\nPlease take just a brief moment to look over the attached one-page setup checklist. Could you please forward it to your wedding coordinator or venue manager? It just ensures they have our workspace ready (including a shaded spot out of the sun, a 6-foot table, working outlets within 30 feet, and keeping guest smoking spaces safely clear of the sound equipment).\n\nTo make sure your celebration is completely perfect, we also want to remind you that any final music choices or timeline adjustments need to be submitted by Wednesday evening (${wednesdayFormattedString}) to guarantee those changes can be made for your event.${mediaEmailParagraph}\n\nIf you have any last-minute questions or want to go over any of the finer details together, please feel free to give me a call directly or schedule a quick 15-minute chat with me right here: https://cal.com/djlane/15min\n\nWe are here for you every step of the way to ensure your day is absolutely perfect!`;
    } else {
        emailSubject = `🎵 Final Details & Setup Checklist for Your ${formattedTitleCaseEventLabel} - Show #${s.id}`;
        emailBodyText = `Hi ${s.client},\n\nWe are looking forward to celebrating with you this ${targetWeekdayString} for your upcoming event!\n\nOne of our highly talented ${formattedTitleCaseEventLabel.toLowerCase()} DJs will be arriving at your venue at ${plannedArrivalTime} to handle setup and soundchecks long before your event begins.\n\nPlease take a brief moment to look over the attached one-page setup checklist and forward it to your venue manager or coordinator to make sure they have our workspace ready (including a shaded spot out of the sun, a 6-foot table, power outlets within 30 feet, and keeping guest smoking or marijuana areas clear of the audio gear).\n\nAlso, a quick reminder that any final music or timeline changes need to be submitted by Wednesday evening (${wednesdayFormattedString}) to guarantee those adjustments are locked in for your event.${mediaEmailParagraph}\n\nIf you have any questions or want to review your timeline, feel free to give me a call or schedule a quick meeting with me here: https://cal.com/djlane/15min`;
    }
    
    try {
        await navigator.clipboard.writeText(emailBodyText);
    } catch(e) {}

    const mailtoUrl = `mailto:${encodeURIComponent(destinationClientEmail)}?cc=ariel@funsquaddjs.com&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBodyText)}`;
    
    try {
        const mailLink = document.createElement('a');
        mailLink.href = mailtoUrl;
        mailLink.target = '_top';
        document.body.appendChild(mailLink);
        mailLink.click();
        setTimeout(() => {
            if (mailLink.parentNode) mailLink.parentNode.removeChild(mailLink);
        }, 300);
    } catch(e) {
        window.location.href = mailtoUrl;
    }
}
