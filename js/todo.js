// ==========================================
// TO-DO SIDE PANEL & MILESTONE ENGINE
// ==========================================

function toggleTodoPanel() {
    document.getElementById('todoPanel').classList.toggle('open');
}

function renderTodoPanel() {
    const listContainer = document.getElementById('todoContentList');
    const manualSelect = document.getElementById('manualTodoEventSelect');
    if (!listContainer || !manualSelect) return;

    listContainer.innerHTML = '';
    manualSelect.innerHTML = '<option value="">-- Select Event for Manual Task --</option>';

    const now = new Date();
    now.setHours(0,0,0,0);

    let todoItems = [];

    showData.forEach(s => {
        manualSelect.innerHTML += `<option value="${s.id}">#${s.id} - ${s.client}</option>`;

        const showDate = new Date(s.date + "T00:00:00");
        const diffDays = Math.ceil((showDate - now) / (1000 * 60 * 60 * 24));

        const assign = assignments.find(a => String(a.id) === String(s.id)) || {};
        const completed = assign.completed_tasks || [];
        const customTasks = assign.custom_tasks || [];

        // 1. Check 20-Day Milestone Trigger
        if (diffDays <= 20 && diffDays >= 0) {
            const taskId = `task_20d_${s.id}`;
            if (!completed.includes(taskId)) {
                todoItems.push({
                    id: taskId,
                    eventId: s.id,
                    client: s.client,
                    daysLeft: diffDays,
                    type: 'milestone-20',
                    title: '📧 20-Day Planner Link Email',
                    desc: 'Send initial set-up confirmation email & request planner link details.'
                });
            }
        }

        // 2. Check 10-Day Milestone Trigger
        if (diffDays <= 10 && diffDays >= 0) {
            const taskId = `task_10d_${s.id}`;
            if (!completed.includes(taskId)) {
                todoItems.push({
                    id: taskId,
                    eventId: s.id,
                    client: s.client,
                    daysLeft: diffDays,
                    type: 'milestone-10',
                    title: '📄 10-Day Last-Minute PDF Email',
                    desc: 'Send client setup checklist PDF for last minute changes & timeline lock.'
                });
            }
        }

        // 3. Custom Manual Tasks
        customTasks.forEach((cTask, idx) => {
            const taskId = `task_custom_${s.id}_${idx}`;
            if (!completed.includes(taskId)) {
                todoItems.push({
                    id: taskId,
                    eventId: s.id,
                    client: s.client,
                    daysLeft: diffDays,
                    type: 'custom',
                    title: '📌 Custom Task',
                    desc: cTask
                });
            }
        });
    });

    if (todoItems.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; color:#95a5a6; padding:20px; font-weight:bold;">🎉 All caught up! No pending tasks!</div>`;
        return;
    }

    todoItems.sort((a,b) => a.daysLeft - b.daysLeft);

    todoItems.forEach(item => {
        listContainer.innerHTML += `
            <div class="todo-card ${item.type}">
                <div class="todo-title">
                    <span>${item.title}</span>
                    <span style="font-size:0.7rem; background:#34495e; color:white; padding:2px 6px; border-radius:10px;">${item.daysLeft}d away</span>
                </div>
                <div class="todo-sub"><b>#${item.eventId} ${item.client}</b></div>
                <div style="font-size:0.75rem; color:#555; margin-bottom:8px;">${item.desc}</div>
                <div class="todo-action">
                    <input type="checkbox" onchange="completeTodoTask('${item.eventId}', '${item.id}')">
                    <label>Mark Complete</label>
                </div>
            </div>
        `;
    });
}

function completeTodoTask(eventId, taskId) {
    let assign = assignments.find(a => String(a.id) === String(eventId));
    if (!assign) {
        assign = { id: String(eventId), completed_tasks: [] };
        assignments.push(assign);
    }
    if (!assign.completed_tasks) assign.completed_tasks = [];
    
    if (!assign.completed_tasks.includes(taskId)) {
        assign.completed_tasks.push(taskId);
    }

    try {
        localStorage.setItem('fs_dj_assignments', JSON.stringify(assignments));
    } catch(e) {}

    submitHiddenForm({
        action: 'assignDJ',
        id: String(eventId),
        primary: assign.primary || "",
        secondary: assign.secondary || "",
        price: assign.price || "",
        ceremony: !!assign.ceremony,
        reception: !!assign.reception,
        booth: !!assign.booth,
        prints: !!assign.prints,
        double_prints: !!assign.double_prints,
        guestbook: !!assign.guestbook,
        uplights: assign.uplights || "0",
        karaoke: !!assign.karaoke,
        venue_name: assign.venue_name || "",
        site_name: assign.site_name || "",
        venue_phone: assign.venue_phone || "",
        client_email: assign.client_email || "",
        completed_tasks: assign.completed_tasks,
        custom_tasks: assign.custom_tasks || []
    });

    renderTodoPanel();
    if (typeof currentEventId !== 'undefined' && currentEventId === String(eventId)) {
        renderEventModalTodoList(eventId);
    }
}

function addManualTodoItem() {
    const eventIdSelect = document.getElementById('manualTodoEventSelect');
    const taskInput = document.getElementById('manualTodoInput');
    if (!eventIdSelect || !taskInput) return;

    const eventId = eventIdSelect.value;
    const taskText = taskInput.value.trim();

    if (!eventId) return alert("Please select an event for this task.");
    if (!taskText) return alert("Please enter a task description.");

    let assign = assignments.find(a => String(a.id) === String(eventId));
    if (!assign) {
        assign = { id: String(eventId), custom_tasks: [] };
        assignments.push(assign);
    }
    if (!assign.custom_tasks) assign.custom_tasks = [];

    assign.custom_tasks.push(taskText);

    try {
        localStorage.setItem('fs_dj_assignments', JSON.stringify(assignments));
    } catch(e) {}

    submitHiddenForm({
        action: 'assignDJ',
        id: String(eventId),
        primary: assign.primary || "",
        secondary: assign.secondary || "",
        price: assign.price || "",
        ceremony: !!assign.ceremony,
        reception: !!assign.reception,
        booth: !!assign.booth,
        prints: !!assign.prints,
        double_prints: !!assign.double_prints,
        guestbook: !!assign.guestbook,
        uplights: assign.uplights || "0",
        karaoke: !!assign.karaoke,
        venue_name: assign.venue_name || "",
        site_name: assign.site_name || "",
        venue_phone: assign.venue_phone || "",
        client_email: assign.client_email || "",
        completed_tasks: assign.completed_tasks || [],
        custom_tasks: assign.custom_tasks
    });

    taskInput.value = '';
    renderTodoPanel();
    if (typeof currentEventId !== 'undefined' && currentEventId === String(eventId)) {
        renderEventModalTodoList(eventId);
    }
}

function renderEventModalTodoList(eventId) {
    const container = document.getElementById('eventModalTodoList');
    if (!container) return;
    container.innerHTML = '';

    const assign = assignments.find(a => String(a.id) === String(eventId)) || {};
    const completed = assign.completed_tasks || [];
    const customTasks = assign.custom_tasks || [];

    let html = '<ul style="padding-left:18px; margin:0; font-size:0.8rem; color:#444;">';
    
    if (completed.length === 0 && customTasks.length === 0) {
        container.innerHTML = `<div style="font-size:0.8rem; color:#95a5a6; font-style:italic;">No active or logged completed tasks for this event.</div>`;
        return;
    }

    completed.forEach(tId => {
        let label = tId;
        if (tId.includes('20d')) label = "20-Day Planner Link Email Sent";
        else if (tId.includes('10d')) label = "10-Day Requirement PDF Email Sent";
        html += `<li style="text-decoration: line-through; color:#27ae60; font-weight:bold;">${label} (Completed)</li>`;
    });

    customTasks.forEach((cTask, idx) => {
        const taskId = `task_custom_${eventId}_${idx}`;
        if (!completed.includes(taskId)) {
            html += `<li><b>Pending Custom Task:</b> ${cTask}</li>`;
        }
    });

    html += '</ul>';
    container.innerHTML = html;
}
