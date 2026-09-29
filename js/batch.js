// ==========================================
// WEDDING FOLDER BATCH (.BAT) GENERATOR
// ==========================================

function sanitizeForWindowsFolder(str) {
    if (!str) return "";
    return str
        .replace(/[\\/:*?"<>|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function openFolderModal() {
    const s = showData.find(ev => String(ev.id) === String(currentEventId));
    if (!s) return;
    const assign = assignments.find(a => String(a.id) === String(currentEventId)) || {};

    document.getElementById('foldCeremony').checked = true;
    document.getElementById('foldPhotos').checked = true;
    document.getElementById('foldReception').checked = true;

    const isGuestbook = !!(assign.guestbook || document.getElementById('checkGuestbook').checked);
    const isPhotoBooth = !!(assign.booth || document.getElementById('checkBooth').checked || assign.prints || document.getElementById('checkPrints').checked || assign.double_prints || document.getElementById('checkDoublePrints').checked);

    document.getElementById('foldGuestbook').checked = isGuestbook;
    document.getElementById('foldPhotoBoothPics').checked = isPhotoBooth;

    const dateParts = s.date.split('-');
    const mmDd = (dateParts.length === 3) ? `${dateParts[1]}.${dateParts[2]}` : "00.00";
    const cleanNameAllCaps = sanitizeForWindowsFolder(stripEmoji(s.client)).toUpperCase();
    const formattedFolderName = `${mmDd} - ${cleanNameAllCaps}`;

    document.getElementById('batFolderName').value = formattedFolderName;
    document.getElementById('folderModalSub').innerText = `Folder: ${formattedFolderName}`;

    updateBatPreview();
    document.getElementById('folderModal').style.display = 'block';
}

function getSelectedSubfolders() {
    const subs = [];
    if (document.getElementById('foldGuestbook').checked) subs.push("AUDIO GUESTBOOK FILES");
    if (document.getElementById('foldCeremony').checked) subs.push("CEREMONY MUSIC");
    if (document.getElementById('foldPhotos').checked) subs.push("ON SITE PHOTOS");
    if (document.getElementById('foldPhotoBoothPics').checked) subs.push("PHOTO BOOTH PICS");
    if (document.getElementById('foldReception').checked) subs.push("RECEPTION MUSIC");
    return subs;
}

function generateBatScriptString() {
    const rootPath = document.getElementById('batRootPath').value.trim().replace(/[\\/]+$/, '');
    const folderName = document.getElementById('batFolderName').value.trim();
    const selectedSubs = getSelectedSubfolders();
    const fullDirPath = `${rootPath}\\${folderName}`;

    let script = `@echo off\r\n`;
    script += `:: ==========================================\r\n`;
    script += `:: Fun Squad DJs - Wedding Folder Generator\r\n`;
    script += `:: Event: ${folderName}\r\n`;
    script += `:: ==========================================\r\n\r\n`;
    script += `set "TARGET_DIR=${fullDirPath}"\r\n\r\n`;
    script += `echo [FUN SQUAD DJs] Creating Wedding Directory Structure...\r\n`;
    script += `echo Target: "%TARGET_DIR%"\r\n`;
    script += `echo.\r\n\r\n`;
    script += `if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"\r\n`;

    selectedSubs.forEach(sub => {
        script += `if not exist "%TARGET_DIR%\\${sub}" mkdir "%TARGET_DIR%\\${sub}"\r\n`;
    });

    script += `\r\n`;
    script += `echo.\r\n`;
    script += `echo ==========================================\r\n`;
    script += `echo  All folders verified and created!\r\n`;
    script += `echo ==========================================\r\n`;
    script += `echo Opening folder in Windows Explorer...\r\n`;
    script += `explorer.exe "%TARGET_DIR%"\r\n`;

    return script;
}

function getOneLineRunCommand() {
    const rootPath = document.getElementById('batRootPath').value.trim().replace(/[\\/]+$/, '');
    const folderName = document.getElementById('batFolderName').value.trim();
    const selectedSubs = getSelectedSubfolders();
    const fullDirPath = `${rootPath}\\${folderName}`;

    const pathsToCreate = selectedSubs.map(s => `"${fullDirPath}\\${s}"`).join(' ');
    return `cmd /c (md "${fullDirPath}" ${pathsToCreate}) 2>nul & explorer "${fullDirPath}"`;
}

function updateBatPreview() {
    const script = generateBatScriptString();
    const previewBox = document.getElementById('batPreviewBox');
    if (previewBox) previewBox.innerText = script;
}

function downloadBatFile() {
    const scriptContent = generateBatScriptString();
    const folderName = document.getElementById('batFolderName').value.trim();
    const safeFileName = sanitizeForWindowsFolder(folderName) || "Create-Wedding-Folders";
    
    const blob = new Blob([scriptContent], { type: 'application/x-bat;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Create-Folders-${safeFileName}.bat`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

function copyBatScript() {
    const scriptContent = generateBatScriptString();
    copyTextHelper(scriptContent, "Batch script copied to clipboard!");
}

function copyRunCommand() {
    const oneLiner = getOneLineRunCommand();
    copyTextHelper(oneLiner, "Win+R command copied! Press Win+R, paste, and hit Enter.");
}

function copyTextHelper(text, successMsg) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        const previewBox = document.getElementById('batPreviewBox');
        if (previewBox) {
            previewBox.style.borderColor = '#22c55e';
            setTimeout(() => { previewBox.style.borderColor = '#334155'; }, 1000);
        }
        alert(successMsg);
    } catch (e) {
        alert("Please copy text manually from preview box.");
    }
    document.body.removeChild(textArea);
}
