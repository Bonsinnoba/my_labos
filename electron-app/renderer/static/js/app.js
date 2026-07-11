// Centralized fetch wrapper with global error handling
console.log('app.js loaded v20');

/**
 * Wait for the Python backend to become available.
 * Polls /api/dashboard every 1 second for up to 20 seconds.
 * Resolves immediately once the server responds, or after the timeout.
 */
async function waitForBackend(maxWaitMs = 20000) {
    const fetchFn = window.electronAPI && window.electronAPI.apiFetch
        ? window.electronAPI.apiFetch
        : fetch;
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
        try {
            await fetchFn('/api/dashboard', { skipErrorAlert: true });
            console.log('[backend] Server is ready');
            return;
        } catch (e) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    console.warn('[backend] Server did not become ready within', maxWaitMs, 'ms');
}

async function apiFetch(url, options = {}) {
    const skipAlert = options.skipErrorAlert || false;
    const retries = (typeof options.retries === 'number') ? options.retries : 0;

    let attempt = 0;
    while (true) {
        try {
            // Use electronAPI.apiFetch if available (Electron context) to bypass CORS
            const fetchFn = window.electronAPI && window.electronAPI.apiFetch ? window.electronAPI.apiFetch : fetch;
            const response = await fetchFn(url, options);
            if (!response.ok) {
                let errorText = `HTTP Error ${response.status}: ${response.statusText}`;
                try {
                    const clonedResponse = response.clone();
                    const data = await clonedResponse.json();
                    if (data && data.detail) {
                        errorText = (typeof data.detail === 'string') ? data.detail : JSON.stringify(data.detail);
                    } else if (data && data.message) {
                        errorText = (typeof data.message === 'string') ? data.message : JSON.stringify(data.message);
                    }
                } catch (e) { }
                if (!skipAlert) showAlert(errorText, 'Error');
                // Tag as an HTTP error so the catch block won't double-alert
                const httpErr = new Error(errorText);
                httpErr._isHttpError = true;
                throw httpErr;
            }
            return response;
        } catch (err) {
            // Retry on network/connection errors (TypeError) if retries remain
            if (!err._isHttpError && attempt < retries) {
                attempt++;
                console.warn(`apiFetch: retrying [${url}] attempt ${attempt}/${retries}...`);
                await new Promise(r => setTimeout(r, 1000 * attempt));
                continue;
            }
            // Only alert for genuine network failures (TypeError), not HTTP errors above
            if (!skipAlert && err instanceof TypeError && !err._isHttpError) {
                showAlert('Cannot connect to the backend server. Please verify it is running.', 'Connection Error');
            }
            // Log full error object so we can see structured API error details
            console.error('apiFetch error [' + url + ']:', err);
            throw err;
        }
    }
}


// Escape HTML to avoid injection in generated innerHTML
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Renders LaTeX math equations inside a DOM element using KaTeX auto-render.
 * Supports both inline ($...$) and display ($$...$$) delimiters.
 * Safe to call even if KaTeX is not loaded.
 */
function renderMath(element) {
    if (!element || typeof renderMathInElement === 'undefined') return;
    try {
        renderMathInElement(element, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
                { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false,
            errorColor: 'var(--accent-red)'
        });
    } catch (e) {
        console.warn('KaTeX renderMath error:', e);
    }
}

/**
 * Parse markdown to HTML (using marked) then render math (using KaTeX).
 * Returns the HTML string.
 */
function parseMarkdownAndMath(rawText) {
    let html = rawText;
    if (typeof marked !== 'undefined') {
        html = marked.parse(rawText);
    } else {
        html = rawText.replace(/\n/g, '<br>');
    }
    return html;
}


function toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');

        // Prevent body scroll when sidebar is open
        if (sidebar.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }
}

// Navigation button click handler
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const page = btn.dataset.page;

        // Close mobile sidebar if open
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        if (sidebar && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
            document.body.style.overflow = '';
        }

        // Update active nav button
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update page title
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = btn.textContent.trim();

        // Show/hide pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(`${page}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
        }

        // Load page data
        switch (page) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'projects':
                loadProjects();
                break;
            case 'notebook':
                loadNotebook();
                break;
            case 'experiments':
                loadExperiments();
                break;
            case 'resources':
                loadDocuments();
                break;
            case 'findings':
                loadFindings();
                break;
            case 'toolbox':
                loadToolbox();
                break;
            case 'assets':
                initAssets();
                break;
            case 'finance':
                loadFinanceData('overview');
                break;
            case 'search':
                loadSearch();
                break;
        }
    });
});

// Dashboard
async function loadDashboard() {
    try {
        const response = await apiFetch('/api/dashboard');
        const data = await response.json();

        // Update welcome text with current date
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', options);

        // Update stat cards
        document.getElementById('stat-projects').textContent = data.active_projects.total_active;
        document.getElementById('stat-experiments').textContent = data.recent_experiments.total_recent;
        document.getElementById('stat-inventory').textContent = data.inventory_alerts.total_low_stock;
        document.getElementById('stat-findings').textContent = data.recent_findings.open_count;

        // Update dashboard cards
        updateDashboardCard('active-projects-list', data.active_projects.projects, 'name');
        updateDashboardCard('recent-experiments-list', data.recent_experiments.recent_logs, 'log_title');
        updateDashboardCard('recent-findings-list', data.recent_findings.recent_findings, 'title');
        updateDashboardCard('inventory-alerts-list', data.inventory_alerts.critical_components, 'name');
        // Equipment status card removed - skip update

        // AI Insights
        const aiInsights = document.getElementById('ai-insights-list');
        aiInsights.innerHTML = `
            <p style="color: var(--text-secondary); font-size: 13px;">
                <strong>Most Used Components:</strong> ${data.ai_insights.most_used_components.length}<br>
                <strong>Problem Findings:</strong> ${data.ai_insights.problem_findings_count}
            </p>
        `;

        // Load activities
        loadActivities();
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

async function refreshDashboardInBackground() {
    try {
        const response = await apiFetch('/api/dashboard');
        const data = await response.json();

        // Update stat cards
        const statProjects = document.getElementById('stat-projects');
        const statExperiments = document.getElementById('stat-experiments');
        const statInventory = document.getElementById('stat-inventory');
        const statFindings = document.getElementById('stat-findings');

        if (statProjects) statProjects.textContent = data.active_projects.total_active;
        if (statExperiments) statExperiments.textContent = data.recent_experiments.total_recent;
        if (statInventory) statInventory.textContent = data.inventory_alerts.total_low_stock;
        if (statFindings) statFindings.textContent = data.recent_findings.open_count;

        // Update dashboard cards if visible
        updateDashboardCard('active-projects-list', data.active_projects.projects, 'name');
        updateDashboardCard('recent-experiments-list', data.recent_experiments.recent_logs, 'log_title');
        updateDashboardCard('recent-findings-list', data.recent_findings.recent_findings, 'title');
        updateDashboardCard('inventory-alerts-list', data.inventory_alerts.critical_components, 'name');
        updateDashboardCard('equipment-status-list', data.equipment_status.calibration_due, 'name');

        // Update AI Insights if visible
        const aiInsights = document.getElementById('ai-insights-list');
        if (aiInsights) {
            aiInsights.innerHTML = `
                <p style="color: var(--text-secondary); font-size: 13px;">
                    <strong>Most Used Components:</strong> ${data.ai_insights.most_used_components.length}<br>
                    <strong>Problem Findings:</strong> ${data.ai_insights.problem_findings_count}
                </p>
            `;
        }

        // Refresh activity timeline
        loadActivities();
    } catch (error) {
        console.error('Error refreshing dashboard in background:', error);
    }
}

function refreshCurrentPage() {
    // Refresh the current page content based on which page is active
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;

    const pageId = activePage.id;

    switch (pageId) {
        case 'dashboard-page':
            loadDashboard();
            break;
        case 'resources-page':
            loadDocuments();
            break;
        case 'notebook-page':
            loadNotebookEntries();
            break;
        case 'projects-page':
            loadProjects();
            break;
        case 'experiments-page':
            loadExperiments();
            break;
        case 'findings-page':
            loadFindings();
            break;
        case 'assets-page':
            loadAssets();
            break;
        default:
            console.log('No refresh handler for page:', pageId);
    }
}

function updateDashboardCard(elementId, items, titleField) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`Dashboard element ${elementId} not found, skipping update`);
        return;
    }
    if (!items || items.length === 0) {
        element.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">No data</p>';
    } else {
        element.innerHTML = items.slice(0, 5).map(item => `
            <div style="padding: 8px 0; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-secondary);">
                ${item[titleField] || 'Untitled'}
            </div>
        `).join('');
    }
}

async function loadActivities() {
    try {
        const response = await apiFetch('/api/activities?limit=20');
        const data = await response.json();
        const activities = data.activities || [];

        const timeline = document.getElementById('activity-timeline');
        if (activities.length === 0) {
            timeline.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No recent activity</div>';
        } else {
            const initialCount = 6;
            const showMore = activities.length > initialCount;
            const displayActivities = showMore ? activities.slice(0, initialCount) : activities;

            timeline.innerHTML = `<div class="activity-timeline">
                ${displayActivities.map(activity => {
                const icon = getActivityIcon(activity.action, activity.entity_type);
                return `
                        <div class="activity-item">
                            <div class="activity-icon">${icon}</div>
                            <div class="activity-content">
                                <div class="activity-action">${formatAction(activity.action)} ${activity.entity_type}</div>
                                <div class="activity-entity">${activity.entity_name || 'Unknown'}</div>
                                <div class="activity-time">${formatTimestamp(activity.timestamp)}</div>
                            </div>
                        </div>
                    `;
            }).join('')}
            </div>
            ${showMore ? `<button class="btn btn-secondary" onclick="showAllActivities()" style="width: 100%; margin-top: 12px;">Show More (${activities.length - initialCount} more)</button>` : ''}`;

            // Store all activities for the show more function
            window.allActivities = activities;
        }
    } catch (error) {
        console.error('Error loading activities:', error);
    }
}

function showAllActivities() {
    const timeline = document.getElementById('activity-timeline');
    const activities = window.allActivities || [];

    timeline.innerHTML = `<div class="activity-timeline">
        ${activities.map(activity => {
        const icon = getActivityIcon(activity.action, activity.entity_type);
        return `
                <div class="activity-item">
                    <div class="activity-icon">${icon}</div>
                    <div class="activity-content">
                        <div class="activity-action">${formatAction(activity.action)} ${activity.entity_type}</div>
                        <div class="activity-entity">${activity.entity_name || 'Unknown'}</div>
                        <div class="activity-time">${formatTimestamp(activity.timestamp)}</div>
                    </div>
                </div>
            `;
    }).join('')}
    </div>`;
}

function getActivityIcon(action, entityType) {
    if (action === 'created') return '➕';
    if (action === 'updated') return '✏️';
    if (action === 'deleted') return '🗑️';
    return '📝';
}

function formatAction(action) {
    return action.charAt(0).toUpperCase() + action.slice(1);
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return date.toLocaleDateString();
}

// Projects
async function loadProjects() {
    try {
        const response = await apiFetch('/api/projects');
        const data = await response.json();

        const list = document.getElementById('projects-list');
        if (data.projects.length === 0) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No projects yet</div>';
        } else {
            list.innerHTML = data.projects.map(project => `
                <div class="content-item" onclick="openProjectWorkspace(${project.id})" style="cursor: pointer;">
                    <div>
                        <div class="title">${project.name}</div>
                        <div class="description">${project.description || 'No description'}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="status-dot ${project.status === 'Active' ? 'green' : 'yellow'}"></span>
                        <button class="btn btn-sm ${project.status === 'Active' ? 'btn-warning' : 'btn-success'}" onclick="event.stopPropagation(); ${project.status === 'Active' ? `pauseProject(${project.id})` : `resumeProject(${project.id})`}">${project.status === 'Active' ? 'Pause' : 'Resume'}</button>
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); deleteProject(${project.id})">🗑️</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

async function addProject() {
    const result = await showMultiField([
        { name: 'name', label: 'Project Name', type: 'text', placeholder: 'Enter project name...' },
        { name: 'description', label: 'Description', type: 'textarea', rows: 3, placeholder: 'Enter description...' }
    ], 'Add Project', 'Enter project details:');

    if (!result || !result.name) return;

    const { name, description } = result;

    try {
        const response = await apiFetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
        });

        if (response.ok) {
            loadProjects();
            refreshDashboardInBackground();
            showAlert('Project added successfully', 'Success');
        } else {
            showAlert('Error adding project', 'Error');
        }
    } catch (error) {
        console.error('Error adding project:', error);
    }
}

async function pauseProject(projectId) {
    try {
        const response = await apiFetch(`/api/projects/${projectId}/pause`, {
            method: 'PUT'
        });
        if (response.ok) {
            loadProjects();
            refreshDashboardInBackground();
            showAlert('Project paused', 'Success');
        } else {
            showAlert('Error pausing project', 'Error');
        }
    } catch (error) {
        console.error('Error pausing project:', error);
    }
}

async function resumeProject(projectId) {
    try {
        const response = await apiFetch(`/api/projects/${projectId}/resume`, {
            method: 'PUT'
        });
        if (response.ok) {
            loadProjects();
            refreshDashboardInBackground();
            showAlert('Project resumed', 'Success');
        } else {
            showAlert('Error resuming project', 'Error');
        }
    } catch (error) {
        console.error('Error resuming project:', error);
    }
}

async function deleteProject(projectId) {
    if (!(await showConfirm('Delete this project? This will also delete all associated data.'))) return;

    try {
        const response = await apiFetch(`/api/projects/${projectId}`, { method: 'DELETE' });
        if (response.ok) {
            loadProjects();
            refreshDashboardInBackground();
            refreshCurrentPage();
            showAlert('Project deleted successfully', 'Success');
        } else {
            showAlert('Failed to delete project', 'Error');
        }
    } catch (error) {
        console.error('Error deleting project:', error);
        showAlert('Error deleting project', 'Error');
    }
}

async function pauseExperiment(experimentId) {
    try {
        const response = await apiFetch(`/api/logs/${experimentId}/pause`, {
            method: 'PUT'
        });
        if (response.ok) {
            loadExperiments();
            refreshDashboardInBackground();
            showAlert('Experiment paused', 'Success');
        } else {
            showAlert('Error pausing experiment', 'Error');
        }
    } catch (error) {
        console.error('Error pausing experiment:', error);
    }
}

async function resumeExperiment(experimentId) {
    try {
        const response = await apiFetch(`/api/logs/${experimentId}/resume`, {
            method: 'PUT'
        });
        if (response.ok) {
            loadExperiments();
            refreshDashboardInBackground();
            showAlert('Experiment resumed', 'Success');
        } else {
            showAlert('Error resuming experiment', 'Error');
        }
    } catch (error) {
        console.error('Error resuming experiment:', error);
    }
}

async function deleteExperiment(experimentId, event) {
    if (event) event.stopPropagation();
    if (!(await showConfirm('Delete this experiment?'))) return;

    try {
        const response = await apiFetch(`/api/logs/${experimentId}`, { method: 'DELETE' });
        if (response.ok) {
            loadExperiments();
            refreshDashboardInBackground();
            refreshCurrentPage();
            showAlert('Experiment deleted successfully', 'Success');
        } else {
            showAlert('Failed to delete experiment', 'Error');
        }
    } catch (error) {
        console.error('Error deleting experiment:', error);
        showAlert('Error deleting experiment', 'Error');
    }
}

async function saveExperimentFindings(experimentId, event) {
    if (event) event.stopPropagation();

    const actualOutcome = document.getElementById(`experiment-outcome-${experimentId}`).value;
    const findings = document.getElementById(`experiment-findings-${experimentId}`).value;

    try {
        const response = await apiFetch(`/api/logs/${experimentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                actual_outcome: actualOutcome,
                findings: findings
            })
        });

        if (response.ok) {
            showAlert('Outcome and findings saved successfully', 'Success');
            loadExperiments();
        } else {
            showAlert('Failed to save outcome and findings', 'Error');
        }
    } catch (error) {
        console.error('Error saving experiment findings:', error);
        showAlert('Error saving outcome and findings', 'Error');
    }
}

function renderExperimentAttachments(attachmentsJson, experimentId, type) {
    if (!attachmentsJson) return '';
    try {
        const attachments = JSON.parse(attachmentsJson);
        if (!attachments || attachments.length === 0) return '';

        return attachments.map(att => {
            const isImage = att.type === 'image';
            const isVideo = att.type === 'video';
            const thumbHtml = isImage ? `<img src="http://127.0.0.1:8000/api/documents/${att.id}/view" class="attachment-thumb">` : '';
            const icon = isVideo ? '🎬' : (att.type === 'note' ? '📓' : '📄');

            return `<span class="attachment-badge" title="${escapeHtml(String(att.title))}" onclick="event.stopPropagation(); viewAttachment(${att.id}, '${att.type}')">${thumbHtml}<span class="attachment-title">${icon} ${escapeHtml(String(att.title))}</span><button class="attachment-remove" onclick="event.stopPropagation(); removeExperimentAttachment(${experimentId}, '${type}', ${att.id})">✖</button></span>`;
        }).join(' ');
    } catch (e) {
        console.error('Error parsing attachments:', e);
        return '';
    }
}

async function linkNoteToExperiment(experimentId, type) {
    try {
        const response = await apiFetch('/api/notebook');
        const data = await response.json();
        const notes = data.entries || [];

        if (notes.length === 0) {
            showAlert('No notes available to link', 'Info');
            return;
        }

        const options = notes.map(note => ({ value: note.id, label: note.title }));
        const selected = await showSelect('Select a note to link', options, 'Link Note');
        if (!selected) return;

        const note = notes.find(n => n.id === selected);
        if (!note) return;

        await addExperimentAttachment(experimentId, type, {
            id: note.id,
            type: 'note',
            title: note.title
        });
    } catch (error) {
        console.error('Error linking note:', error);
        showAlert('Error linking note', 'Error');
    }
}

async function attachDocumentToExperiment(experimentId, type) {
    try {
        const response = await apiFetch('/api/documents');
        const data = await response.json();
        const documents = data.documents || [];

        if (documents.length === 0) {
            showAlert('No documents available to attach', 'Info');
            return;
        }

        const options = documents.map(doc => ({ value: doc.id, label: doc.title || doc.filename }));
        const selected = await showSelect('Select a document to attach', options, 'Attach Document');
        if (!selected) return;

        const doc = documents.find(d => d.id === selected);
        if (!doc) return;

        const isImage = doc.mime_type && doc.mime_type.startsWith('image/');
        const isVideo = doc.mime_type && doc.mime_type.startsWith('video/');

        await addExperimentAttachment(experimentId, type, {
            id: doc.id,
            type: isImage ? 'image' : (isVideo ? 'video' : 'document'),
            title: doc.title || doc.filename
        });
    } catch (error) {
        console.error('Error attaching document:', error);
        showAlert('Error attaching document', 'Error');
    }
}

async function uploadMediaToExperiment(experimentId, type) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('title', file.name);

            const response = await apiFetch('http://127.0.0.1:8000/api/documents', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                showAlert('Error uploading file', 'Error');
                return;
            }

            const data = await response.json();
            const docId = data.data.id;

            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');

            await addExperimentAttachment(experimentId, type, {
                id: docId,
                type: isImage ? 'image' : (isVideo ? 'video' : 'document'),
                title: file.name
            });
        } catch (error) {
            console.error('Error uploading media:', error);
            showAlert('Error uploading media', 'Error');
        }
    };
    input.click();
}

async function addExperimentAttachment(experimentId, type, attachment) {
    try {
        const response = await apiFetch(`/api/logs/${experimentId}`);
        const data = await response.json();
        const log = data.data;

        const attachmentsField = type === 'outcome' ? 'outcome_attachments' : 'findings_attachments';
        let attachments = [];

        if (log[attachmentsField]) {
            try {
                attachments = JSON.parse(log[attachmentsField]);
            } catch (e) {
                attachments = [];
            }
        }

        attachments.push(attachment);

        const updateResponse = await apiFetch(`/api/logs/${experimentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                [attachmentsField]: JSON.stringify(attachments)
            })
        });

        if (updateResponse.ok) {
            showAlert('Attachment added successfully', 'Success');
            loadExperiments();
        } else {
            showAlert('Failed to add attachment', 'Error');
        }
    } catch (error) {
        console.error('Error adding attachment:', error);
        showAlert('Error adding attachment', 'Error');
    }
}

async function removeExperimentAttachment(experimentId, type, attachmentId) {
    try {
        const response = await apiFetch(`/api/logs/${experimentId}`);
        const data = await response.json();
        const log = data.data;

        const attachmentsField = type === 'outcome' ? 'outcome_attachments' : 'findings_attachments';
        let attachments = [];

        if (log[attachmentsField]) {
            try {
                attachments = JSON.parse(log[attachmentsField]);
            } catch (e) {
                attachments = [];
            }
        }

        attachments = attachments.filter(att => att.id !== attachmentId);

        const updateResponse = await apiFetch(`/api/logs/${experimentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                [attachmentsField]: JSON.stringify(attachments)
            })
        });

        if (updateResponse.ok) {
            showAlert('Attachment removed successfully', 'Success');
            loadExperiments();
        } else {
            showAlert('Failed to remove attachment', 'Error');
        }
    } catch (error) {
        console.error('Error removing attachment:', error);
        showAlert('Error removing attachment', 'Error');
    }
}

async function viewAttachment(id, type) {
    if (type === 'note') {
        window.location.href = `#notebook`;
        // Could add logic to highlight the specific note
    } else {
        window.open(`http://127.0.0.1:8000/api/documents/${id}/view`, '_blank');
    }
}

// Project Workspace
let currentProjectId = null;
let currentExperimentId = null;

async function openProjectWorkspace(projectId) {
    currentProjectId = projectId;

    try {
        const response = await apiFetch(`/api/projects/${projectId}`);
        const data = await response.json();
        const project = data.data;

        if (project) {
            document.getElementById('project-workspace-title').textContent = project.name;
            document.getElementById('project-workspace-status').textContent = project.status || 'Active';

            // Show project workspace page
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('project-workspace-page').classList.add('active');

            // Load project data
            loadProjectData(projectId);
        }
    } catch (error) {
        console.error('Error loading project:', error);
    }
}

function closeProjectWorkspace() {
    currentProjectId = null;
    // TODO: Navigate to projects page
}

async function openExperimentWorkspace(experimentId) {
    currentExperimentId = experimentId;

    // Reset stage details view to list view by default
    const stageDetailsView = document.getElementById('stage-details-view');
    const stagesListView = document.getElementById('stages-list-view');
    if (stageDetailsView) stageDetailsView.style.display = 'none';
    if (stagesListView) stagesListView.style.display = 'block';
    currentStageId = null;

    try {
        const response = await apiFetch(`/api/logs/${experimentId}`);
        const data = await response.json();
        const experiment = data.data;

        if (experiment) {
            document.getElementById('experiment-workspace-title').textContent = experiment.log_title || 'Experiment';
            document.getElementById('experiment-workspace-status').textContent = experiment.status || 'Active';

            // Update lab assistant context
            const contextValue = document.getElementById('experiment-lab-assistant-context-value');
            if (contextValue) {
                contextValue.textContent = `Experiment: ${experiment.log_title}`;
            }

            // Enable stage review button
            const stageReviewBtn = document.getElementById('experiment-ai-stage-review-btn');
            if (stageReviewBtn) {
                stageReviewBtn.disabled = false;
            }

            // Show experiment workspace page
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('experiment-workspace-page').classList.add('active');

            // Load experiment data
            loadExperimentData(experimentId);
        }
    } catch (error) {
        console.error('Error loading experiment:', error);
    }
}

function closeExperimentWorkspace() {
    currentExperimentId = null;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('experiments-page').classList.add('active');
    loadExperiments();
}

function toggleExperimentLabAssistantPanel() {
    const panel = document.getElementById('experiment-lab-assistant-panel');
    if (panel) {
        panel.classList.toggle('collapsed');
    }
}

async function runExperimentStageReview() {
    if (!currentExperimentId) return;

    const output = document.getElementById('experiment-lab-assistant-output');
    output.innerHTML = '<div class="ai-loading">Analyzing stage/experiment design...</div>';

    try {
        let stageContext = {};
        if (currentStageId && window.currentExperimentStages) {
            const stage = window.currentExperimentStages.find(s => s.id === currentStageId);
            if (stage) {
                const findingsList = Array.from(document.querySelectorAll('#stage-findings-list .content-item .title')).map(el => el.textContent.trim());
                const documentsList = Array.from(document.querySelectorAll('#stage-documents-list .content-item .title')).map(el => el.textContent.trim());

                stageContext = {
                    stage_name: stage.stage_name,
                    status: stage.status || 'not_started',
                    notes: stage.notes || '',
                    start_time: stage.start_time || '',
                    end_time: stage.end_time || '',
                    experiment_title: document.getElementById('experiment-workspace-title').textContent,
                    findings: findingsList.join(', '),
                    documents: documentsList.join(', ')
                };
            }
        } else if (window.currentExperimentStages && window.currentExperimentStages.length > 0) {
            const stage = window.currentExperimentStages[0];
            stageContext = {
                stage_name: stage.stage_name,
                status: stage.status || 'not_started',
                notes: stage.notes || '',
                start_time: stage.start_time || '',
                end_time: stage.end_time || '',
                experiment_title: document.getElementById('experiment-workspace-title').textContent
            };
        } else {
            stageContext = {
                stage_name: 'Initial Phase',
                status: 'active',
                notes: 'Experiment review initiated.',
                experiment_title: document.getElementById('experiment-workspace-title').textContent
            };
        }

        const response = await fetch('/api/ai/stage-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stage_context: stageContext })
        });

        if (!response.ok) throw new Error('Failed to get AI response');

        output.innerHTML = '<div class="ai-response-text"></div>';
        const responseText = output.querySelector('.ai-response-text');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            responseText.textContent += chunk;
            output.scrollTop = output.scrollHeight;
        }
    } catch (error) {
        output.innerHTML = `<div class="ai-response-text" style="color: var(--accent-red);">Error: ${error.message}</div>`;
        showAlert('Failed to run stage review', 'Error');
    }
}

async function showExperimentAlternatesModal() {
    if (!currentExperimentId) return;

    showModal({
        type: 'prompt',
        title: 'Find Component Alternates',
        message: 'Enter component details (name, specifications, package type):',
        callback: async (value) => {
            if (!value) return;

            const output = document.getElementById('experiment-lab-assistant-output');
            output.innerHTML = '<div class="ai-loading">Finding alternatives...</div>';

            try {
                const response = await fetch('/api/ai/find-alternates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ component_details: value })
                });

                if (!response.ok) throw new Error('Failed to get AI response');

                output.innerHTML = '<div class="ai-response-text"></div>';
                const responseText = output.querySelector('.ai-response-text');

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    responseText.textContent += chunk;
                    output.scrollTop = output.scrollHeight;
                }
            } catch (error) {
                output.innerHTML = `<div class="ai-response-text" style="color: var(--accent-red);">Error: ${error.message}</div>`;
                showAlert('Failed to find alternates', 'Error');
            }
        }
    });
}

async function showExperimentFailureDiagnosisModal() {
    if (!currentExperimentId) return;

    showModal({
        type: 'multi',
        title: 'Diagnose Circuit Failure',
        message: 'Enter failure observation:',
        fields: [
            { name: 'observation', label: 'Failure Observation', type: 'textarea', defaultValue: '', rows: 3 }
        ],
        callback: async (values) => {
            if (!values || !values.observation) return;

            const output = document.getElementById('experiment-lab-assistant-output');
            output.innerHTML = '<div class="ai-loading">Analyzing failure...</div>';

            try {
                let experimentHistory = [];
                try {
                    const logsResponse = await apiFetch('/api/logs?limit=10&offset=0');
                    if (logsResponse && logsResponse.data) {
                        experimentHistory = logsResponse.data.map(log => ({
                            experiment_title: log.title || log.log_title || '',
                            experiment_outcome: log.outcome || '',
                            experiment_details: log.details || log.description || '',
                            stage_name: log.stage_name || '',
                            stage_goals: log.stage_goals || '',
                            status: log.status || ''
                        }));
                    }
                } catch (e) {
                    console.warn('Failed to fetch experiment history:', e);
                }

                const response = await fetch('/api/ai/diagnose-failure', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        observation: values.observation,
                        experiment_history: experimentHistory
                    })
                });

                if (!response.ok) throw new Error('Failed to get AI response');

                output.innerHTML = '<div class="ai-response-text"></div>';
                const responseText = output.querySelector('.ai-response-text');

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    responseText.textContent += chunk;
                    output.scrollTop = output.scrollHeight;
                }
            } catch (error) {
                output.innerHTML = `<div class="ai-response-text" style="color: var(--accent-red);">Error: ${error.message}</div>`;
                showAlert('Failed to diagnose failure', 'Error');
            }
        }
    });
}

async function showExperimentScriptGenerationModal() {
    if (!currentExperimentId) return;

    showModal({
        type: 'multi',
        title: 'Generate Test Script',
        message: 'Enter test requirements:',
        fields: [
            { name: 'requirement', label: 'Test Requirement', type: 'textarea', defaultValue: '', rows: 3 },
            {
                name: 'language', label: 'Language', type: 'select', options: [
                    { value: 'python', label: 'Python' },
                    { value: 'cpp', label: 'C++' },
                    { value: 'arduino', label: 'Arduino' }
                ], defaultValue: 'python'
            }
        ],
        callback: async (values) => {
            if (!values || !values.requirement) return;

            const output = document.getElementById('experiment-lab-assistant-output');
            output.innerHTML = '<div class="ai-loading">Generating script...</div>';

            try {
                const response = await fetch('/api/ai/generate-script', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requirement: values.requirement,
                        language: values.language
                    })
                });

                if (!response.ok) throw new Error('Failed to get AI response');

                output.innerHTML = '<div class="ai-response-text"></div>';
                const responseText = output.querySelector('.ai-response-text');

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    responseText.textContent += chunk;
                    output.scrollTop = output.scrollHeight;
                }
            } catch (error) {
                output.innerHTML = `<div class="ai-response-text" style="color: var(--accent-red);">Error: ${error.message}</div>`;
                showAlert('Failed to generate script', 'Error');
            }
        }
    });
}


async function loadExperimentData(experimentId) {
    // Load experiment-specific data for each tab
    loadExperimentOverview(experimentId);
    loadExperimentStagesList(experimentId);
    loadExperimentUsageList(experimentId);
}

async function loadExperimentOverview(experimentId) {
    try {
        const response = await apiFetch(`/api/logs/${experimentId}`);
        const data = await response.json();
        const experiment = data.data;

        const overview = document.getElementById('experiment-overview-content');
        if (experiment) {
            const overviewHtml = `
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <p style="color: var(--text-secondary); margin: 0;"><strong>Description:</strong> ${experiment.log_text || 'No description'}</p>
                    ${experiment.expected_outcome ? `<p style="color: var(--text-secondary); margin: 0;"><strong>Expected Outcome:</strong> ${experiment.expected_outcome}</p>` : ''}
                    <p style="color: var(--text-secondary); margin: 0;"><strong>Status:</strong> ${experiment.status || 'Active'}</p>
                    
                    <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
                        <span style="color: var(--text-secondary);"><strong>Outcome Status:</strong></span>
                        <div style="display: flex; gap: 6px;">
                            <button class="btn btn-sm ${experiment.outcome === 'PENDING' ? 'btn-primary' : 'btn-secondary'}" onclick="updateExperimentOutcome(${experiment.id}, 'PENDING', event)">Pending</button>
                            <button class="btn btn-sm ${experiment.outcome === 'PASS' ? 'btn-success' : 'btn-secondary'}" onclick="updateExperimentOutcome(${experiment.id}, 'PASS', event)">Pass</button>
                            <button class="btn btn-sm ${experiment.outcome === 'FAIL' ? 'btn-danger' : 'btn-secondary'}" onclick="updateExperimentOutcome(${experiment.id}, 'FAIL', event)">Fail</button>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px;">
                        <label for="experiment-actual-outcome-input" style="font-weight: 600; color: var(--text-secondary);">Actual Outcome Details:</label>
                        <textarea id="experiment-actual-outcome-input" class="search-input" style="width: 100%; height: 60px; resize: vertical; padding: 8px;" placeholder="Describe the actual outcome...">${experiment.actual_outcome || ''}</textarea>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px;">
                        <label for="experiment-conclusion-input" style="font-weight: 600; color: var(--text-secondary);">Conclusion / Narrative Synthesis:</label>
                        <textarea id="experiment-conclusion-input" class="search-input" style="width: 100%; height: 80px; resize: vertical; padding: 8px;" placeholder="Add final experiment conclusion...">${experiment.conclusion || ''}</textarea>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                        <p style="color: var(--text-muted); font-size: 12px; margin: 0;"><strong>Created:</strong> ${experiment.timestamp || 'Unknown'}</p>
                        <button class="btn btn-sm btn-primary" onclick="saveExperimentOutcomes(${experiment.id})">Save Outcomes & Conclusion</button>
                    </div>
                </div>
            `;
            overview.innerHTML = overviewHtml;

            // Load timeline into the experiment timeline area
            setTimeout(() => {
                loadExperimentTimeline(experimentId, 'experiment-timeline-list');
                loadExperimentUsageSummary(experimentId);
            }, 0);
        }
    } catch (error) {
        console.error('Error loading experiment overview:', error);
    }
}

async function saveExperimentOutcomes(experimentId) {
    const actualOutcome = document.getElementById('experiment-actual-outcome-input').value;
    const conclusion = document.getElementById('experiment-conclusion-input').value;

    try {
        const response = await apiFetch(`/api/logs/${experimentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                actual_outcome: actualOutcome,
                conclusion: conclusion
            })
        });

        if (response.ok) {
            showAlert('Experiment outcomes and conclusion saved successfully', 'Success');
            loadExperimentOverview(experimentId);
        } else {
            showAlert('Failed to save outcomes/conclusion', 'Error');
        }
    } catch (error) {
        console.error('Error saving experiment outcomes:', error);
    }
}

async function loadExperimentUsageSummary(experimentId) {
    try {
        const response = await apiFetch(`/api/experiments/${experimentId}/usage-summary`);
        const data = await response.json();
        const summary = data.data || [];

        const container = document.getElementById('experiment-usage-summary-content');
        if (!container) return;

        if (summary.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted); padding: 10px;">No resources used in this experiment yet</div>';
            return;
        }

        container.innerHTML = `
            <table class="inventory-table" style="width:100%; margin-top: 8px; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--border-color);">
                        <th style="text-align: left; padding: 8px;">Resource</th>
                        <th style="text-align: left; padding: 8px;">Type</th>
                        <th style="text-align: left; padding: 8px;">Total Quantity Used</th>
                        <th style="text-align: left; padding: 8px;">Last Used</th>
                    </tr>
                </thead>
                <tbody>
                    ${summary.map(item => `
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <td style="padding: 8px;"><strong>${item.name}</strong>${item.details ? ` (${item.details})` : ''}</td>
                            <td style="padding: 8px;"><span class="badge badge-info" style="font-size: 11px;">${item.entity_type.toUpperCase()}</span></td>
                            <td style="padding: 8px;">${item.total_quantity} ${item.unit || ''}</td>
                            <td style="padding: 8px;">${item.last_used || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading experiment usage summary:', error);
    }
}

async function loadExperimentTimeline(experimentId, containerId = 'experiment-timeline-list') {
    try {
        const list = document.getElementById(containerId);
        const controlsId = 'experiment-timeline-controls';
        let controls = document.getElementById(controlsId);
        if (!controls) {
            const container = document.getElementById('experiment-timeline-controls-holder') || document.createElement('div');
            container.id = 'experiment-timeline-controls-holder';
            container.style.marginBottom = '12px';
            const html = `
                <div id="${controlsId}" style="display:flex; gap:8px; margin-bottom:16px; align-items:center; flex-wrap:wrap">
                    <button class="btn btn-sm btn-primary" onclick="openManageExperimentStages(null, ${experimentId})">+ Add Stage</button>
                    <button class="btn btn-sm btn-secondary" onclick="openLogUsageForExperiment(${experimentId})">+ Log Usage</button>
                    <select id="experiment-timeline-filter-type" style="padding:6px 10px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-secondary); color:var(--text-primary)"><option value="">All Types</option><option value="stage">Stage</option><option value="usage">Usage</option></select>
                </div>
            `;
            container.innerHTML = html;
            if (list && list.parentNode) list.parentNode.insertBefore(container, list);
            controls = document.getElementById(controlsId);
            document.getElementById('experiment-timeline-filter-type').addEventListener('change', () => applyExperimentTimelineFilters(experimentId));
        }

        // Build a combined timeline from stages and usage logs for this experiment
        const [stResp, usageResp, docsResp] = await Promise.all([
            apiFetch(`/api/experiment_stages?experiment_id=${experimentId}&limit=200`),
            apiFetch(`/api/usage?experiment_id=${experimentId}&limit=200`),
            apiFetch('/api/documents').catch(() => null)
        ]);

        const stData = stResp ? await stResp.json() : { data: [] };
        const stages = (stData && stData.data) ? stData.data : [];

        const usageData = usageResp ? await usageResp.json() : { data: [] };
        const usages = (usageData && usageData.data) ? usageData.data : [];

        let docsById = {};
        if (docsResp) {
            try { const dd = await docsResp.json(); const docs = dd.documents || []; docs.forEach(d => { docsById[String(d.id)] = d; }); } catch (e) { docsById = {}; }
        }

        // Build timeline events
        const events = [];
        stages.forEach(s => {
            events.push({
                type: 'stage',
                id: s.id,
                timestamp: s.start_time || s.created_at || null,
                title: s.stage_name || 'Stage',
                subtitle: s.status || '',
                details: s.notes || '',
                owner: s.owner || '',
                attachments: s.attachments || null
            });
        });
        usages.forEach(u => {
            events.push({
                type: 'usage',
                id: u.id,
                timestamp: u.timestamp || u.created_at || null,
                title: `${u.entity_type || 'Item'} used`,
                subtitle: `${u.quantity_used || ''} ${u.unit || ''}`.trim(),
                details: u.notes || '',
                owner: u.user_id || '',
                stage_id: u.stage_id || null
            });
        });

        // Sort events by timestamp (oldest first)
        events.sort((a, b) => {
            const ta = a.timestamp || '';
            const tb = b.timestamp || '';
            if (!ta && !tb) return 0;
            if (!ta) return 1;
            if (!tb) return -1;
            return ta.localeCompare(tb);
        });

        if (events.length === 0) {
            list.innerHTML = '<div style="color:var(--text-muted)">No timeline events</div>';
            return;
        }

        list.innerHTML = events.map(ev => {
            if (ev.type === 'stage') {
                return `
                    <div class="timeline-item">
                        <div class="timeline-dot stage-dot"></div>
                        <div class="timeline-content">
                            <div style="font-weight:600">${ev.title} ${ev.subtitle ? `— ${ev.subtitle}` : ''}</div>
                            <div style="font-size:13px; color:var(--text-secondary)">${ev.timestamp || ''} ${ev.owner ? `— ${ev.owner}` : ''}</div>
                            <div style="margin-top:6px">${ev.details}</div>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="timeline-item">
                        <div class="timeline-dot usage-dot"></div>
                        <div class="timeline-content">
                            <div style="font-weight:600">${ev.title} ${ev.subtitle ? `— ${ev.subtitle}` : ''}</div>
                            <div style="font-size:13px; color:var(--text-secondary)">${ev.timestamp || ''}</div>
                            <div style="margin-top:6px">${ev.details}</div>
                        </div>
                    </div>
                `;
            }
        }).join('');
    } catch (error) {
        console.error('Error loading experiment timeline:', error);
    }
}

function applyExperimentTimelineFilters(experimentId) {
    const typeFilter = document.getElementById('experiment-timeline-filter-type').value;
    // Implement filtering logic similar to project timeline
    loadExperimentTimeline(experimentId, 'experiment-timeline-list');
}

async function loadExperimentStagesList(experimentId) {
    try {
        const response = await apiFetch(`/api/experiment_stages?experiment_id=${experimentId}&limit=200`);
        const data = await response.json();
        const stages = (data && data.data) ? data.data : [];
        window.currentExperimentStages = stages;

        const list = document.getElementById('experiment-stages-list');
        if (!stages || stages.length === 0) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No stages yet</div>';
        } else {
            list.innerHTML = stages.map(stage => `
                <div class="content-item stage-card" onclick="enterStageWorkspace(${stage.id})" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 8px; background: var(--bg-primary); transition: all 0.2s;">
                    <div>
                        <div class="title" style="font-weight: 600; font-size: 15px; color: var(--text-primary);">${stage.stage_name || 'Stage'}</div>
                        <div class="description" style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Status: <span class="badge ${stage.status === 'completed' ? 'badge-success' : stage.status === 'failed' ? 'badge-danger' : stage.status === 'in_progress' ? 'badge-warning' : 'badge-secondary'}">${stage.status || 'not_started'}</span></div>
                        ${stage.owner ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Owner: ${stage.owner}</div>` : ''}
                    </div>
                    <div style="display:flex; gap:8px;" onclick="event.stopPropagation();">
                        <button class="btn btn-sm btn-secondary" onclick="deleteExperimentStage(${stage.id}, ${experimentId})">🗑️</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading experiment stages:', error);
    }
}

async function loadExperimentUsageList(experimentId) {
    try {
        const response = await apiFetch(`/api/usage?experiment_id=${experimentId}&limit=200`);
        const data = await response.json();
        const usages = (data && data.data) ? data.data : [];

        const list = document.getElementById('experiment-usage-list');
        if (!usages || usages.length === 0) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No usage logs yet</div>';
        } else {
            list.innerHTML = usages.map(usage => `
                <div class="content-item">
                    <div>
                        <div class="title">${usage.entity_type || 'Item'}</div>
                        <div class="description">${usage.quantity_used || ''} ${usage.unit || ''}</div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-sm btn-secondary" onclick="deleteUsage(${usage.id})">🗑️</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading experiment usage:', error);
    }
}

async function deleteExperimentStage(stageId, experimentId) {
    if (!(await showConfirm('Delete this stage?'))) return;

    try {
        const response = await apiFetch(`/api/experiment_stages/${stageId}`, { method: 'DELETE' });
        if (response.ok) {
            showAlert('Stage deleted successfully', 'Success');
            loadExperimentStagesList(experimentId);
            loadExperimentTimeline(experimentId, 'experiment-timeline-list');
            refreshCurrentPage();
        } else {
            showAlert('Failed to delete stage', 'Error');
        }
    } catch (error) {
        console.error('Error deleting stage:', error);
        showAlert('Error deleting stage', 'Error');
    }
}

let currentStageId = null;

async function enterStageWorkspace(stageId) {
    currentStageId = stageId;
    const stage = window.currentExperimentStages.find(s => s.id === stageId);
    if (!stage) return;

    // Set UI details
    document.getElementById('stage-workspace-title').textContent = stage.stage_name || 'Stage';

    const statusBadge = document.getElementById('stage-workspace-status');
    statusBadge.textContent = stage.status || 'not_started';
    statusBadge.className = `project-status-badge ${stage.status || 'not_started'}`;

    document.getElementById('stage-status-select').value = stage.status || 'not_started';
    document.getElementById('stage-workspace-owner').textContent = stage.owner || 'None';
    document.getElementById('stage-workspace-notes').value = stage.notes || '';

    const startDate = stage.start_time ? new Date(stage.start_time).toLocaleDateString() : '';
    const endDate = stage.end_time ? new Date(stage.end_time).toLocaleDateString() : '';
    document.getElementById('stage-workspace-timeline-dates').textContent =
        startDate || endDate ? `${startDate} ${endDate ? 'to ' + endDate : ''}` : 'Not set';

    // Update lab assistant context
    const contextValue = document.getElementById('experiment-lab-assistant-context-value');
    if (contextValue) {
        contextValue.textContent = `Stage: ${stage.stage_name || 'Stage'}`;
    }

    // Switch views
    document.getElementById('stages-list-view').style.display = 'none';
    document.getElementById('stage-details-view').style.display = 'block';

    // Load findings and documents scoped to this stage
    loadStageFindings(stageId);
    loadStageDocuments(stageId);
}

function exitStageWorkspace() {
    currentStageId = null;
    document.getElementById('stage-details-view').style.display = 'none';
    document.getElementById('stages-list-view').style.display = 'block';

    // Revert lab assistant context to experiment
    if (currentExperimentId) {
        const titleEl = document.getElementById('experiment-workspace-title');
        const contextValue = document.getElementById('experiment-lab-assistant-context-value');
        if (contextValue && titleEl) {
            contextValue.textContent = `Experiment: ${titleEl.textContent}`;
        }
        loadExperimentStagesList(currentExperimentId);
    }
}

async function updateStageStatus() {
    if (!currentStageId) return;
    const status = document.getElementById('stage-status-select').value;
    try {
        const response = await apiFetch(`/api/experiment_stages/${currentStageId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (response.ok) {
            const statusBadge = document.getElementById('stage-workspace-status');
            statusBadge.textContent = status;
            statusBadge.className = `project-status-badge ${status}`;
            showAlert('Stage status updated successfully', 'Success');
            refreshCurrentPage();
            // Refresh stage record in current stages list
            if (window.currentExperimentStages) {
                const stage = window.currentExperimentStages.find(s => s.id === currentStageId);
                if (stage) stage.status = status;
            }
        } else {
            showAlert('Failed to update stage status', 'Error');
        }
    } catch (error) {
        console.error('Error updating stage status:', error);
    }
}

async function updateStageNotes() {
    if (!currentStageId) return;
    const notes = document.getElementById('stage-workspace-notes').value;
    try {
        const response = await apiFetch(`/api/experiment_stages/${currentStageId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes })
        });
        if (response.ok) {
            showAlert('Stage notes updated successfully', 'Success');
            refreshCurrentPage();
            if (window.currentExperimentStages) {
                const stage = window.currentExperimentStages.find(s => s.id === currentStageId);
                if (stage) stage.notes = notes;
            }
        } else {
            showAlert('Failed to update stage notes', 'Error');
        }
    } catch (error) {
        console.error('Error updating stage notes:', error);
    }
}

async function loadStageFindings(stageId) {
    try {
        const response = await apiFetch(`/api/findings?stage_id=${stageId}`);
        const data = await response.json();
        const findings = data.findings || [];

        const list = document.getElementById('stage-findings-list');
        if (findings.length === 0) {
            list.innerHTML = '<div style="color:var(--text-muted); padding:10px;">No findings recorded for this stage yet</div>';
            return;
        }

        list.innerHTML = findings.map(f => `
            <div class="content-item" style="display:flex; justify-content:space-between; align-items:center; border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; margin-bottom: 8px; background: var(--bg-secondary);">
                <div style="flex: 1; min-width: 0; text-align: left;">
                    <div style="font-weight:600; color:var(--text-primary);">${f.title}</div>
                    <div style="font-size:13px; color:var(--text-secondary); margin-top:4px;">${f.description || ''}</div>
                </div>
                <button class="btn btn-sm btn-secondary" onclick="deleteStageFinding(${f.id})">🗑️</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading stage findings:', error);
    }
}

async function addStageFinding() {
    if (!currentStageId) return;
    const result = await showMultiField([
        { name: 'title', label: 'Finding Title', type: 'text', placeholder: 'Enter finding title...' },
        { name: 'description', label: 'Description', type: 'textarea', rows: 4, placeholder: 'Enter details of the finding...' }
    ], 'Add Stage Finding', 'Enter finding details:');

    if (!result || !result.title) return;

    try {
        const response = await apiFetch('/api/findings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: result.title,
                description: result.description || '',
                project_id: currentProjectId,
                experiment_id: currentExperimentId,
                stage_id: currentStageId,
                finding_type: 'observation',
                severity: 'info'
            })
        });

        if (response.ok) {
            showAlert('Stage finding added successfully', 'Success');
            loadStageFindings(currentStageId);
        } else {
            showAlert('Failed to add stage finding', 'Error');
        }
    } catch (error) {
        console.error('Error adding stage finding:', error);
    }
}

async function deleteUsage(usageId) {
    if (!(await showConfirm('Delete this usage record?'))) return;

    try {
        const response = await apiFetch(`/api/equipment-usage/${usageId}`, { method: 'DELETE' });
        if (response.ok) {
            showAlert('Usage record deleted successfully', 'Success');
            // Refresh the current view
            if (currentExperimentId) {
                loadExperimentTimeline(currentExperimentId, 'experiment-timeline-list');
            }
        } else {
            showAlert('Failed to delete usage record', 'Error');
        }
    } catch (error) {
        console.error('Error deleting usage:', error);
        showAlert('Error deleting usage record', 'Error');
    }
}

async function deleteStageFinding(findingId) {
    if (!(await showConfirm('Delete this finding?'))) return;
    try {
        const response = await apiFetch(`/api/findings/${findingId}`, { method: 'DELETE' });
        if (response.ok) {
            showAlert('Finding deleted successfully', 'Success');
            loadStageFindings(currentStageId);
            refreshCurrentPage();
        } else {
            showAlert('Failed to delete finding', 'Error');
        }
    } catch (error) {
        console.error('Error deleting stage finding:', error);
    }
}

async function loadStageDocuments(stageId) {
    try {
        const response = await apiFetch(`/api/documents?stage_id=${stageId}`);
        const data = await response.json();
        const documents = data.documents || [];

        const list = document.getElementById('stage-documents-list');
        if (documents.length === 0) {
            list.innerHTML = '<div style="color:var(--text-muted); padding:10px;">No documents uploaded for this stage yet</div>';
            return;
        }

        list.innerHTML = documents.map(d => `
            <div class="content-item" style="display:flex; justify-content:space-between; align-items:center; border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; margin-bottom: 8px; background: var(--bg-secondary);">
                <div style="flex: 1; min-width: 0; margin-right: 12px; text-align: left;">
                    <a href="http://127.0.0.1:8000/api/documents/${d.id}/view" target="_blank" style="font-weight:600; color:var(--text-primary); text-decoration:none; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📄 ${d.title}</a>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Type: ${d.file_type || 'Unknown'} | Size: ${d.file_size ? (d.file_size / 1024).toFixed(1) + ' KB' : 'Unknown'}</div>
                </div>
                <button class="btn btn-sm btn-secondary" onclick="deleteStageDocument(${d.id})">🗑️</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading stage documents:', error);
    }
}

function triggerStageFileUpload() {
    document.getElementById('stage-document-file-input').click();
}

async function handleStageFileUpload(event) {
    const file = event.target.files[0];
    if (!file || !currentStageId) return;

    // Detect file type
    const title = file.name.replace(/\.[^/.]+$/, "");
    let file_type = 'document';
    const mimeType = file.type;
    const extension = file.name.split('.').pop().toLowerCase();

    if (mimeType.startsWith('image/')) {
        file_type = 'image';
    } else if (mimeType === 'application/pdf') {
        file_type = 'pdf';
    } else if (mimeType.startsWith('video/')) {
        file_type = 'video';
    } else if (extension === 'pdf') {
        file_type = 'pdf';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(extension)) {
        file_type = 'image';
    } else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension)) {
        file_type = 'video';
    } else if (['doc', 'docx'].includes(extension)) {
        file_type = 'document';
    } else if (['txt', 'md'].includes(extension)) {
        file_type = 'text';
    }

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('file_type', file_type);
        if (currentProjectId) formData.append('project_id', currentProjectId);
        if (currentExperimentId) formData.append('experiment_id', currentExperimentId);
        formData.append('stage_id', currentStageId);

        showAlert('Uploading stage document...', 'Info');

        console.log('[DEBUG] Starting stage upload via apiFetch to /api/documents');
        console.log('[DEBUG] File:', file.name, 'Size:', file.size);

        const response = await apiFetch('/api/documents', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        showAlert('Stage document uploaded successfully', 'Success');
        loadStageDocuments(currentStageId);
        refreshDashboardInBackground();
    } catch (error) {
        console.error('Error uploading stage document:', error);
        showAlert('Error uploading document', 'Error');
    }

    event.target.value = '';
}

async function deleteStageDocument(docId) {
    if (!(await showConfirm('Delete this document?'))) return;
    try {
        const response = await apiFetch(`/api/documents/${docId}`, { method: 'DELETE' });
        if (response.ok) {
            showAlert('Document deleted successfully', 'Success');
            loadStageDocuments(currentStageId);
            refreshDashboardInBackground();
            refreshCurrentPage();
        } else {
            showAlert('Failed to delete document', 'Error');
        }
    } catch (error) {
        console.error('Error deleting stage document:', error);
    }
}

// Add event listeners for experiment workspace tab switching
document.addEventListener('DOMContentLoaded', () => {
    // Stages are now always scoped to experiments or projects, no global load needed
    checkInternetConnection();
    setInterval(checkInternetConnection, 30000); // Check every 30 seconds

    // Experiment workspace tab switching
    document.querySelectorAll('#experiment-workspace-page .project-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('#experiment-workspace-page .project-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('#experiment-workspace-page .tab-pane').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
        });
    });
});

async function loadProjectData(projectId) {
    // Load project-specific data for each tab
    loadProjectNotebook(projectId);
    loadProjectExperiments(projectId);
    loadProjectCalculations(projectId);
    loadProjectComponents(projectId);
    loadProjectDocuments(projectId);
    loadProjectFindings(projectId);
    // Note: loadProjectOverview will also load the timeline into the overview
    loadProjectUsage(projectId);
    loadProjectOverview(projectId);
}

async function loadProjectOverview(projectId) {
    try {
        const response = await apiFetch(`/api/projects/${projectId}`);
        const data = await response.json();
        const project = data.data;

        const overview = document.getElementById('project-overview-content');
        if (project) {
            // If the project record doesn't include a summary, derive one from actual findings
            let summary = project.summary_findings;
            if (!summary) {
                try {
                    const fResp = await apiFetch(`/api/findings?project_id=${projectId}`);
                    const fData = await fResp.json();
                    const findings = fData.findings || [];
                    if (findings.length === 0) {
                        summary = 'No findings yet';
                    } else if (findings.length === 1) {
                        summary = `${findings[0].title}`;
                    } else {
                        summary = `${findings.length} findings — ${findings.slice(0, 3).map(f => f.title).join(', ')}${findings.length > 3 ? ', ...' : ''}`;
                    }
                } catch (err) {
                    console.error('Error fetching findings for summary:', err);
                    summary = project.summary_findings || 'No findings yet';
                }
            }

            const overviewHtml = `
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <p style="color: var(--text-secondary); margin: 0;"><strong>Description:</strong> ${project.description || 'No description'}</p>
                    <p style="color: var(--text-secondary); margin: 0;"><strong>Status:</strong> ${project.status || 'Active'}</p>
                    <p style="color: var(--text-secondary); margin: 0;"><strong>Start Date:</strong> ${project.start_date || 'Not set'}</p>
                    <p style="color: var(--text-secondary); margin: 0;"><strong>Summary Findings:</strong> ${summary}</p>
                    
                    <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px;">
                        <label for="project-outcome-input" style="font-weight: 600; color: var(--text-secondary);">Project Outcome / Conclusion:</label>
                        <textarea id="project-outcome-input" class="search-input" style="width: 100%; height: 80px; resize: vertical; padding: 8px;" placeholder="Add final outcome details for the project...">${project.project_outcome || project.summary_findings || ''}</textarea>
                    </div>
                    <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
                        <button class="btn btn-sm btn-primary" onclick="saveProjectOutcome(${project.id})">Save Project Outcome</button>
                    </div>
                </div>
            `;
            overview.innerHTML = overviewHtml;

            // Load timeline into the overview timeline area
            setTimeout(() => {
                loadProjectTimeline(projectId, 'project-overview-timeline-list');
                loadProjectUsageSummary(projectId);
            }, 0);
        }
    } catch (error) {
        console.error('Error loading project overview:', error);
    }
}

async function saveProjectOutcome(projectId) {
    const outcomeVal = document.getElementById('project-outcome-input').value;
    try {
        const response = await apiFetch(`/api/projects/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_outcome: outcomeVal
            })
        });

        if (response.ok) {
            showAlert('Project outcome saved successfully', 'Success');
            loadProjectOverview(projectId);
            refreshCurrentPage();
        } else {
            showAlert('Failed to save project outcome', 'Error');
        }
    } catch (error) {
        console.error('Error saving project outcome:', error);
    }
}

async function loadProjectUsageSummary(projectId) {
    try {
        const response = await apiFetch(`/api/projects/${projectId}/usage-summary`);
        const data = await response.json();
        const summary = data.data || [];

        const container = document.getElementById('project-usage-summary-content');
        if (!container) return;

        if (summary.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted); padding: 10px;">No resources used in this project yet</div>';
            return;
        }

        container.innerHTML = `
            <table class="inventory-table" style="width:100%; margin-top: 8px; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--border-color);">
                        <th style="text-align: left; padding: 8px;">Resource</th>
                        <th style="text-align: left; padding: 8px;">Type</th>
                        <th style="text-align: left; padding: 8px;">Total Quantity Used</th>
                        <th style="text-align: left; padding: 8px;">Last Used</th>
                    </tr>
                </thead>
                <tbody>
                    ${summary.map(item => `
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <td style="padding: 8px;"><strong>${item.name}</strong>${item.details ? ` (${item.details})` : ''}</td>
                            <td style="padding: 8px;"><span class="badge badge-info" style="font-size: 11px;">${item.entity_type.toUpperCase()}</span></td>
                            <td style="padding: 8px;">${item.total_quantity} ${item.unit || ''}</td>
                            <td style="padding: 8px;">${item.last_used || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading project usage summary:', error);
    }
}

async function loadProjectNotebook(projectId) {
    try {
        const response = await apiFetch(`/api/notebook?project_id=${projectId}`);
        const data = await response.json();

        const list = document.getElementById('project-notebook-list');
        if (data.entries.length === 0) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No entries yet</div>';
        } else {
            list.innerHTML = data.entries.map(entry => `
                    <div class="content-item" onclick="loadNoteInEditor(${entry.id})" style="cursor: pointer;">
                        <div>
                            <div class="title">${entry.title}</div>
                            <div class="description">${entry.content.substring(0, 100)}...</div>
                        </div>
                    </div>
                `).join('');
        }
    } catch (error) {
        console.error('Error loading project notebook:', error);
    }
}

async function loadProjectExperiments(projectId) {
    try {
        const response = await apiFetch(`/api/logs?project_id=${projectId}`);
        const data = await response.json();

        const list = document.getElementById('project-experiments-list');
        const logs = normalizeLogsResponse(data);
        if (!logs || logs.length === 0) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No experiments yet</div>';
        } else {
            list.innerHTML = logs.slice(0, 20).map(log => {
                const result = (log.outcome || 'PENDING').toLowerCase();
                return `
                <div class="content-item">
                    <div>
                        <div class="title">${log.log_title}</div>
                        <div class="description">${log.timestamp || 'No date'}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="experiment-result-badge ${result}">${result.toUpperCase()}</span>
                        <button class="btn btn-sm btn-secondary" onclick="openLogUsageForExperiment(${log.id})">Log Usage</button>
                        <button class="btn btn-sm btn-secondary" onclick="openManageExperimentStages(null, ${log.id})">+ Add Stage</button>
                        <button class="btn btn-sm btn-secondary" onclick="openExperimentStagesModal(${log.id})">View Stages</button>
                    </div>
                </div>
            `}).join('');
        }
    } catch (error) {
        console.error('Error loading project experiments:', error);
    }
}

async function loadProjectCalculations(projectId) {
    try {
        const response = await apiFetch(`/api/calculations?project_id=${projectId}`);
        const data = await response.json();

        const list = document.getElementById('project-calculations-list');
        if (!data.calculations || data.calculations.length === 0) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No calculations yet</div>';
        } else {
            list.innerHTML = data.calculations.map(calc => `
                <div class="content-item">
                    <div>
                        <div class="title">${calc.title}</div>
                        <div class="description">${calc.calculation_type}</div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading project calculations:', error);
    }
}

async function loadProjectComponents(projectId) {
    try {
        const response = await apiFetch(`/api/components`);
        const data = await response.json();

        const list = document.getElementById('project-components-list');
        if (data.components.length === 0) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No components yet</div>';
        } else {
            list.innerHTML = data.components.map(comp => `
                <div class="content-item">
                    <div>
                        <div class="title">${comp.name}</div>
                        <div class="description">Qty: ${comp.quantity}</div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading project components:', error);
    }
}

async function loadProjectDocuments(projectId) {
    try {
        const response = await apiFetch(`/api/documents?project_id=${projectId}`);
        const data = await response.json();

        const list = document.getElementById('project-documents-list');
        if (data.documents.length === 0) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No documents yet</div>';
        } else {
            list.innerHTML = data.documents.map(doc => `
                <div class="content-item" onclick="viewDocument(${doc.id})" style="cursor: pointer;">
                    <div>
                        <div class="title">${doc.title}</div>
                        <div class="description">${doc.description || 'No description'}</div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading project documents:', error);
    }
}

async function loadProjectFindings(projectId) {
    try {
        const response = await apiFetch(`/api/findings?project_id=${projectId}`);
        const data = await response.json();

        const list = document.getElementById('project-findings-list');
        if (data.findings.length === 0) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No findings yet</div>';
        } else {
            list.innerHTML = data.findings.map(finding => `
                <div class="content-item">
                    <div>
                        <div class="title">${finding.title}</div>
                        <div class="description">${finding.description.substring(0, 100)}...</div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading project findings:', error);
    }
}

async function loadProjectTimeline(projectId, containerId = 'project-overview-timeline-list') {
    try {
        const list = document.getElementById(containerId);
        const controlsId = 'project-timeline-controls';
        let controls = document.getElementById(controlsId);
        if (!controls) {
            const container = document.getElementById('project-timeline-controls-holder') || document.createElement('div');
            container.id = 'project-timeline-controls-holder';
            container.style.marginBottom = '12px';
            const html = `
                <div id="${controlsId}" style="display:flex; gap:8px; margin-bottom:16px; align-items:center; flex-wrap:wrap">
                    <button class="btn btn-sm btn-primary" onclick="openManageExperimentStages(${projectId})">+ Add Stage</button>
                    <select id="timeline-filter-type" style="padding:6px 10px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-secondary); color:var(--text-primary)"><option value="">All Types</option><option value="stage">Stage</option><option value="usage">Usage</option><option value="experiment">Experiment</option></select>
                    <select id="timeline-filter-stage" style="padding:6px 10px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-secondary); color:var(--text-primary)"><option value="">All Stages</option></select>
                    <button class="btn btn-sm btn-secondary" id="timeline-load-more">Load more</button>
                </div>
            `;
            container.innerHTML = html;
            // Insert controls before list
            if (list && list.parentNode) list.parentNode.insertBefore(container, list);
            controls = document.getElementById(controlsId);
            document.getElementById('timeline-load-more').addEventListener('click', () => {
                // increase page size and reload
                window._projectTimelineLimit = (window._projectTimelineLimit || 50) + 50;
                loadProjectTimeline(projectId, containerId);
            });
            document.getElementById('timeline-filter-type').addEventListener('change', () => applyProjectTimelineFilters());
            document.getElementById('timeline-filter-stage').addEventListener('change', () => applyProjectTimelineFilters());
        }
        // Build a combined timeline from stages, usage logs and experiments
        const limitParam = window._projectTimelineLimit || 50;
        const [stResp, usageResp, logsResp, docsResp] = await Promise.all([
            apiFetch(`/api/project_stages?project_id=${projectId}&limit=${limitParam}`),
            apiFetch(`/api/usage?project_id=${projectId}&limit=200`),
            apiFetch(`/api/logs?project_id=${projectId}&limit=200`).catch(() => null),
            apiFetch('/api/documents').catch(() => null)
        ]);

        const stData = stResp ? await stResp.json() : { data: [] };
        const stages = (stData && stData.data) ? stData.data : [];

        const usageData = usageResp ? await usageResp.json() : { data: [] };
        const usages = (usageData && usageData.data) ? usageData.data : [];

        let logs = [];
        if (logsResp) {
            try { const ld = await logsResp.json(); logs = normalizeLogsResponse(ld); } catch (e) { logs = []; }
        }

        let docsById = {};
        if (docsResp) {
            try { const dd = await docsResp.json(); const docs = dd.documents || []; docs.forEach(d => { docsById[String(d.id)] = d; }); } catch (e) { docsById = {}; }
        }

        // Group experiments by stage
        const experimentsByStage = {};
        logs.forEach(l => {
            const stageId = l.stage_id || 'unassigned';
            if (!experimentsByStage[stageId]) {
                experimentsByStage[stageId] = [];
            }
            experimentsByStage[stageId].push({
                id: l.id,
                timestamp: l.timestamp || l.created_at || null,
                title: l.log_title || l.title || 'Experiment',
                subtitle: l.outcome || '',
                details: l.log_text || l.summary || '',
                owner: l.project_name || ''
            });
        });

        // Group usage by stage
        const usageByStage = {};
        usages.forEach(u => {
            const stageId = u.stage_id || 'unassigned';
            if (!usageByStage[stageId]) {
                usageByStage[stageId] = [];
            }
            usageByStage[stageId].push({
                id: u.id,
                timestamp: u.timestamp || u.created_at || null,
                title: `${u.entity_type || 'Item'} used`,
                subtitle: `${u.quantity_used || ''} ${u.unit || ''}`.trim(),
                details: u.notes || '',
                owner: u.user_id || ''
            });
        });

        // Build hierarchical timeline: stages with their experiments and usage
        const stageEvents = stages.map(s => {
            const stageId = String(s.id);
            const stageExperiments = experimentsByStage[stageId] || [];
            const stageUsage = usageByStage[stageId] || [];

            return {
                type: 'stage',
                id: s.id,
                timestamp: s.start_time || s.created_at || null,
                title: s.stage_name || s.name || 'Stage',
                subtitle: s.status || '',
                details: s.notes || '',
                owner: s.owner || '',
                attachments: s.attachments || null,
                experiments: stageExperiments,
                usage: stageUsage
            };
        });

        // Sort stages by timestamp
        stageEvents.sort((a, b) => {
            const ta = a.timestamp || '';
            const tb = b.timestamp || '';
            if (!ta && !tb) return 0;
            if (!ta) return 1;
            if (!tb) return -1;
            return ta.localeCompare(tb);
        });

        if (!stageEvents.length) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No timeline events for this project</div>';
            return;
        }

        // cache events
        window._timelineEventCache = window._timelineEventCache || {};
        // limit/pagination
        const limit = window._projectTimelineLimit || 50;
        const shownEvents = stageEvents.slice(0, limit);

        // populate stage filter options
        const stageSelect = document.getElementById('timeline-filter-stage');
        if (stageSelect) {
            const existing = new Set(Array.from(stageSelect.options).map(o => o.value));
            stages.forEach(s => {
                const id = String(s.id);
                if (!existing.has(id)) {
                    const opt = document.createElement('option');
                    opt.value = id;
                    opt.text = s.stage_name || s.name || id;
                    stageSelect.appendChild(opt);
                }
            });
        }

        list.innerHTML = shownEvents.map(ev => {
            const key = `project:${ev.type}:${ev.id}`;
            window._timelineEventCache[key] = ev;
            if (ev.type === 'stage') {
                // attachments badges
                const attachmentsArr = (function (a) { if (!a) return []; if (Array.isArray(a)) return a; if (typeof a === 'string') { try { const p = JSON.parse(a); if (Array.isArray(p)) return p.map(x => (typeof x === 'object' && x.id) ? x.id : x); } catch (e) { } return a.split(',').map(s => s.trim()).filter(Boolean); } return []; })(ev.attachments);
                const attachmentsHtml = attachmentsArr.map(att => { const id = (typeof att === 'object' && att.id) ? att.id : att; const doc = docsById[String(id)]; const title = (doc && (doc.title || doc.file_path || doc.source_path)) ? (doc.title || doc.file_path || doc.source_path) : id; const isImage = doc && String(doc.file_type || '').toLowerCase().includes('image'); const thumb = isImage ? `<img src="http://127.0.0.1:8000/api/documents/${id}/view" class="attachment-thumb">` : ''; return `<span class="attachment-badge" title="${escapeHtml(String(title))}" onclick="event.stopPropagation(); viewDocument(${id})">${thumb}<span class="attachment-title">${escapeHtml(String(title))}</span><button class=\\"attachment-remove\\" onclick=\\"event.stopPropagation(); removeAttachmentFromStage(${ev.id}, ${projectId}, ${id})\\">✖</button></span>`; }).join(' ');
                // highlight active stage
                const activeClass = (ev.status && ev.status.toLowerCase() === 'in_progress') ? 'timeline-active-stage' : '';

                // Build experiments HTML
                const experimentsHtml = (ev.experiments || []).map(exp => `
                    <div class="timeline-subitem">
                        <div class="timeline-dot experiment-dot" style="transform: scale(0.7);"></div>
                        <div class="timeline-content" style="padding: 8px 12px;">
                            <div style="font-weight:500; font-size:14px;">${escapeHtml(exp.title)} ${exp.subtitle ? `— ${escapeHtml(exp.subtitle)}` : ''}</div>
                            <div style="font-size:12px; color:var(--text-secondary)">${exp.timestamp || ''} ${exp.owner ? `— ${escapeHtml(exp.owner)}` : ''}</div>
                            <div style="margin-top:4px; font-size:13px;">${escapeHtml(exp.details)}</div>
                        </div>
                    </div>
                `).join('');

                // Build usage HTML
                const usageHtml = (ev.usage || []).map(u => `
                    <div class="timeline-subitem">
                        <div class="timeline-dot usage-dot" style="transform: scale(0.7);"></div>
                        <div class="timeline-content" style="padding: 8px 12px;">
                            <div style="font-weight:500; font-size:14px;">${escapeHtml(u.title)} ${u.subtitle ? `— ${escapeHtml(u.subtitle)}` : ''}</div>
                            <div style="font-size:12px; color:var(--text-secondary)">${u.timestamp || ''} ${u.owner ? `— ${escapeHtml(u.owner)}` : ''}</div>
                            <div style="margin-top:4px; font-size:13px;">${escapeHtml(u.details)}</div>
                        </div>
                    </div>
                `).join('');

                return `
                    <div class="timeline-item" onclick="showTimelineEventDetails('stage', ${ev.id}, null); updateLabAssistantContext('stage', ${ev.id}, ${JSON.stringify(ev).replace(/"/g, '&quot;')})">
                        <div class="timeline-dot stage-dot"></div>
                        <div class="timeline-content ${activeClass}">
                            <div style="font-weight:600">${escapeHtml(ev.title)} ${ev.subtitle ? `— ${escapeHtml(ev.subtitle)}` : ''}</div>
                            <div style="font-size:13px; color:var(--text-secondary)">${ev.timestamp || ''} ${ev.owner ? `— ${escapeHtml(ev.owner)}` : ''}</div>
                            <div style="margin-top:6px">${escapeHtml(ev.details)}</div>
                            ${attachmentsHtml ? `<div style="margin-top:8px">${attachmentsHtml}</div>` : ''}
                            <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                                <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); createExperimentUnderStage(${ev.id})">+ Add Experiment</button>
                                <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); openLogUsageForStage(${ev.id}, null, ${projectId})">Log Usage</button>
                                <button class="btn btn-sm ai-review-btn" onclick="event.stopPropagation(); runStageReview()">🤖 AI Review</button>
                            </div>
                            ${(ev.experiments && ev.experiments.length > 0) ? `<div style="margin-top:12px; padding-left:12px; border-left:2px solid var(--border-color);">${experimentsHtml}</div>` : ''}
                            ${(ev.usage && ev.usage.length > 0) ? `<div style="margin-top:8px; padding-left:12px; border-left:2px solid var(--border-color);">${usageHtml}</div>` : ''}
                        </div>
                    </div>
                `;
            }
            return '';
        }).join('');

        // apply initial filters if any
        applyProjectTimelineFilters();
    } catch (error) {
        console.error('Error loading project timeline:', error);
    }
}

// Tab switching (robust to tabs/panes being removed)
document.querySelectorAll('.project-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        // Update active tab
        document.querySelectorAll('.project-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Show/hide tab panes
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        const paneEl = document.getElementById(`tab-${tabName}`);
        if (paneEl) paneEl.classList.add('active');
    });
});

// Experiments
let allExperiments = [];

function normalizeLogsResponse(data) {
    if (!data) return [];
    if (Array.isArray(data.logs)) return data.logs;
    if (Array.isArray(data.data)) return data.data;
    if (data.data && Array.isArray(data.data.logs)) return data.data.logs;
    return [];
}

async function loadExperiments() {
    try {
        // Fetch experiments/logs from the API and normalize the response
        const resp = await apiFetch('/api/logs');
        const data = await resp.json();
        allExperiments = normalizeLogsResponse(data) || [];

        // Populate filters and render the initial list
        await populateProjectFilter();
        filterExperiments();
    } catch (error) {
        console.error('Error loading experiments:', error);
    }
}

async function populateProjectFilter() {
    try {
        const response = await apiFetch('/api/projects');
        const data = await response.json();
        const select = document.getElementById('experiment-project-filter');

        if (select && data.projects) {
            select.innerHTML = '<option value="">All Projects</option>' +
                data.projects.map(project => `<option value="${project.name}">${project.name}</option>`).join('');
        }
    } catch (error) {
        console.error('Error populating project filter:', error);
    }
}

async function filterExperiments() {
    const searchTerm = document.getElementById('experiment-search-input').value.toLowerCase();
    const outcomeFilter = document.getElementById('experiment-outcome-filter').value;
    const projectFilter = document.getElementById('experiment-project-filter').value;
    const startDate = document.getElementById('experiment-start-date').value;
    const endDate = document.getElementById('experiment-end-date').value;

    // Client-side filtering
    let filtered = allExperiments.filter(log => {
        // Search term filter
        if (searchTerm && !log.log_title.toLowerCase().includes(searchTerm) &&
            !(log.log_text && log.log_text.toLowerCase().includes(searchTerm))) {
            return false;
        }

        // Outcome filter
        if (outcomeFilter && log.outcome !== outcomeFilter) {
            return false;
        }

        // Project filter
        if (projectFilter && log.project_name !== projectFilter) {
            return false;
        }

        // Date range filter
        if (startDate && log.timestamp && log.timestamp < startDate) {
            return false;
        }
        if (endDate && log.timestamp && log.timestamp > endDate) {
            return false;
        }

        return true;
    });

    // Render filtered experiments
    const list = document.getElementById('experiments-list');
    if (filtered.length === 0) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No experiments match your filters</div>';
    } else {
        // Fetch notebook entries for each experiment to get counts
        const logsWithNotes = await Promise.all(filtered.slice(0, 20).map(async (log) => {
            try {
                const notebookResponse = await apiFetch(`/api/notebook?experiment_id=${log.id}`);
                const notebookData = await notebookResponse.json();
                return { ...log, notesCount: notebookData.entries ? notebookData.entries.length : 0, notes: notebookData.entries || [] };
            } catch (error) {
                return { ...log, notesCount: 0, notes: [] };
            }
        }));

        list.innerHTML = logsWithNotes.map((log) => {
            const result = (log.outcome || 'PENDING').toLowerCase();
            return `
            <div class="experiment-card" id="experiment-${log.id}" data-log-id="${log.id}">
                <div class="experiment-card-header" onclick="openExperimentWorkspace(${log.id})">
                    <div class="experiment-card-header-left">
                        <div class="title">${log.log_title}</div>
                        <div class="date">${log.timestamp || 'No date'}</div>
                    </div>
                    <div class="experiment-card-header-right">
                        ${log.notesCount > 0 ? `<span class="notes-count-badge">📓 ${log.notesCount}</span>` : ''}
                        <span class="experiment-result-badge ${result}">${result.toUpperCase()}</span>
                        <span class="experiment-expand-icon">▼</span>
                    </div>
                </div>
                <div class="experiment-card-body">
                    <div class="experiment-card-content">
                        <p><strong>Experiment Details:</strong></p>
                        <p>${log.log_text || 'No description available'}</p>
                        ${log.expected_outcome ? `<p><strong>Expected Outcome:</strong></p><p>${log.expected_outcome}</p>` : ''}
                        <div class="meta">Project: ${log.project_name || log.project_id || 'Not linked'}</div>
                        <div class="meta">Created: ${log.timestamp || 'Unknown'}</div>
                        
                        <div style="margin-top:12px; padding:12px; background:var(--bg-secondary); border-radius:6px;">
                            <p><strong>Actual Outcome:</strong></p>
                            <textarea id="experiment-outcome-${log.id}" rows="2" style="width:100%; padding:8px; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-primary); color:var(--text-primary);" placeholder="Enter actual outcome...">${log.actual_outcome || ''}</textarea>
                            <div id="experiment-outcome-attachments-${log.id}" style="margin-top:8px;">
                                ${log.outcome_attachments ? renderExperimentAttachments(log.outcome_attachments, log.id, 'outcome') : ''}
                            </div>
                            <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                                <button class="btn btn-sm btn-secondary" onclick="linkNoteToExperiment(${log.id}, 'outcome')">📓 Link Note</button>
                                <button class="btn btn-sm btn-secondary" onclick="attachDocumentToExperiment(${log.id}, 'outcome')">📄 Attach Document</button>
                                <button class="btn btn-sm btn-secondary" onclick="uploadMediaToExperiment(${log.id}, 'outcome')">🖼️ Upload Image/Video</button>
                            </div>
                            
                            <p style="margin-top:12px;"><strong>Findings:</strong></p>
                            <textarea id="experiment-findings-${log.id}" rows="3" style="width:100%; padding:8px; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-primary); color:var(--text-primary);" placeholder="Enter findings...">${log.findings || ''}</textarea>
                            <div id="experiment-findings-attachments-${log.id}" style="margin-top:8px;">
                                ${log.findings_attachments ? renderExperimentAttachments(log.findings_attachments, log.id, 'findings') : ''}
                            </div>
                            <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                                <button class="btn btn-sm btn-secondary" onclick="linkNoteToExperiment(${log.id}, 'findings')">📓 Link Note</button>
                                <button class="btn btn-sm btn-secondary" onclick="attachDocumentToExperiment(${log.id}, 'findings')">📄 Attach Document</button>
                                <button class="btn btn-sm btn-secondary" onclick="uploadMediaToExperiment(${log.id}, 'findings')">🖼️ Upload Image/Video</button>
                            </div>
                            
                            <button class="btn btn-sm btn-primary" style="margin-top:8px;" onclick="saveExperimentFindings(${log.id}, event)">Save Outcome & Findings</button>
                        </div>
                        
                        ${log.notesCount > 0 ? `
                            <div class="linked-notebook-entries">
                                <p><strong>📓 Linked Notes:</strong></p>
                                ${log.notes.map(note => `
                                    <div class="linked-note-item">
                                        <div class="linked-note-title">${note.title}</div>
                                        <div class="linked-note-preview">${note.content.substring(0, 80)}...</div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        <div class="experiment-outcome-buttons">
                            <button class="btn btn-sm ${result === 'pending' ? 'btn-primary' : 'btn-secondary'}" onclick="updateExperimentOutcome(${log.id}, 'PENDING', event)">Pending</button>
                            <button class="btn btn-sm ${result === 'pass' ? 'btn-success' : 'btn-secondary'}" onclick="updateExperimentOutcome(${log.id}, 'PASS', event)">Pass</button>
                            <button class="btn btn-sm ${result === 'fail' ? 'btn-danger' : 'btn-secondary'}" onclick="updateExperimentOutcome(${log.id}, 'FAIL', event)">Fail</button>
                            <button class="btn btn-sm btn-secondary" onclick="openLogUsageForExperiment(${log.id})">Log Usage</button>
                            <button class="btn btn-sm ${log.status === 'Active' ? 'btn-warning' : 'btn-success'}" onclick="event.stopPropagation(); ${log.status === 'Active' ? `pauseExperiment(${log.id})` : `resumeExperiment(${log.id})`}">${log.status === 'Active' ? 'Pause' : 'Resume'}</button>
                            <button class="btn btn-sm btn-secondary" onclick="deleteExperiment(${log.id}, event)">🗑️</button>
                        </div>
                    </div>
                </div>
            </div>
        `}).join('');
    }
}

// Usage logging UI + handlers
async function loadProjectUsage(projectId) {
    try {
        const resp = await apiFetch(`/api/usage?project_id=${projectId}&limit=20`);
        const data = await resp.json();
        const logs = (data && data.data) ? data.data : [];

        // Fetch stages to map stage names
        let stagesMap = {};
        try {
            const stResp = await apiFetch(`/api/project_stages?project_id=${projectId}&limit=200`);
            const stData = await stResp.json();
            const stList = (stData && stData.data) ? stData.data : [];
            stList.forEach(s => { stagesMap[String(s.id)] = s.stage_name || s.name || ''; });
        } catch (e) { stagesMap = {}; }

        const containerId = 'project-usage-widget';
        let widget = document.getElementById(containerId);
        if (!widget) {
            const overview = document.getElementById('project-overview-content');
            if (!overview) return;
            widget = document.createElement('div');
            widget.id = containerId;
            widget.style.marginTop = '16px';
            overview.appendChild(widget);
        }

        widget.innerHTML = `
            <h4 style="margin-bottom:8px">Recent Usage</h4>
            <div style="display:flex; gap:8px; margin-bottom:8px">
                <button class="btn btn-primary" onclick="openLogUsageForProject()">Log Usage</button>
                <button class="btn btn-secondary" onclick="loadProjectUsage(${projectId})">Refresh</button>
            </div>
            <div id="project-usage-list">${logs.length === 0 ? '<div style="color:var(--text-muted)">No recent usage</div>' : ''}</div>
        `;

        const listEl = document.getElementById('project-usage-list');
        if (logs.length > 0) {
            listEl.innerHTML = logs.map(l => `
                <div class="content-item">
                    <div>
                        <div style="font-weight:600">${l.entity_type} ${l.entity_id || ''} — ${l.quantity_used || ''} ${l.unit || ''}</div>
                        <div style="color:var(--text-secondary); font-size:13px">${l.post_use_status || ''} ${l.stage_id ? `— Stage: ${escapeHtml(stagesMap[String(l.stage_id)] || String(l.stage_id))}` : ''} — ${l.notes || ''}</div>
                    </div>
                    <div style="color:var(--text-muted); font-size:12px">${l.timestamp}</div>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Error loading project usage:', err);
    }
}

// ── Log Usage Modal ──────────────────────────────────────────────────────────
let _luContext = {}; // { project_id, experiment_id, stage_id }

function openLogUsageForProject() {
    openLogUsageModal({ project_id: currentProjectId });
}

function openLogUsageForExperiment(experimentId) {
    openLogUsageModal({ project_id: currentProjectId, experiment_id: experimentId });
}

async function openLogUsageForStage(stageId, experimentId = null, projectId = null) {
    openLogUsageModal({
        project_id: projectId || currentProjectId,
        experiment_id: experimentId || currentExperimentId,
        stage_id: stageId
    });
}

async function openLogUsageModal(context = {}) {
    _luContext = context;

    // subtitle
    const subtitle = document.getElementById('log-usage-modal-subtitle');
    if (subtitle) {
        const parts = [];
        if (context.experiment_id) parts.push('Experiment #' + context.experiment_id);
        else if (context.project_id) parts.push('Project #' + context.project_id);
        if (context.stage_id) parts.push('Stage #' + context.stage_id);
        subtitle.textContent = parts.length ? 'Logging for: ' + parts.join(' › ') : 'Select resources used and fill in usage details';
    }

    // reset tabs
    switchLogUsageTab('components');

    // show modal
    const modal = document.getElementById('log-usage-modal');
    modal.style.display = 'flex';

    // fetch all resources in parallel
    const [compData, matData, toolData, eqData] = await Promise.allSettled([
        apiFetch('/api/components').then(r => r.json()),
        apiFetch('/api/materials').then(r => r.json()),
        apiFetch('/api/tools').then(r => r.json()),
        apiFetch('/api/equipment').then(r => r.json())
    ]);

    const components = compData.status === 'fulfilled' ? (compData.value.data || []) : [];
    const materials = matData.status === 'fulfilled' ? (matData.value.data || []) : [];
    const tools = toolData.status === 'fulfilled' ? (toolData.value.data || []) : [];
    const equipment = eqData.status === 'fulfilled' ? (eqData.value.data || []) : [];

    renderLuSection('components', components, item => ({
        id: item.id, name: item.name,
        meta: [item.part_number, item.quantity != null ? `Qty: ${item.quantity}` : ''].filter(Boolean).join(' · '),
        badge: item.status || ''
    }));
    renderLuSection('materials', materials, item => ({
        id: item.id, name: item.name,
        meta: [item.material_type, item.quantity != null ? `Stock: ${item.quantity} ${item.unit || ''}` : ''].filter(Boolean).join(' · '),
        badge: item.status || ''
    }));
    renderLuSection('tools', tools, item => ({
        id: item.id, name: item.name,
        meta: [item.tool_type, item.storage_location].filter(Boolean).join(' · '),
        badge: item.status || ''
    }));
    renderLuSection('equipment', equipment, item => ({
        id: item.id, name: item.name,
        meta: [item.model, item.location].filter(Boolean).join(' · '),
        badge: item.status || ''
    }));

    updateLuSelectedCount();
}

function renderLuSection(type, items, mapper) {
    const container = document.getElementById(`lu-section-${type}`);
    if (!container) return;
    if (!items.length) {
        container.innerHTML = `<div class="lu-empty">No ${type} in inventory yet</div>`;
        return;
    }
    container.innerHTML = items.map(item => {
        const { id, name, meta, badge } = mapper(item);
        return `
        <div class="lu-item" id="lu-item-${type}-${id}" data-type="${type}" data-id="${id}">
            <div class="lu-item-header" onclick="toggleLuItem('${type}', ${id})">
                <input type="checkbox" class="lu-item-checkbox" id="lu-chk-${type}-${id}"
                    onclick="event.stopPropagation(); toggleLuItem('${type}', ${id})" />
                <span class="lu-item-name">${name}</span>
                ${meta ? `<span class="lu-item-meta">${meta}</span>` : ''}
                ${badge ? `<span class="lu-item-badge">${badge}</span>` : ''}
            </div>
            <div class="lu-detail-container" style="display:none; padding:0 16px 14px;"></div>
        </div>`;
    }).join('');
}

function toggleLuItem(type, id) {
    const item = document.getElementById(`lu-item-${type}-${id}`);
    const chk = document.getElementById(`lu-chk-${type}-${id}`);
    const detail = item.querySelector('.lu-detail-container');

    chk.checked = !chk.checked;
    item.classList.toggle('checked', chk.checked);

    if (chk.checked) {
        if (!detail.hasChildNodes()) {
            const tpl = document.getElementById('lu-detail-tpl');
            const clone = tpl.content.cloneNode(true);
            detail.appendChild(clone);
        }
        detail.style.display = 'block';
    } else {
        detail.style.display = 'none';
    }
    updateLuSelectedCount();
}

function updateLuSelectedCount() {
    const total = document.querySelectorAll('#log-usage-modal .lu-item-checkbox:checked').length;
    const el = document.getElementById('lu-selected-count');
    if (el) el.textContent = total === 0 ? '0 items selected' : `${total} item${total > 1 ? 's' : ''} selected`;
}

function switchLogUsageTab(section) {
    document.querySelectorAll('.lu-tab').forEach(t => t.classList.toggle('active', t.dataset.section === section));
    document.querySelectorAll('.lu-section').forEach(s => s.style.display = 'none');
    const active = document.getElementById(`lu-section-${section}`);
    if (active) active.style.display = 'block';
}

function closeLogUsageModal() {
    const modal = document.getElementById('log-usage-modal');
    if (modal) modal.style.display = 'none';
    _luContext = {};
}

async function submitLogUsageModal() {
    const checkedItems = document.querySelectorAll('#log-usage-modal .lu-item-checkbox:checked');
    if (!checkedItems.length) {
        showAlert('Please select at least one resource', 'Warning');
        return;
    }

    const entries = [];
    checkedItems.forEach(chk => {
        const itemEl = chk.closest('.lu-item');
        const type = itemEl.dataset.type;
        const id = Number(itemEl.dataset.id);
        const detail = itemEl.querySelector('.lu-detail-container');

        entries.push({
            entity_type: type === 'components' ? 'component' : type.replace(/s$/, ''),
            entity_id: id,
            quantity_used: parseFloat(detail.querySelector('.lu-qty')?.value) || 0,
            unit: detail.querySelector('.lu-unit')?.value?.trim() || '',
            post_use_status: detail.querySelector('.lu-status')?.value || 'good',
            needs_repair: detail.querySelector('.lu-needs-repair')?.checked || false,
            needs_replacement: detail.querySelector('.lu-needs-replacement')?.checked || false,
            notes: detail.querySelector('.lu-notes')?.value?.trim() || '',
        });
    });

    let successCount = 0, failCount = 0;
    for (const entry of entries) {
        const payload = {
            ...entry,
            ...(_luContext.project_id ? { project_id: _luContext.project_id } : {}),
            ...(_luContext.experiment_id ? { experiment_id: _luContext.experiment_id } : {}),
            ...(_luContext.stage_id ? { stage_id: _luContext.stage_id } : {}),
            auto_update_inventory: true
        };
        try {
            const resp = await submitUsage(payload, true);
            if (resp) successCount++; else failCount++;
        } catch { failCount++; }
    }

    closeLogUsageModal();

    if (successCount > 0) {
        showAlert(`✓ Logged usage for ${successCount} resource${successCount > 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}`, 'Success');
        if (_luContext.project_id) {
            loadProjectUsage(_luContext.project_id);
            loadProjectOverview(_luContext.project_id);
        }
        if (_luContext.experiment_id) {
            loadExperimentOverview(_luContext.experiment_id);
        }
        refreshDashboardInBackground();
    } else {
        showAlert('Failed to log usage. Please try again.', 'Error');
    }
}



function applyProjectTimelineFilters() {
    const type = document.getElementById('timeline-filter-type')?.value || '';
    const stage = document.getElementById('timeline-filter-stage')?.value || '';
    const list = document.getElementById('project-timeline-list') || document.getElementById('project-overview-timeline-list');
    if (!list) return;
    // Show/hide timeline items by data attributes if present, otherwise filter by content
    const items = Array.from(list.querySelectorAll('.timeline-item'));
    items.forEach(item => {
        let show = true;
        if (type) {
            if (type === 'stage' && !item.querySelector('.timeline-dot.stage-dot')) show = false;
            if (type === 'usage' && !item.querySelector('.timeline-dot.usage-dot')) show = false;
            if (type === 'experiment' && !item.querySelector('.timeline-dot.experiment-dot')) show = false;
        }
        if (show && stage) {
            // check for stage id in onclick handler (quick heuristic)
            const onclick = item.getAttribute('onclick') || '';
            if (!onclick.includes(`showTimelineEventDetails('stage', ${stage}`) && !item.textContent.includes(stage)) show = false;
        }
        item.style.display = show ? '' : 'none';
    });
}

async function submitUsage(payload, silent = false) {
    try {
        const resp = await apiFetch('/api/usage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (resp.ok) {
            if (!silent) {
                showAlert('Usage logged', 'Success');
                if (currentProjectId) loadProjectUsage(currentProjectId);
                if (document.getElementById('project-components-list')) loadProjectComponents(currentProjectId);
                if (document.getElementById('project-documents-list')) loadProjectDocuments(currentProjectId);
            }
            return true;
        }
        return false;
    } catch (err) {
        console.error('Error submitting usage:', err);
        if (!silent) showAlert('Error logging usage', 'Error');
        return false;
    }
}


// Experiment stages management (simple create + list refresh)
async function loadExperimentStages(projectId = null, experimentId = null) {
    try {
        // Use project_stages endpoint for project stages, experiment_stages for experiment stages
        let endpoint, q;
        if (projectId) {
            endpoint = '/api/project_stages';
            q = `?project_id=${projectId}`;
        } else if (experimentId) {
            endpoint = '/api/experiment_stages';
            q = `?experiment_id=${experimentId}`;
        } else {
            // No context provided, don't load anything
            return;
        }
        const resp = await apiFetch(`${endpoint}${q}`);
        const data = await resp.json();
        const stages = (data && data.data) ? data.data : [];

        const globalHolder = document.getElementById('global-experiment-stages');
        const projectHolder = document.getElementById('project-experiment-stages');
        const html = stages.map(s => `
            <div style="padding:6px 8px; border-radius:6px; background:var(--surface); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                <span>${s.stage_name || s.name} — ${s.status || 'open'}</span>
                <button class="btn btn-sm btn-secondary" onclick="deleteStage(${s.id}, ${projectId || 'null'})">🗑️</button>
            </div>
        `).join('');
        if (globalHolder) globalHolder.innerHTML = html || '<div style="color:var(--text-muted)">No stages</div>';
        if (projectHolder) projectHolder.innerHTML = html || '<div style="color:var(--text-muted)">No stages</div>';
    } catch (err) {
        console.error('Error loading stages:', err);
    }
}

async function deleteStage(stageId, projectId = null) {
    if (!(await showConfirm('Delete this stage?'))) return;

    try {
        const response = await apiFetch(`/api/project_stages/${stageId}`, { method: 'DELETE' });
        if (response.ok) {
            loadExperimentStages(projectId);
            if (projectId) loadProjectTimeline(projectId);
            showAlert('Stage deleted successfully', 'Success');
        } else {
            showAlert('Failed to delete stage', 'Error');
        }
    } catch (error) {
        console.error('Error deleting stage:', error);
        showAlert('Error deleting stage', 'Error');
    }
}

function openManageExperimentStages(projectId = null, experimentId = null) {
    // Resolve experimentId from global context if not passed directly
    const resolvedExpId = experimentId || currentExperimentId || null;
    const resolvedProjId = projectId || null;

    showMultiField([
        { name: 'name', label: 'Stage Name', type: 'text', placeholder: 'e.g. Sample Preparation, Baseline Test…' },
        { name: 'owner', label: 'Owner (optional)', type: 'text', placeholder: 'Who runs this stage?' },
        { name: 'start_date', label: 'Start Date (optional)', type: 'text', placeholder: 'YYYY-MM-DD' },
        { name: 'end_date', label: 'End Date (optional)', type: 'text', placeholder: 'YYYY-MM-DD' },
        { name: 'notes', label: 'Notes (optional)', type: 'textarea', rows: 3 }
    ], resolvedProjId ? 'New Project Stage' : 'New Experiment Stage', 'Type a name for this stage:').then(async (res) => {
        if (!res || !res.name) return;
        const payload = {
            stage_name: res.name.trim(),
            owner: res.owner || null,
            start_time: res.start_date || null,
            end_time: res.end_date || null,
            notes: res.notes || ''
        };

        const endpoint = resolvedProjId ? '/api/project_stages' : '/api/experiment_stages';
        if (resolvedProjId) {
            payload.project_id = resolvedProjId;
        } else if (resolvedExpId) {
            payload.experiment_id = resolvedExpId;
        } else {
            showAlert('No experiment selected — open an experiment first before adding stages.', 'Error');
            return;
        }

        try {
            const r = await apiFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (r.ok) {
                showAlert('Stage created successfully', 'Success');
                // Reload the right list depending on context
                if (resolvedExpId) {
                    loadExperimentStagesList(resolvedExpId);
                } else if (resolvedProjId) {
                    loadExperimentStages(resolvedProjId);
                }
            } else {
                showAlert('Error creating stage', 'Error');
            }
        } catch (err) {
            console.error('Error creating stage:', err);
            showAlert('Error creating stage', 'Error');
        }
    }).catch(() => { });
}

// ensure stages are loaded when relevant pages open
document.addEventListener('DOMContentLoaded', () => {
    // Stages are now always scoped to experiments or projects, no global load needed
    checkInternetConnection();
    setInterval(checkInternetConnection, 30000); // Check every 30 seconds
});

async function checkInternetConnection() {
    const connectionDot = document.getElementById('connection-dot');
    const connectionIcon = document.getElementById('connection-icon');

    if (!connectionDot || !connectionIcon) return;

    try {
        // Use a fast, reliable endpoint with a low timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch('https://1.1.1.1', {
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // If we get here, we have internet connection
        connectionDot.className = 'status-dot green';
        connectionIcon.innerHTML = `
            <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
            <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
            <line x1="12" y1="20" x2="12.01" y2="20"></line>
        `;
    } catch (error) {
        // No internet connection
        connectionDot.className = 'status-dot red';
        connectionIcon.innerHTML = `
            <line x1="1" y1="1" x2="23" y2="23"></line>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
            <line x1="12" y1="20" x2="12.01" y2="20"></line>
        `;
    }
}

// Open modal to view stages for an experiment
async function openExperimentStagesModal(experimentId) {
    try {
        // Fetch stages for this specific experiment
        const resp = await apiFetch(`/api/experiment_stages?experiment_id=${experimentId}&limit=200`);
        const data = await resp.json();
        const stages = (data && data.data) ? data.data : [];

        if (!stages || stages.length === 0) {
            showAlert('No stages for this experiment yet. Click "+ Add Stage" to create one.', 'Info');
            return;
        }

        // Display stages in a simple alert for now
        const stageList = stages.map(s =>
            `- ${s.stage_name || s.name} (${s.status || 'not_started'})`
        ).join('\n');

        showAlert(`Stages for this experiment:\n\n${stageList}`, 'Experiment Stages');
    } catch (err) {
        console.error('Error viewing stages:', err);
        showAlert('Error viewing stages', 'Error');
    }
}

function clearExperimentFilters() {
    document.getElementById('experiment-search-input').value = '';
    document.getElementById('experiment-outcome-filter').value = '';
    document.getElementById('experiment-project-filter').value = '';
    document.getElementById('experiment-start-date').value = '';
    document.getElementById('experiment-end-date').value = '';
    filterExperiments();
}

function toggleExperiment(logId) {
    const card = document.getElementById(`experiment-${logId}`);
    card.classList.toggle('expanded');
    // If expanded, load the per-experiment timeline
    if (card.classList.contains('expanded')) {
        renderExperimentTimeline(logId).catch(err => console.error('Error rendering timeline:', err));
    }
}

async function renderExperimentTimeline(experimentId) {
    const card = document.getElementById(`experiment-${experimentId}`);
    if (!card) return;

    let timeline = card.querySelector('.experiment-timeline');
    if (!timeline) {
        timeline = document.createElement('div');
        timeline.className = 'experiment-timeline';
        timeline.style.marginTop = '12px';
        timeline.style.paddingTop = '8px';
        timeline.style.borderTop = '1px solid var(--border)';
        const body = card.querySelector('.experiment-card-body .experiment-card-content') || card.querySelector('.experiment-card-body');
        if (body) body.appendChild(timeline);
    }

    timeline.innerHTML = '<div style="color:var(--text-muted)">Loading timeline...</div>';

    try {
        const [stagesResp, usageResp] = await Promise.all([
            apiFetch(`/api/experiment_stages?experiment_id=${experimentId}&limit=200`),
            apiFetch(`/api/usage?experiment_id=${experimentId}&limit=100`)
        ]);
        // Fetch documents to display titles and thumbnails for attachments
        let docsById = {};
        try {
            const docsResp = await apiFetch('/api/documents');
            const docsData = await docsResp.json();
            const docsList = docsData.documents || [];
            docsList.forEach(d => { docsById[String(d.id)] = d; });
        } catch (e) {
            docsById = {};
        }
        const stagesData = await stagesResp.json();
        const usageData = await usageResp.json();
        const stages = (stagesData && stagesData.data) ? stagesData.data : [];
        // map stage id -> stage_name for quick lookup
        const stagesMap = {};
        stages.forEach(s => { stagesMap[String(s.id)] = s.stage_name || s.name || ''; });
        const usages = (usageData && usageData.data) ? usageData.data : [];

        const events = [];
        stages.forEach(s => {
            events.push({
                type: 'stage',
                id: s.id,
                timestamp: s.start_time || s.created_at || null,
                title: s.stage_name || 'Stage',
                subtitle: s.status || '',
                details: s.notes || '',
                owner: s.owner || '',
                attachments: s.attachments || null
            });
        });
        usages.forEach(u => {
            events.push({
                type: 'usage',
                id: u.id,
                timestamp: u.timestamp || u.created_at || null,
                title: `${u.entity_type || 'Item'} used`,
                subtitle: `${u.quantity_used || ''} ${u.unit || ''}`.trim(),
                details: u.notes || '',
                owner: u.user_id || '',
                stage_id: u.stage_id || null,
                stage_name: u.stage_id ? (stagesMap[String(u.stage_id)] || '') : ''
            });
        });

        // Sort events by timestamp (oldest first). If missing timestamp, push to end.
        events.sort((a, b) => {
            const ta = a.timestamp || '';
            const tb = b.timestamp || '';
            if (!ta && !tb) return 0;
            if (!ta) return 1;
            if (!tb) return -1;
            return ta.localeCompare(tb);
        });

        if (events.length === 0) {
            timeline.innerHTML = '<div style="color:var(--text-muted)">No timeline events</div>';
            return;
        }

        // cache events for quick lookup when user clicks
        window._timelineEventCache = window._timelineEventCache || {};
        timeline.innerHTML = events.map(ev => {
            const key = `${ev.type}:${ev.id}`;
            window._timelineEventCache[key] = ev;
            if (ev.type === 'stage') {
                // build attachments badges
                const attachmentsArr = (function (a) {
                    if (!a) return [];
                    if (Array.isArray(a)) return a;
                    if (typeof a === 'string') {
                        try { const parsed = JSON.parse(a); if (Array.isArray(parsed)) return parsed.map(x => (typeof x === 'object' && x.id) ? x.id : x); } catch (e) { }
                        return a.split(',').map(s => s.trim()).filter(Boolean);
                    }
                    return `
                        <div class="timeline-item" onclick="showTimelineEventDetails('stage', ${ev.id}, ${experimentId})">
                            <div class="timeline-dot stage-dot"></div>
                            <div class="timeline-content">
                                <div style="font-weight:600">${ev.title} ${ev.subtitle ? `— ${ev.subtitle}` : ''}</div>
                                <div style="font-size:13px; color:var(--text-secondary)">${ev.timestamp || ''} ${ev.owner ? `— ${ev.owner}` : ''}</div>
                                <div style="margin-top:6px">${ev.details}</div>
                                <div style="margin-top:8px">${attachmentsHtml}</div>
                                <div style="margin-top:8px"><button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); openLogUsageForStage(${ev.id}, ${experimentId}, ${currentProjectId || 'null'})">Log Usage</button></div>
                            </div>
                        </div>
                    `;
                    const ft = (doc && doc.file_type) ? String(doc.file_type).toLowerCase() : '';
                    if (ft.includes('image')) isImage = true;
                    // also check title/filename extension as fallback
                    if (!isImage && typeof title === 'string') {
                        const ext = title.split('.').pop().toLowerCase();
                        if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) isImage = true;
                    }

                    const thumbHtml = isImage ? `<img src="http://127.0.0.1:8000/api/documents/${id}/view" class="attachment-thumb">` : '';

                    return `<span class="attachment-badge" title="${escapeHtml(String(title))}" onclick="event.stopPropagation(); viewDocument(${id})">${thumbHtml}<span class="attachment-title">${escapeHtml(String(title))}</span><button class=\\"attachment-remove\\" onclick=\\"event.stopPropagation(); removeAttachmentFromStage(${ev.id}, ${experimentId}, ${id})\\">✖</button></span>`;
                }).join(' ');

                return `
                    <div class="timeline-item" onclick="showTimelineEventDetails('stage', ${ev.id}, ${experimentId})">
                        <div class="timeline-dot stage-dot"></div>
                        <div class="timeline-content">
                            <div style="font-weight:600">${ev.title} ${ev.subtitle ? `— ${ev.subtitle}` : ''}</div>
                            <div style="font-size:13px; color:var(--text-secondary)">${ev.timestamp || ''} ${ev.owner ? `— ${ev.owner}` : ''}</div>
                            <div style="margin-top:6px">${ev.details}</div>
                            <div style="margin-top:8px">${attachmentsHtml}</div>
                        </div>
                    </div>
                `;
            }
            return `
                <div class="timeline-item" onclick="showTimelineEventDetails('usage', ${ev.id}, ${experimentId})">
                    <div class="timeline-dot usage-dot"></div>
                    <div class="timeline-content">
                        <div style="font-weight:600">${ev.title} ${ev.subtitle ? `— ${ev.subtitle}` : ''}</div>
                        <div style="font-size:13px; color:var(--text-secondary)">${ev.timestamp || ''} ${ev.owner ? `— ${ev.owner}` : ''}</div>
                                <div style="margin-top:6px">${ev.details}</div>
                                ${ev.stage_name ? `<div style="margin-top:6px; font-size:12px; color:var(--text-secondary)">Stage: ${escapeHtml(ev.stage_name)}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error loading timeline data:', err);
        timeline.innerHTML = '<div style="color:var(--danger)">Failed to load timeline</div>';
    }
}

async function showTimelineEventDetails(type, id, experimentId) {
    try {
        const key = `project:${type}:${id}`;
        const ev = window._timelineEventCache && window._timelineEventCache[key];
        if (!ev) {
            showAlert('Event details not available', 'Error');
            return;
        }
        const title = type === 'stage' ? `Stage: ${ev.title}` : `Usage: ${ev.title}`;

        // Determine if this is a project stage or experiment stage
        const isProjectStage = currentProjectId && !experimentId;
        const apiCollectionUrl = type === 'stage'
            ? (isProjectStage
                ? `/api/project_stages?project_id=${currentProjectId}&limit=200`
                : `/api/experiment_stages?experiment_id=${experimentId}&limit=200`)
            : `/api/usage?experiment_id=${experimentId}&limit=200`;
        const apiResourceUrl = type === 'stage'
            ? (isProjectStage ? `/api/project_stages/${id}` : `/api/experiment_stages/${id}`)
            : `/api/usage/${id}`;

        // Fetch full item data from collection endpoint to obtain editable fields
        let item = {};
        try {
            const collectionResp = await apiFetch(apiCollectionUrl);
            const collectionData = await collectionResp.json();
            const items = (collectionData && collectionData.data) ? collectionData.data : [];
            item = items.find(x => x.id === id) || {};
        } catch (e) {
            console.warn('Failed to fetch from collection endpoint, trying direct endpoint:', e);
            // Fallback to direct endpoint if collection fails
            try {
                const resourceResp = await apiFetch(apiResourceUrl);
                const resourceData = await resourceResp.json();
                item = resourceData.data || resourceData || {};
            } catch (e2) {
                console.error('Failed to fetch from direct endpoint:', e2);
                item = {};
            }
        }

        if (!item || Object.keys(item).length === 0) {
            showAlert('Unable to load item details', 'Error');
            return;
        }

        if (type === 'stage') {
            // Fetch related notebook entries and documents for linking
            let notebookOptions = [];
            try {
                const nbResp = await apiFetch(`/api/notebook?experiment_id=${experimentId}`);
                const nbData = await nbResp.json();
                const entries = nbData.entries || [];
                notebookOptions = entries.map(e => ({ value: e.id, label: e.title }));
            } catch (e) {
                notebookOptions = [];
            }

            let documentDefault = (item.attachments && typeof item.attachments === 'string') ? item.attachments : (item.attachments ? JSON.stringify(item.attachments) : '');

            const fields = [
                { name: 'stage_name', label: 'Name', type: 'text', defaultValue: item.stage_name || ev.title },
                { name: 'status', label: 'Status', type: 'text', defaultValue: item.status || '' },
                { name: 'owner', label: 'Owner', type: 'text', defaultValue: item.owner || ev.owner || '' },
                { name: 'start_time', label: 'Start date', type: 'text', defaultValue: item.start_time || ev.timestamp || '' },
                { name: 'end_time', label: 'End date', type: 'text', defaultValue: item.end_time || '' },
                { name: 'attachments', label: 'Attachments', type: 'docpicker', defaultValue: documentDefault, placeholder: 'Pick from device or resources' },
                { name: 'linked_note_id', label: 'Link Note', type: 'select', options: notebookOptions, defaultValue: item.linked_note_id || '' },
                { name: 'notes', label: 'Notes', type: 'textarea', defaultValue: item.notes || ev.details || '', rows: 6 }
            ];

            showModal({
                type: 'multi', title: title, message: '', fields: fields, callback: async (values) => {
                    if (!values) return;
                    const payload = {
                        stage_name: values.stage_name,
                        status: values.status,
                        owner: values.owner,
                        start_time: values.start_time,
                        end_time: values.end_time,
                        notes: values.notes,
                        attachments: values.attachments,
                        linked_note_id: values.linked_note_id || null
                    };
                    try {
                        const updateUrl = isProjectStage ? `/api/project_stages/${id}` : `/api/experiment_stages/${id}`;
                        const r = await apiFetch(updateUrl, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        if (r.ok) {
                            showAlert('Stage updated', 'Success');
                            if (isProjectStage) {
                                loadProjectStages(currentProjectId);
                            } else {
                                loadExperimentStages(experimentId || currentProjectId);
                            }
                            renderExperimentTimeline(experimentId);
                        } else {
                            showAlert('Failed to update stage', 'Error');
                        }
                    } catch (err) {
                        console.error('Error updating stage:', err);
                        showAlert('Error updating stage', 'Error');
                    }
                }
            });
        } else {
            // usage
            // Fetch stages for the experiment to allow tying usage to a specific stage
            let stageOptions = [];
            try {
                const stResp = await apiFetch(`/api/experiment_stages?experiment_id=${experimentId}&limit=200`);
                const stData = await stResp.json();
                const stList = (stData && stData.data) ? stData.data : [];
                stageOptions = stList.map(s => ({ value: s.id, label: s.stage_name }));
            } catch (e) {
                stageOptions = [];
            }

            const fields = [
                { name: 'entity_type', label: 'Type', type: 'text', defaultValue: item.entity_type || ev.title },
                { name: 'entity_id', label: 'Item ID', type: 'text', defaultValue: item.entity_id || '' },
                { name: 'quantity_used', label: 'Quantity Used', type: 'text', defaultValue: item.quantity_used || '' },
                { name: 'unit', label: 'Unit', type: 'text', defaultValue: item.unit || '' },
                { name: 'stage_id', label: 'Stage', type: 'select', options: stageOptions, defaultValue: item.stage_id || '' },
                { name: 'post_use_status', label: 'Post-use status', type: 'text', defaultValue: item.post_use_status || '' },
                { name: 'notes', label: 'Notes', type: 'textarea', defaultValue: item.notes || ev.details || '', rows: 6 }
            ];

            showModal({
                type: 'multi', title: title, message: '', fields: fields, callback: async (values) => {
                    if (!values) return;
                    const payload = {
                        entity_type: values.entity_type,
                        entity_id: values.entity_id ? Number(values.entity_id) : null,
                        quantity_used: values.quantity_used ? Number(values.quantity_used) : null,
                        unit: values.unit,
                        stage_id: values.stage_id ? Number(values.stage_id) : null,
                        post_use_status: values.post_use_status,
                        notes: values.notes
                    };
                    try {
                        const r = await apiFetch(`/api/usage/${id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        if (r.ok) {
                            showAlert('Usage updated', 'Success');
                            if (currentProjectId) loadProjectUsage(currentProjectId);
                            renderExperimentTimeline(experimentId);
                        } else {
                            showAlert('Failed to update usage', 'Error');
                        }
                    } catch (err) {
                        console.error('Error updating usage:', err);
                        showAlert('Error updating usage', 'Error');
                    }
                }
            });
        }
    } catch (err) {
        console.error('Error showing event details:', err);
        showAlert('Unable to show event details', 'Error');
    }
}

async function removeAttachmentFromStage(stageId, experimentId, docId) {
    try {
        const confirm = await showConfirm('Remove this attachment from the stage?', 'Confirm removal');
        if (!confirm) return;
        // Fetch stage to get current attachments
        const resp = await apiFetch(`/api/experiment_stages?experiment_id=${experimentId}&limit=200`);
        const data = await resp.json();
        const items = (data && data.data) ? data.data : [];
        const stage = items.find(s => s.id === stageId);
        if (!stage) { showAlert('Stage not found', 'Error'); return; }

        let attachments = stage.attachments || '';
        let arr = [];
        if (Array.isArray(attachments)) arr = attachments.map(a => (typeof a === 'object' && a.id) ? a.id : a);
        else if (typeof attachments === 'string') {
            try { const parsed = JSON.parse(attachments); if (Array.isArray(parsed)) arr = parsed.map(a => (typeof a === 'object' && a.id) ? a.id : a); else arr = attachments.split(',').map(s => s.trim()).filter(Boolean); } catch (e) { arr = attachments.split(',').map(s => s.trim()).filter(Boolean); }
        }

        const newArr = arr.filter(x => String(x) !== String(docId));

        const payload = { attachments: newArr.join(',') };
        const r = await apiFetch(`/api/experiment_stages/${stageId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (r.ok) {
            showAlert('Attachment removed', 'Success');
            loadExperimentStages(experimentId || currentProjectId);
            renderExperimentTimeline(experimentId);
        } else {
            showAlert('Failed to remove attachment', 'Error');
        }
    } catch (err) {
        console.error('Error removing attachment:', err);
        showAlert('Error removing attachment', 'Error');
    }
}

async function fetchRawAPI(type, id, experimentId) {
    try {
        let url;
        if (type === 'stage') {
            url = `/api/experiment_stages?experiment_id=${experimentId}&limit=200`;
            const resp = await apiFetch(url);
            const data = await resp.json();
            const item = (data && data.data) ? data.data.find(s => s.id === id) : null;
            if (!item) {
                showAlert('Stage not found via API', 'Error');
                return;
            }
            showModal({ type: 'multi', title: `Stage ${id} JSON`, message: '', fields: [{ name: 'json', label: 'JSON', type: 'textarea', defaultValue: JSON.stringify(item, null, 2), rows: 12 }], callback: () => { } });
        } else {
            url = `/api/usage?experiment_id=${experimentId}&limit=200`;
            const resp = await apiFetch(url);
            const data = await resp.json();
            const item = (data && data.data) ? data.data.find(u => u.id === id) : null;
            if (!item) {
                showAlert('Usage entry not found via API', 'Error');
                return;
            }
            showModal({ type: 'multi', title: `Usage ${id} JSON`, message: '', fields: [{ name: 'json', label: 'JSON', type: 'textarea', defaultValue: JSON.stringify(item, null, 2), rows: 12 }], callback: () => { } });
        }
    } catch (err) {
        console.error('Error fetching raw API item:', err);
        showAlert('Error fetching raw API', 'Error');
    }
}

async function updateExperimentOutcome(logId, outcome, event) {
    event.stopPropagation();

    try {
        const response = await apiFetch(`/api/logs/${logId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outcome })
        });

        if (response.ok) {
            loadExperiments();
            if (currentProjectId) {
                loadProjectExperiments(currentProjectId);
            }
            showAlert('Outcome updated successfully', 'Success');
        } else {
            showAlert('Error updating outcome', 'Error');
        }
    } catch (error) {
        console.error('Error updating experiment outcome:', error);
    }
}

async function addExperiment() {
    const result = await showMultiField([
        { name: 'title', label: 'Experiment Title', type: 'text', placeholder: 'Enter experiment title...' },
        { name: 'description', label: 'Description', type: 'textarea', rows: 4, placeholder: 'Enter experiment description...' },
        { name: 'expected_outcome', label: 'Expected Outcome', type: 'textarea', rows: 2, placeholder: 'What do you expect to happen?' }
    ], 'New Experiment', 'Enter experiment details:');

    if (!result || !result.title) return;

    const { title, description, expected_outcome } = result;

    const payload = {
        log_title: title,
        log_text: description,
        expected_outcome: expected_outcome,
        outcome: 'PENDING'
    };

    if (currentProjectId) {
        payload.project_id = currentProjectId;
        const wsTitleEl = document.getElementById('project-workspace-title');
        if (wsTitleEl) {
            payload.project_name = wsTitleEl.textContent;
        }
    }

    try {
        const response = await apiFetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            loadExperiments();
            if (currentProjectId) {
                loadProjectExperiments(currentProjectId);
            }
            showAlert('Experiment added successfully', 'Success');
        } else {
            showAlert('Error adding experiment', 'Error');
        }
    } catch (error) {
        console.error('Error adding experiment:', error);
    }
}

async function createExperimentUnderStage(stageId) {
    const result = await showMultiField([
        { name: 'title', label: 'Experiment Title', type: 'text', placeholder: 'Enter experiment title...' },
        { name: 'description', label: 'Description', type: 'textarea', rows: 4, placeholder: 'Enter experiment description...' },
        { name: 'expected_outcome', label: 'Expected Outcome', type: 'textarea', rows: 2, placeholder: 'What do you expect to happen?' }
    ], 'Add Experiment', 'Create an experiment under this stage');
    if (!result || !result.title) return;
    const payload = {
        log_title: result.title,
        log_text: result.description || '',
        expected_outcome: result.expected_outcome || '',
        outcome: 'PENDING',
        stage_id: Number(stageId)
    };
    if (currentProjectId) {
        payload.project_id = currentProjectId;
        const wsTitleEl = document.getElementById('project-workspace-title');
        if (wsTitleEl) payload.project_name = wsTitleEl.textContent;
    }

    try {
        const response = await apiFetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            loadProjectTimeline(currentProjectId, 'project-overview-timeline-list');
            loadProjectExperiments(currentProjectId);
            refreshCurrentPage();
            showAlert('Experiment added under stage', 'Success');
        } else {
            showAlert('Error adding experiment', 'Error');
        }
    } catch (err) {
        console.error('Error creating experiment under stage:', err);
    }
}

// Documents
let currentDocumentFilter = 'all';
let isGridView = true;

async function loadDocuments() {
    try {
        // Fetch documents
        const docUrl = currentProjectId ? `/api/documents?project_id=${currentProjectId}` : '/api/documents';
        const docResponse = await apiFetch(docUrl);
        const docData = await docResponse.json();

        // Fetch notebook entries
        const notebookUrl = currentProjectId ? `/api/notebook?project_id=${currentProjectId}` : '/api/notebook';
        const notebookResponse = await apiFetch(notebookUrl);
        const notebookData = await notebookResponse.json();

        // Combine documents and notes
        const documents = docData.documents || [];
        const notes = notebookData.entries || [];

        // Add type field to distinguish
        const documentsWithType = documents.map(doc => ({ ...doc, type: 'document' }));
        const notesWithType = notes.map(note => ({ ...note, type: 'note', file_type: 'note' }));

        const allItems = [...documentsWithType, ...notesWithType];

        // Filter by file type (notes are always included when filter is 'all' or 'note')
        let filteredItems = allItems;
        if (currentDocumentFilter !== 'all') {
            filteredItems = allItems.filter(item => {
                if (item.type === 'note') {
                    return currentDocumentFilter === 'note';
                }
                const fileType = item.file_type?.toLowerCase() || '';
                return fileType.includes(currentDocumentFilter);
            });
        }

        if (isGridView) {
            renderDocumentsGrid(filteredItems);
        } else {
            renderDocumentsList(filteredItems);
        }
    } catch (error) {
        console.error('Error loading documents:', error);
    }
}

function renderDocumentsGrid(documents) {
    const grid = document.getElementById('documents-grid');
    const list = document.getElementById('documents-list');

    grid.style.display = 'grid';
    list.style.display = 'none';

    if (documents.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">No documents found</div>';
    } else {
        grid.innerHTML = documents.map(doc => {
            const isNote = doc.type === 'note';
            const fileType = (doc.file_type || '').toLowerCase();
            const isImage = !isNote && (fileType.includes('image') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].some(ext => fileType.includes(ext)));
            const isVideo = !isNote && (fileType.includes('video') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].some(ext => fileType.includes(ext)));

            let thumbnailHtml;
            if (isNote) {
                thumbnailHtml = `<div class="icon">📝</div>`;
            } else if (isImage) {
                thumbnailHtml = `<img src="http://127.0.0.1:8000/api/documents/${doc.id}/view" class="document-thumbnail" alt="${escapeHtml(doc.title)}">`;
            } else if (isVideo) {
                thumbnailHtml = `<video src="http://127.0.0.1:8000/api/documents/${doc.id}/view" class="document-thumbnail" muted></video>`;
            } else {
                const icon = getDocumentIcon(doc.file_type);
                thumbnailHtml = `<div class="icon">${icon}</div>`;
            }

            const clickHandler = isNote ? `loadNoteInEditor(${doc.id}, true)` : `viewDocument(${doc.id})`;
            const deleteHandler = isNote ? `deleteNotebookEntry(${doc.id})` : `deleteDocument(${doc.id})`;

            const displayDate = isNote ? (doc.created_at || 'No date') : (doc.upload_date || doc.created_at || 'No date');

            return `
                <div class="document-card" onclick="${clickHandler}" style="cursor: pointer;">
                    ${thumbnailHtml}
                    <div class="title">${doc.title}</div>
                    <div class="meta">${displayDate}</div>
                    <div class="meta">${isNote ? 'Note' : (doc.project_id ? 'Project linked' : 'No project')}</div>
                    <div class="tags">
                        ${doc.tags ? doc.tags.split(',').slice(0, 3).map(tag => `<span class="document-tag">${tag.trim()}</span>`).join('') : ''}
                    </div>
                    <div class="document-actions" onclick="event.stopPropagation()">
                        <button class="document-action-btn delete-btn" onclick="${deleteHandler}" title="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function renderDocumentsList(documents) {
    const grid = document.getElementById('documents-grid');
    const list = document.getElementById('documents-list');

    grid.style.display = 'none';
    list.style.display = 'block';

    if (documents.length === 0) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No documents found</div>';
    } else {
        list.innerHTML = documents.map(doc => {
            const isNote = doc.type === 'note';
            const fileType = (doc.file_type || '').toLowerCase();
            const isImage = !isNote && (fileType.includes('image') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].some(ext => fileType.includes(ext)));
            const isVideo = !isNote && (fileType.includes('video') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].some(ext => fileType.includes(ext)));

            let thumbnailHtml;
            if (isNote) {
                thumbnailHtml = `<span style="font-size: 24px;">📝</span>`;
            } else if (isImage) {
                thumbnailHtml = `<img src="http://127.0.0.1:8000/api/documents/${doc.id}/view" class="document-thumbnail-small" alt="${escapeHtml(doc.title)}">`;
            } else if (isVideo) {
                thumbnailHtml = `<video src="http://127.0.0.1:8000/api/documents/${doc.id}/view" class="document-thumbnail-small" muted></video>`;
            } else {
                const icon = getDocumentIcon(doc.file_type);
                thumbnailHtml = `<span style="font-size: 24px;">${icon}</span>`;
            }

            const clickHandler = isNote ? `loadNoteInEditor(${doc.id}, true)` : `viewDocument(${doc.id})`;
            const deleteHandler = isNote ? `deleteNotebookEntry(${doc.id})` : `deleteDocument(${doc.id})`;

            const displayDate = isNote ? (doc.created_at || 'No date') : (doc.upload_date || doc.created_at || 'No date');

            return `
                <div class="content-item" onclick="${clickHandler}" style="cursor: pointer;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        ${thumbnailHtml}
                        <div>
                            <div class="title">${doc.title}</div>
                            <div class="description">${isNote ? (doc.content?.substring(0, 100) || 'No description') : (doc.description || 'No description')}</div>
                            <div class="meta" style="font-size: 12px; color: var(--text-muted);">${displayDate}</div>
                        </div>
                    </div>
                    <button class="btn btn-secondary" onclick="event.stopPropagation(); ${deleteHandler}">🗑️</button>
                </div>
            `;
        }).join('');
    }
}

let currentDocumentId = null;
let currentMediaElement = null;

async function viewDocument(docId) {
    currentDocumentId = docId;
    const modal = document.getElementById('document-modal');
    const content = document.getElementById('document-modal-content');
    const title = document.getElementById('document-modal-title');

    // Show modal with loading state
    modal.classList.add('active');
    modal.classList.remove('minimized');
    document.getElementById('document-modal-minimized').classList.remove('active');
    content.innerHTML = `
        <div class="document-modal-loading">
            <div class="spinner"></div>
            <p>Loading document...</p>
        </div>
    `;

    try {
        // Fetch document metadata
        const response = await fetch(`http://127.0.0.1:8000/api/documents/${docId}/view`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        // Get document info
        const docResponse = await apiFetch('/api/documents');
        const docData = await docResponse.json();
        const doc = docData.documents.find(d => d.id === docId);

        if (doc) {
            title.textContent = doc.title;
        }

        // Detect file type and render preview
        const fileType = doc?.file_type || '';
        renderDocumentPreview(url, fileType, content);

    } catch (error) {
        console.error('Error loading document:', error);
        content.innerHTML = `
            <div style="text-align: center; color: var(--error-red);">
                <p>Error loading document</p>
                <button class="btn btn-secondary" onclick="downloadCurrentDocument()">Download Instead</button>
            </div>
        `;
    }
}

function renderDocumentPreview(url, fileType, container) {
    const type = fileType.toLowerCase();
    console.log('Rendering preview for file type:', type);

    if (type.includes('image') || type.includes('png') || type.includes('jpg') || type.includes('jpeg') || type.includes('gif') || type.includes('svg') || type.includes('bmp') || type.includes('webp')) {
        container.innerHTML = `<img src="${url}" alt="Document preview" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
    } else if (type.includes('pdf') || type === 'application/pdf') {
        container.innerHTML = `<iframe src="${url}" type="application/pdf" style="width: 100%; height: 100%; border: none;"></iframe>`;
    } else if (type.includes('video') || type.includes('mp4') || type.includes('webm') || type.includes('mov') || type.includes('avi') || type.includes('mkv')) {
        console.log('Creating video element for type:', fileType);
        console.log('Video URL:', url);
        console.log('File type:', fileType);

        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.height = '100%';
        container.style.width = '100%';
        container.style.minHeight = '400px';
        // Create video element programmatically to ensure proper attributes and event binding
        container.innerHTML = '';
        const videoEl = document.createElement('video');
        videoEl.controls = true;
        videoEl.autoplay = true;
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.style.width = '100%';
        videoEl.style.height = '100%';
        videoEl.style.objectFit = 'contain';

        const sourceEl = document.createElement('source');
        sourceEl.src = url;

        // Determine MIME type if possible. If fileType already looks like a mime (contains '/'), use it.
        if (fileType && fileType.includes('/')) {
            sourceEl.type = fileType;
        } else {
            // Try to guess common video mime types from extension-like values
            const ft = (fileType || '').toLowerCase();
            if (ft.includes('mp4') || ft === 'video/mp4') sourceEl.type = 'video/mp4';
            else if (ft.includes('webm') || ft === 'video/webm') sourceEl.type = 'video/webm';
            else if (ft.includes('ogg') || ft === 'video/ogg') sourceEl.type = 'video/ogg';
            // If unknown, omit `type` — browsers will attempt to play based on the src blob
        }

        videoEl.appendChild(sourceEl);
        container.appendChild(videoEl);
        currentMediaElement = videoEl;

        console.log('Video element created:', currentMediaElement);

        // Add comprehensive event listeners for debugging
        if (currentMediaElement) {
            currentMediaElement.addEventListener('loadstart', function () {
                console.log('Video loadstart');
            });

            currentMediaElement.addEventListener('loadedmetadata', function () {
                console.log('Video metadata loaded, dimensions:', currentMediaElement.videoWidth, 'x', currentMediaElement.videoHeight);
                console.log('Video duration:', currentMediaElement.duration);
            });

            currentMediaElement.addEventListener('loadeddata', function () {
                console.log('Video loadeddata');
            });

            currentMediaElement.addEventListener('canplay', function () {
                console.log('Video can play');
            });

            currentMediaElement.addEventListener('playing', function () {
                console.log('Video playing');
            });

            currentMediaElement.addEventListener('pause', function () {
                console.log('Video paused');
            });

            currentMediaElement.addEventListener('ended', function () {
                console.log('Video ended');
            });

            currentMediaElement.addEventListener('waiting', function () {
                console.log('Video waiting');
            });

            // Add error handling for video
            currentMediaElement.addEventListener('error', function (evt) {
                console.error('Video element error event:', evt);
                console.error('Video error object:', currentMediaElement.error);
                container.innerHTML = `
                    <div style="text-align: center;">
                        <p style="color: var(--error-red); margin-bottom: 16px;">Error playing video</p>
                        <button class="btn btn-primary" onclick="downloadCurrentDocument()">📥 Download File</button>
                    </div>
                `;
            });

            // Some browsers require explicit load() when sources are added programmatically
            try {
                currentMediaElement.load();
            } catch (err) {
                console.warn('Video load() threw:', err);
            }
        }
    } else if (type.includes('text') || type.includes('txt') || type === 'text/plain') {
        // Text file — fetch and display inline
        fetch(url)
            .then(r => r.text())
            .then(text => {
                const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                container.innerHTML = `
                    <div style="width:100%;height:100%;overflow:auto;padding:20px;box-sizing:border-box;">
                        <pre style="white-space:pre-wrap;word-break:break-word;font-family:'Courier New',monospace;font-size:13px;line-height:1.6;color:var(--text-primary);margin:0;">${escaped}</pre>
                    </div>
                `;
            })
            .catch(() => {
                container.innerHTML = `
                    <div style="text-align: center;">
                        <p style="color: var(--text-secondary); margin-bottom: 16px;">Could not load text file</p>
                        <button class="btn btn-primary" onclick="downloadCurrentDocument()">📥 Download File</button>
                    </div>
                `;
            });
    } else {
        console.log('No preview available for type:', type);
        container.innerHTML = `
            <div style="text-align: center;">
                <p style="color: var(--text-secondary); margin-bottom: 16px;">Preview not available for this file type (${fileType})</p>
                <button class="btn btn-primary" onclick="downloadCurrentDocument()">📥 Download File</button>
            </div>
        `;
    }
}

function closeDocumentModal() {
    const modal = document.getElementById('document-modal');
    const content = document.getElementById('document-modal-content');

    // Pause any media
    if (currentMediaElement) {
        currentMediaElement.pause();
        currentMediaElement = null;
    }

    // Clear content
    content.innerHTML = '';

    // Hide modal
    modal.classList.remove('active');
    modal.classList.remove('minimized');
    document.getElementById('document-modal-minimized').classList.remove('active');

    currentDocumentId = null;
}

function setModalAspectRatio(ratio) {
    const container = document.querySelector('.document-modal-container');
    container.classList.remove('aspect-original', 'aspect-wide', 'aspect-tall', 'aspect-full');
    container.classList.add(`aspect-${ratio}`);
}

function minimizeDocumentModal() {
    const modal = document.getElementById('document-modal');
    const minimized = document.getElementById('document-modal-minimized');

    console.log('MinimizeDocumentModal called, modal:', modal, 'minimized:', minimized);

    // Pause any media
    if (currentMediaElement) {
        currentMediaElement.pause();
    }

    // Hide modal container, show minimized icon
    modal.classList.add('minimized');
    minimized.classList.add('active');

    console.log('Modal classes after minimize:', modal.className);
    console.log('Minimized classes after minimize:', minimized.className);
    console.log('Minimized element display:', window.getComputedStyle(minimized).display);

    // Use setTimeout to ensure DOM is updated before initializing drag
    setTimeout(() => {
        console.log('Initializing drag after timeout');
        initializeDrag();
    }, 100);
}

function restoreDocumentModal() {
    const modal = document.getElementById('document-modal');
    const minimized = document.getElementById('document-modal-minimized');

    // Show modal container, hide minimized icon
    modal.classList.remove('minimized');
    minimized.classList.remove('active');

    // Resume media if it was playing
    if (currentMediaElement) {
        currentMediaElement.play();
    }
}

// Drag functionality for minimized icon
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let startX = 0;
let startY = 0;
let wasActuallyDragged = false;

function initializeDrag() {
    const minimizedIcon = document.getElementById('document-modal-minimized');
    if (!minimizedIcon) {
        console.error('Minimized icon not found in initializeDrag');
        return;
    }

    console.log('Initializing drag for minimized icon');
    console.log('Minimized icon element:', minimizedIcon);
    console.log('Minimized icon computed style:', window.getComputedStyle(minimizedIcon).display);
    console.log('Minimized icon pointer events:', window.getComputedStyle(minimizedIcon).pointerEvents);
    console.log('Minimized icon z-index:', window.getComputedStyle(minimizedIcon).zIndex);
    console.log('Minimized icon position:', window.getComputedStyle(minimizedIcon).position);
    console.log('Minimized icon bounds:', minimizedIcon.getBoundingClientRect());

    // Test if element is receiving any events
    minimizedIcon.addEventListener('mouseover', () => console.log('Mouse over minimized icon'));
    minimizedIcon.addEventListener('mouseenter', () => console.log('Mouse enter minimized icon'));

    // Remove existing event listeners to prevent duplicates
    minimizedIcon.removeEventListener('mousedown', startDrag);
    minimizedIcon.removeEventListener('touchstart', startDrag);
    minimizedIcon.removeEventListener('click', handleMinimizedClick);

    // Add fresh event listeners
    minimizedIcon.addEventListener('mousedown', startDrag);
    minimizedIcon.addEventListener('touchstart', startDrag, { passive: false });
    minimizedIcon.addEventListener('click', handleMinimizedClick);

    console.log('Drag initialized for minimized icon');
}

function handleMinimizedClick(e) {
    console.log('Minimized icon clicked, wasActuallyDragged:', wasActuallyDragged);
    // Only restore if it wasn't actually dragged
    if (!wasActuallyDragged) {
        console.log('Restoring modal from click handler');
        restoreDocumentModal();
    } else {
        console.log('Click ignored because element was dragged');
        wasActuallyDragged = false; // Reset the flag
    }
}

function startDrag(e) {
    console.log('startDrag called, event:', e);
    const clientX = (typeof e.clientX === 'number') ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX);
    const clientY = (typeof e.clientY === 'number') ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY);

    console.log('Coordinates:', clientX, clientY);

    if (clientX === undefined || clientX === null || clientY === undefined || clientY === null) {
        console.error('Invalid coordinates in startDrag');
        return;
    }

    startX = clientX;
    startY = clientY;
    wasActuallyDragged = false; // Reset flag at start of drag

    isDragging = true;
    const minimizedIcon = document.getElementById('document-modal-minimized');
    if (!minimizedIcon) {
        console.error('Minimized icon not found in startDrag');
        return;
    }

    const rect = minimizedIcon.getBoundingClientRect();

    dragOffsetX = clientX - rect.left;
    dragOffsetY = clientY - rect.top;

    minimizedIcon.style.cursor = 'grabbing';

    console.log('Drag started at:', clientX, clientY);

    // Attach drag listeners only when dragging starts
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', endDrag);
}

function drag(e) {
    if (!isDragging) return;

    const minimizedIcon = document.getElementById('document-modal-minimized');
    if (!minimizedIcon) {
        console.error('Minimized icon not found in drag');
        return;
    }

    const clientX = (typeof e.clientX === 'number') ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX);
    const clientY = (typeof e.clientY === 'number') ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY);

    if (clientX === undefined || clientX === null || clientY === undefined || clientY === null) {
        console.error('Invalid coordinates in drag');
        return;
    }

    const newX = clientX - dragOffsetX;
    const newY = clientY - dragOffsetY;

    // Keep icon within viewport bounds
    const maxX = window.innerWidth - minimizedIcon.offsetWidth;
    const maxY = window.innerHeight - minimizedIcon.offsetHeight;

    const constrainedX = Math.max(0, Math.min(newX, maxX));
    const constrainedY = Math.max(0, Math.min(newY, maxY));

    // Mark as dragged if position changed significantly
    const rect = minimizedIcon.getBoundingClientRect();
    const currentLeft = rect.left;
    const currentTop = rect.top;

    if (Math.abs(constrainedX - currentLeft) > 2 || Math.abs(constrainedY - currentTop) > 2) {
        wasActuallyDragged = true;
    }

    minimizedIcon.style.left = constrainedX + 'px';
    minimizedIcon.style.top = constrainedY + 'px';
    minimizedIcon.style.right = 'auto';
    minimizedIcon.style.bottom = 'auto';

    console.log('Dragging to:', constrainedX, constrainedY, 'wasActuallyDragged:', wasActuallyDragged);
}

function endDrag(e) {
    const clientX = (typeof e.clientX === 'number') ? e.clientX : (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientX);
    const clientY = (typeof e.clientY === 'number') ? e.clientY : (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientY);

    // Check if it was a drag (moved more than 5 pixels) or a click
    const movedDistance = Math.sqrt(Math.pow(clientX - startX, 2) + Math.pow(clientY - startY, 2));
    const wasDrag = movedDistance > 5;

    console.log('Drag ended, moved distance:', movedDistance, 'was drag:', wasDrag);
    console.log('Start position:', startX, startY, 'End position:', clientX, clientY);

    isDragging = false;
    const minimizedIcon = document.getElementById('document-modal-minimized');
    if (minimizedIcon) {
        minimizedIcon.style.cursor = 'grab';
    }

    // Remove drag listeners when dragging ends
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('touchend', endDrag);

    // If it wasn't a drag, restore the modal (click behavior)
    if (!wasDrag) {
        console.log('Restoring modal from click');
        restoreDocumentModal();
    } else {
        console.log('Was a drag, not restoring');
    }
}

async function downloadCurrentDocument() {
    if (!currentDocumentId) return;

    try {
        const response = await fetch(`http://127.0.0.1:8000/api/documents/${currentDocumentId}/view`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `document_${currentDocumentId}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading document:', error);
        showAlert('Error downloading document', 'Error');
    }
}

function getDocumentIcon(fileType) {
    const type = fileType?.toLowerCase() || '';
    if (type.includes('pdf')) return '📄';
    if (type.includes('image') || type.includes('png') || type.includes('jpg')) return '🖼️';
    if (type.includes('schematic') || type.includes('circuit')) return '📊';
    if (type.includes('datasheet')) return '📋';
    return '📁';
}

// Theme Toggle
document.addEventListener('DOMContentLoaded', () => {
    // Load saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        updateThemeIcon(true);
    }
    // Initialize AI panel state
    const aiPanel = document.getElementById('ai-panel');
    if (aiPanel && !aiPanel.classList.contains('collapsed')) {
        document.body.classList.add('ai-panel-open');
    }
    // Ensure minimized icon drag/click handlers are initialized
    try {
        initializeDrag();
    } catch (err) {
        console.error('Error initializing drag on DOMContentLoaded:', err);
    }
});

function toggleTheme() {
    const body = document.body;
    body.classList.toggle('light-theme');
    const isLight = body.classList.contains('light-theme');

    // Save preference to localStorage
    localStorage.setItem('theme', isLight ? 'light' : 'dark');

    // Update icon
    updateThemeIcon(isLight);
}

function updateThemeIcon(isLight) {
    const icon = document.getElementById('theme-icon');
    if (isLight) {
        // Moon icon for light theme (to switch to dark)
        icon.innerHTML = `
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        `;
    } else {
        // Sun icon for dark theme (to switch to light)
        icon.innerHTML = `
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        `;
    }
}

function toggleDocumentView() {
    isGridView = !isGridView;
    const toggleBtn = document.getElementById('view-toggle');
    toggleBtn.textContent = isGridView ? '📋 List View' : '🔲 Grid View';
    loadDocuments();
}

// Filter chip functionality
document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentDocumentFilter = chip.dataset.filter;
        loadDocuments();
    });
});

// File upload functionality
function toggleUploadDropdown(event) {
    // Find the dropdown menu associated with the clicked button
    const button = event.target.closest('.upload-dropdown').querySelector('.upload-dropdown-menu');
    const dropdowns = document.querySelectorAll('.upload-dropdown-menu');

    // Close all other dropdowns
    dropdowns.forEach(dropdown => {
        if (dropdown !== button) {
            dropdown.style.display = 'none';
        }
    });

    // Toggle the clicked dropdown
    if (button.style.display === 'block') {
        button.style.display = 'none';
    } else {
        button.style.display = 'block';
    }

    event.stopPropagation();
}

function triggerFileUpload() {
    // Close dropdowns
    const dropdowns = document.querySelectorAll('.upload-dropdown-menu');
    dropdowns.forEach(dropdown => {
        dropdown.style.display = 'none';
    });
    document.getElementById('document-file-input').click();
}

function triggerFolderUpload() {
    // Close dropdowns
    const dropdowns = document.querySelectorAll('.upload-dropdown-menu');
    dropdowns.forEach(dropdown => {
        dropdown.style.display = 'none';
    });
    document.getElementById('folder-file-input').click();
}

// Close dropdowns when clicking outside
document.addEventListener('click', (event) => {
    if (!event.target.closest('.upload-dropdown')) {
        const dropdowns = document.querySelectorAll('.upload-dropdown-menu');
        dropdowns.forEach(dropdown => {
            dropdown.style.display = 'none';
        });
    }
});

document.getElementById('document-file-input').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        uploadDocument(file);
    }
});

document.getElementById('folder-file-input').addEventListener('change', function (e) {
    const files = e.target.files;
    if (files && files.length > 0) {
        uploadFolder(files);
    }
});

async function uploadDocument(file) {
    // Use file name as title (remove extension)
    const title = file.name.replace(/\.[^/.]+$/, "");

    // Detect file type from MIME type or extension
    let file_type = 'document';
    const mimeType = file.type;
    const extension = file.name.split('.').pop().toLowerCase();

    if (mimeType.startsWith('image/')) {
        file_type = 'image';
    } else if (mimeType === 'application/pdf') {
        file_type = 'pdf';
    } else if (mimeType.startsWith('video/')) {
        file_type = 'video';
    } else if (extension === 'pdf') {
        file_type = 'pdf';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(extension)) {
        file_type = 'image';
    } else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension)) {
        file_type = 'video';
    } else if (['doc', 'docx'].includes(extension)) {
        file_type = 'document';
    } else if (['txt', 'md'].includes(extension)) {
        file_type = 'text';
    }

    try {
        // Show upload progress
        showAlert('Uploading document...', 'Info');

        console.log('[DEBUG] Starting upload via electronAPI.uploadFile');
        console.log('[DEBUG] File:', file.name, 'Size:', file.size);

        // Convert file to base64 for IPC transfer
        const fileData = await fileToBase64(file);

        // Prepare form data fields
        const formDataFields = {
            title: title,
            file_type: file_type,
            file_name: file.name,
            file_data: fileData
        };

        if (currentProjectId) {
            formDataFields.project_id = currentProjectId;
        }
        if (currentExperimentId) {
            formDataFields.experiment_id = currentExperimentId;
        }
        if (currentStageId) {
            formDataFields.stage_id = currentStageId;
        }

        // Use dedicated IPC upload handler
        const response = await window.electronAPI.uploadFile(formDataFields);

        const data = await response.json();
        showAlert('Document uploaded successfully', 'Success');
        loadDocuments();
        refreshDashboardInBackground();

        // Refresh current page content for instant feedback
        setTimeout(() => {
            refreshCurrentPage();
        }, 500);
    } catch (error) {
        console.error('Error uploading document:', error);
        showAlert('Error uploading document', 'Error');
    }

    // Reset file input
    document.getElementById('document-file-input').value = '';
}

// Helper function to convert file to base64
async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            // Remove data URL prefix if present
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function uploadFolder(files) {
    let uploadedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Use file name as title (remove extension)
        const title = file.name.replace(/\.[^/.]+$/, "");

        // Detect file type from MIME type or extension
        let file_type = 'document';
        const mimeType = file.type;
        const extension = file.name.split('.').pop().toLowerCase();

        if (mimeType.startsWith('image/')) {
            file_type = 'image';
        } else if (mimeType === 'application/pdf') {
            file_type = 'pdf';
        } else if (mimeType.startsWith('video/')) {
            file_type = 'video';
        } else if (extension === 'pdf') {
            file_type = 'pdf';
        } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(extension)) {
            file_type = 'image';
        } else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension)) {
            file_type = 'video';
        } else if (['doc', 'docx'].includes(extension)) {
            file_type = 'document';
        } else if (['txt', 'md'].includes(extension)) {
            file_type = 'text';
        }

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('title', title);
            formData.append('file_type', file_type);

            const response = await apiFetch('http://127.0.0.1:8000/api/documents', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                uploadedCount++;
            } else {
                failedCount++;
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            failedCount++;
        }
    }

    showAlert(`Folder upload complete: ${uploadedCount} uploaded, ${failedCount} failed`);
    loadDocuments();
    refreshDashboardInBackground();

    // Reset file input
    document.getElementById('folder-file-input').value = '';
}

async function deleteDocument(id) {
    if (!(await showConfirm('Delete this document?'))) return;

    try {
        const response = await apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadDocuments();
            refreshDashboardInBackground();
            refreshCurrentPage();
        }
    } catch (error) {
        console.error('Error deleting document:', error);
    }
}

// Notebook
let currentNoteId = null;
let autoSaveInterval = null;
let lastSavedContent = '';

async function loadNotebook() {
    // Initialize layout state based on sidebar
    const sidebar = document.querySelector('.notebook-sidebar');
    const layout = document.querySelector('.notebook-layout');
    if (sidebar && layout && sidebar.classList.contains('collapsed')) {
        layout.classList.add('sidebar-collapsed');
    }

    try {
        const response = await apiFetch('/api/notebook');
        const data = await response.json();

        const list = document.getElementById('notebook-list');
        if (data.entries.length === 0) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No notes yet</div>';
        } else {
            // Strip HTML from content for preview
            const stripHtml = (html) => {
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                return tmp.textContent || tmp.innerText || '';
            };

            // Escape HTML to prevent injection
            const escapeHtml = (text) => {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };

            list.innerHTML = data.entries.map(entry => {
                const plainContent = stripHtml(entry.content || '');
                const preview = plainContent.length > 50 ? plainContent.substring(0, 50) + '...' : plainContent;
                const escapedTitle = escapeHtml(entry.title || 'Untitled');
                const escapedPreview = escapeHtml(preview || 'No content');
                return `
                <div class="notebook-item ${currentNoteId === entry.id ? 'active' : ''}" onclick="loadNoteInEditor(${entry.id})">
                    <div class="title">${escapedTitle}</div>
                    <div class="preview">${escapedPreview}</div>
                </div>
            `}).join('');
        }

        // Populate experiment dropdown
        await populateExperimentDropdown();

        // Load draft from storage if no note is currently loaded
        if (!currentNoteId) {
            loadDraftFromStorage();
        }
    } catch (error) {
        console.error('Error loading notebook:', error);
    }
}

async function populateExperimentDropdown() {
    try {
        const response = await apiFetch('/api/logs');
        const data = await response.json();
        const select = document.getElementById('notebook-experiment-select');

        const logs = normalizeLogsResponse(data);
        if (select && logs && logs.length) {
            select.innerHTML = '<option value="">None</option>' +
                logs.map(log => `<option value="${log.id}">${log.log_title}</option>`).join('');
        }
    } catch (error) {
        console.error('Error populating experiment dropdown:', error);
    }
}

async function loadNoteInEditor(noteId, navigate = true) {
    currentNoteId = noteId;

    try {
        const response = await apiFetch(`/api/notebook/${noteId}`);
        const data = await response.json();
        const note = data.data;

        if (note) {
            document.getElementById('notebook-editor-title').value = note.title;
            document.getElementById('notebook-editor-title').dataset.noteId = noteId;

            // Detect raw markdown: if content doesn't start with an HTML tag,
            // treat it as markdown and parse it to rich HTML before displaying.
            let noteContent = note.content || '';
            const looksLikeHtml = /^\s*<[a-zA-Z]/.test(noteContent);
            if (!looksLikeHtml && noteContent.trim().length > 0) {
                noteContent = parseMarkdownAndMath(noteContent);
            }
            const editorEl = document.getElementById('notebook-editor-content');
            editorEl.innerHTML = noteContent;
            renderMath(editorEl);

            // Load drawing data if present
            if (note.drawing_data) {
                loadDrawingData(note.drawing_data);
            } else {
                shapes = [];
                if (canvas) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
            }

            // Update tags
            const tagsDiv = document.getElementById('notebook-tags');
            if (note.tags) {
                tagsDiv.innerHTML = note.tags.split(',').map(tag => `<span class="notebook-tag">${tag.trim()}</span>`).join('');
            } else {
                tagsDiv.innerHTML = '';
            }

            // Update active state in sidebar
            loadNotebook();
        }
    } catch (error) {
        console.error('Error loading note:', error);
    }
}

async function createNotebookEntry() {
    currentNoteId = null;
    document.getElementById('notebook-editor-title').value = '';
    document.getElementById('notebook-editor-title').dataset.noteId = '';
    document.getElementById('notebook-editor-content').innerHTML = '';
    document.getElementById('notebook-tags').innerHTML = '';
    document.getElementById('notebook-related').textContent = '';
    document.getElementById('notebook-experiment-select').value = '';
    lastSavedContent = '';

    // Clear drawing data
    shapes = [];
    if (canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Remove active state in sidebar
    document.querySelectorAll('.notebook-item').forEach(item => item.classList.remove('active'));

    // Show feedback
    const savedIndicator = document.getElementById('saved-indicator');
    if (savedIndicator) {
        savedIndicator.textContent = 'New note';
        savedIndicator.style.color = 'var(--accent-blue)';
        setTimeout(() => {
            savedIndicator.textContent = '';
        }, 2000);
    }

    // Start auto-save
    startAutoSave();
}

async function saveNotebookEntry() {
    const title = document.getElementById('notebook-editor-title').value;
    let content = document.getElementById('notebook-editor-content').innerHTML;
    const experimentSelect = document.getElementById('notebook-experiment-select');
    const experimentId = experimentSelect ? experimentSelect.value : null;
    const drawingData = saveDrawingData();
    const savedIndicator = document.getElementById('saved-indicator');

    if (!title) {
        showAlert('Please enter a title', 'Error');
        return;
    }

    // Show saving indicator
    if (savedIndicator) {
        savedIndicator.textContent = 'Saving...';
        savedIndicator.style.color = 'var(--accent-orange)';
    }

    // Append drawing representation to content if there are drawings/images
    // Only append if content doesn't already have an img tag
    if (drawingData && (shapes.length > 0 || images.length > 0) && !content.includes('<img')) {
        const drawingRepresentation = generateDrawingRepresentation();
        if (drawingRepresentation) {
            content = content + '\n\n' + drawingRepresentation;
        }
    }

    const payload = { title, content };
    if (experimentId) {
        payload.experiment_id = parseInt(experimentId);
    }
    if (drawingData) {
        payload.drawing_data = drawingData;
    }

    try {
        if (currentNoteId) {
            // Update existing note
            const response = await apiFetch(`/api/notebook/${currentNoteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                // Reload the note in the editor to show updated content
                await loadNoteInEditor(currentNoteId, false);
                loadNotebook();
                refreshDashboardInBackground();
                refreshCurrentPage();
                if (savedIndicator) {
                    savedIndicator.textContent = 'Saved';
                    savedIndicator.style.color = 'var(--accent-green)';
                    setTimeout(() => {
                        savedIndicator.textContent = '';
                    }, 2000);
                }
            } else if (response.status === 404) {
                // Note doesn't exist, treat as new note
                console.log('Note not found, creating new note instead');
                currentNoteId = null;
                // Retry as new note
                return saveNotebookEntry();
            } else {
                if (savedIndicator) {
                    savedIndicator.textContent = 'Failed to save';
                    savedIndicator.style.color = 'var(--accent-red)';
                }
                showAlert('Failed to save note', 'Error');
            }
        } else {
            // Create new note
            const response = await apiFetch('/api/notebook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                currentNoteId = data.id;
                document.getElementById('notebook-editor-title').dataset.noteId = data.id;
                loadNotebook();
                refreshDashboardInBackground();
                refreshCurrentPage();
                if (savedIndicator) {
                    savedIndicator.textContent = 'Note created';
                    savedIndicator.style.color = 'var(--accent-green)';
                    setTimeout(() => {
                        savedIndicator.textContent = '';
                    }, 2000);
                }
                showAlert('Note created successfully', 'Success');
            } else {
                if (savedIndicator) {
                    savedIndicator.textContent = 'Failed to create';
                    savedIndicator.style.color = 'var(--accent-red)';
                }
                showAlert('Failed to create note', 'Error');
            }
        }
    } catch (error) {
        console.error('Error saving note:', error);
        if (savedIndicator) {
            savedIndicator.textContent = 'Error';
            savedIndicator.style.color = 'var(--accent-red)';
        }
        showAlert('Error saving note', 'Error');
    }
}

function generateDrawingRepresentation() {
    if (shapes.length === 0 && images.length === 0) return null;

    let representation = '';

    // Add images as HTML img tags
    if (images.length > 0) {
        images.forEach((img, index) => {
            if (img.src) {
                representation += `<img src="${img.src}" alt="Drawing Image ${index + 1}" style="max-width: 100%; height: auto; margin: 10px 0;">\n\n`;
            }
        });
    }

    // If there are shapes, ensure canvas is rendered and convert to image
    if (shapes.length > 0 && canvas) {
        // Redraw canvas to ensure all shapes are rendered
        redrawCanvas();
        const canvasDataUrl = canvas.toDataURL('image/png');
        representation += `<img src="${canvasDataUrl}" alt="Drawing" style="max-width: 100%; height: auto; margin: 10px 0;">\n\n`;
    }

    return representation;
}

async function deleteCurrentNote() {
    if (!currentNoteId) {
        showAlert('No note selected', 'Error');
        return;
    }

    if (!(await showConfirm('Delete this note?'))) return;

    try {
        const response = await apiFetch(`/api/notebook/${currentNoteId}`, { method: 'DELETE' });
        if (response.ok) {
            showAlert('Note deleted successfully', 'Success');
            createNotebookEntry();
            loadNotebook();
        } else {
            showAlert('Failed to delete note', 'Error');
        }
    } catch (error) {
        console.error('Error deleting note:', error);
        showAlert('Error deleting note', 'Error');
    }
}

function insertMarkdown(before, after) {
    const editor = document.getElementById('notebook-editor-content');
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);

    const selectedText = range.toString();
    const newText = before + selectedText + after;

    if (selectedText) {
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));
    } else {
        range.insertNode(document.createTextNode(newText));
    }

    editor.focus();
}

function insertVoiceNote() {
    const editor = document.getElementById('notebook-editor-content');
    const voiceNote = '\n\n🎤 Voice Note: [Transcription would appear here]\n';
    editor.innerHTML += voiceNote;
    editor.focus();
}

// Notebook search
document.getElementById('notebook-search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const items = document.querySelectorAll('.notebook-item');

    items.forEach(item => {
        const title = item.querySelector('.title').textContent.toLowerCase();
        const preview = item.querySelector('.preview').textContent.toLowerCase();

        if (title.includes(searchTerm) || preview.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
});

// Components
async function loadComponents() {
    try {
        const response = await apiFetch('/api/components');
        const data = await response.json();

        const list = document.getElementById('components-list');
        if (data.components.length === 0) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No components yet</div>';
        } else {
            list.innerHTML = data.components.map(comp => {
                const statusColor = comp.quantity <= comp.min_quantity ? 'red' : (comp.quantity <= comp.min_quantity * 2 ? 'yellow' : 'green');
                return `
                <div class="content-item">
                    <div>
                        <div class="title">${comp.name}</div>
                        <div class="description">Qty: ${comp.quantity} | ${comp.part_number || 'No part number'}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span class="status-dot ${statusColor}"></span>
                        <button class="btn btn-sm ai-review-btn" onclick="showAlternatesModal('${comp.name} - ${comp.part_number || ''}')">🔍 Find Alternates</button>
                        <button class="btn btn-secondary" onclick="deleteComponent(${comp.id})">🗑️</button>
                    </div>
                </div>
            `}).join('');
        }
    } catch (error) {
        console.error('Error loading components:', error);
    }
}

async function addComponent() {
    const result = await showMultiField([
        { name: 'name', label: 'Component Name', type: 'text', placeholder: 'Enter component name...' },
        { name: 'part_number', label: 'Part Number', type: 'text', placeholder: 'Enter part number...' },
        { name: 'quantity', label: 'Quantity', type: 'number', placeholder: '0', defaultValue: '0' }
    ], 'Add Component', 'Enter component details:');

    if (!result || !result.name) return;

    const { name, part_number, quantity } = result;

    try {
        const response = await apiFetch('/api/components', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, part_number, quantity: parseInt(quantity) || 0 })
        });

        if (response.ok) {
            loadComponents();
            refreshDashboardInBackground();
            showAlert('Component added successfully', 'Success');
        } else {
            showAlert('Error adding component', 'Error');
        }
    } catch (error) {
        console.error('Error adding component:', error);
    }
}

async function deleteComponent(id) {
    if (!(await showConfirm('Delete this component?'))) return;

    try {
        const response = await apiFetch(`/api/components/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadComponents();
            refreshDashboardInBackground();
        }
    } catch (error) {
        console.error('Error deleting component:', error);
    }
}

// Equipment
async function loadEquipment() {
    try {
        const response = await apiFetch('/api/equipment');
        const data = await response.json();

        const list = document.getElementById('equipment-list');
        if (data.equipment.length === 0) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No equipment yet</div>';
        } else {
            list.innerHTML = data.equipment.map(eq => {
                const statusColor = eq.status === 'available' ? 'green' : (eq.status === 'maintenance' ? 'red' : 'yellow');
                return `
                <div class="content-item">
                    <div>
                        <div class="title">${eq.name}</div>
                        <div class="description">${eq.model || 'No model'} | Status: ${eq.status}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span class="status-dot ${statusColor}"></span>
                        <button class="btn btn-secondary" onclick="deleteEquipment(${eq.id})">🗑️</button>
                    </div>
                </div>
            `}).join('');
        }
    } catch (error) {
        console.error('Error loading equipment:', error);
    }
}

async function addEquipment() {
    const result = await showMultiField([
        { name: 'name', label: 'Equipment Name', type: 'text', placeholder: 'Enter equipment name...' },
        { name: 'model', label: 'Model', type: 'text', placeholder: 'Enter model...' }
    ], 'Add Equipment', 'Enter equipment details:');

    if (!result || !result.name) return;

    const { name, model } = result;

    try {
        const response = await apiFetch('/api/equipment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, model })
        });

        if (response.ok) {
            loadEquipment();
            refreshDashboardInBackground();
            showAlert('Equipment added successfully', 'Success');
        } else {
            showAlert('Error adding equipment', 'Error');
        }
    } catch (error) {
        console.error('Error adding equipment:', error);
    }
}

async function deleteEquipment(id) {
    if (!(await showConfirm('Delete this equipment?'))) return;

    try {
        const response = await apiFetch(`/api/equipment/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadEquipment();
            refreshDashboardInBackground();
        }
    } catch (error) {
        console.error('Error deleting equipment:', error);
    }
}

// Findings
async function loadFindings() {
    try {
        const response = await apiFetch('/api/findings');
        const data = await response.json();

        const list = document.getElementById('findings-list');
        if (data.findings.length === 0) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No findings yet</div>';
        } else {
            list.innerHTML = data.findings.map(finding => `
                <div class="content-item">
                    <div>
                        <div class="title">${finding.title}</div>
                        <div class="description">${finding.description.substring(0, 100)}...</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <button class="btn btn-sm ai-review-btn" onclick="showFailureDiagnosisModal('${finding.description.substring(0, 200)}')">🔍 Debug with Gemini</button>
                        <button class="btn btn-secondary" onclick="deleteFinding(${finding.id})">🗑️</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading findings:', error);
    }
}

async function addFinding() {
    let stageOptions = [{ value: '', label: 'None' }];
    if (currentProjectId) {
        try {
            // First fetch project's experiments to know which stages belong to this project
            const expResp = await apiFetch(`/api/logs?project_id=${currentProjectId}&limit=200`);
            const expData = await expResp.json();
            const experiments = expData.data || [];
            const expIds = experiments.map(e => e.id);

            // Fetch all stages
            const stResp = await apiFetch(`/api/experiment_stages?limit=200`);
            const stData = await stResp.json();
            const stages = stData.data || [];

            // Filter stages by experiment IDs belonging to the project
            stages.forEach(s => {
                if (expIds.includes(s.experiment_id)) {
                    const exp = experiments.find(e => e.id === s.experiment_id);
                    const expTitle = exp ? exp.log_title : `Exp ${s.experiment_id}`;
                    stageOptions.push({
                        value: `${s.experiment_id}:${s.id}`,
                        label: `${s.stage_name || 'Stage'} (${expTitle})`
                    });
                }
            });
        } catch (err) {
            console.error('Error loading stages for finding:', err);
        }
    }

    if (currentExperimentId) {
        try {
            const stResp = await apiFetch(`/api/experiment_stages?experiment_id=${currentExperimentId}&limit=200`);
            const stData = await stResp.json();
            const stages = stData.data || [];
            stageOptions = [{ value: '', label: 'None' }];
            stages.forEach(s => {
                stageOptions.push({
                    value: `${currentExperimentId}:${s.id}`,
                    label: s.stage_name || 'Stage'
                });
            });
        } catch (err) {
            console.error('Error loading stages for finding:', err);
        }
    }

    const fields = [
        { name: 'title', label: 'Finding Title', type: 'text', placeholder: 'Enter finding title...' },
        { name: 'description', label: 'Description', type: 'textarea', rows: 3, placeholder: 'Enter description...' },
        {
            name: 'finding_type', label: 'Type', type: 'select', placeholder: 'Select type...', options: [
                { value: 'discovery', label: 'Discovery' },
                { value: 'problem', label: 'Problem' },
                { value: 'lesson', label: 'Lesson' }
            ]
        }
    ];

    if (stageOptions.length > 1) {
        fields.push({
            name: 'stage_info',
            label: 'Link to Experiment Stage',
            type: 'select',
            options: stageOptions,
            placeholder: 'Link to a stage...'
        });
    }

    const result = await showMultiField(fields, 'Add Finding', 'Enter finding details:');

    if (!result || !result.title || !result.description) return;

    const { title, description, finding_type, stage_info } = result;

    try {
        const payload = { title, description, finding_type };
        if (currentProjectId) {
            payload.project_id = currentProjectId;
            const wsTitleEl = document.getElementById('project-workspace-title');
            if (wsTitleEl) payload.project_name = wsTitleEl.textContent;
        }

        if (stage_info) {
            const [expId, stageId] = stage_info.split(':');
            payload.experiment_id = parseInt(expId, 10);
            payload.stage_id = parseInt(stageId, 10);
        } else if (currentExperimentId) {
            payload.experiment_id = currentExperimentId;
        }

        const response = await apiFetch('/api/findings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            loadFindings();
            refreshDashboardInBackground();
            if (currentProjectId) {
                loadProjectFindings(currentProjectId);
            }
            showAlert('Finding added successfully', 'Success');
        } else {
            showAlert('Error adding finding', 'Error');
        }
    } catch (error) {
        console.error('Error adding finding:', error);
    }
}

async function deleteFinding(id) {
    if (!(await showConfirm('Delete this finding?'))) return;

    try {
        const response = await apiFetch(`/api/findings/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadFindings();
            refreshDashboardInBackground();
        }
    } catch (error) {
        console.error('Error deleting finding:', error);
    }
}

// Toolbox Calculators
async function calculateOhmsLaw() {
    const voltage = parseFloat(document.getElementById('ohms_voltage').value);
    const current = parseFloat(document.getElementById('ohms_current').value);
    const resistance = parseFloat(document.getElementById('ohms_resistance').value);

    const provided = [voltage, current, resistance].filter(v => !isNaN(v)).length;
    if (provided !== 2) {
        showAlert('Please provide exactly 2 values', 'Error');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/ohms_law', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voltage, current, resistance })
        });
        const data = await response.json();
        document.getElementById('ohms_result').innerHTML = `
            <strong>Results:</strong><br>
            Voltage: ${data.result.voltage?.toFixed(2) || 'N/A'} V<br>
            Current: ${data.result.current?.toFixed(2) || 'N/A'} A<br>
            Resistance: ${data.result.resistance?.toFixed(2) || 'N/A'} Ω<br>
            Power: ${data.result.power?.toFixed(2) || 'N/A'} W
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateVoltageDivider() {
    const vin = parseFloat(document.getElementById('vd_vin').value);
    const r1 = parseFloat(document.getElementById('vd_r1').value);
    const r2 = parseFloat(document.getElementById('vd_r2').value);

    if (isNaN(vin) || isNaN(r1) || isNaN(r2)) {
        showAlert('Please provide all values', 'Error');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/voltage_divider', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vin, r1, r2 })
        });
        const data = await response.json();
        document.getElementById('vd_result').innerHTML = `
            <strong>Results:</strong><br>
            Vout: ${data.result.vout.toFixed(2)} V<br>
            Current: ${data.result.current.toFixed(4)} A<br>
            Power R1: ${data.result.power_r1.toFixed(4)} W<br>
            Power R2: ${data.result.power_r2.toFixed(4)} W
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateLEDResistor() {
    const vs = parseFloat(document.getElementById('led_vs').value);
    const vf = parseFloat(document.getElementById('led_vf').value);
    const if_current = parseFloat(document.getElementById('led_if').value);

    if (isNaN(vs) || isNaN(vf) || isNaN(if_current)) {
        showAlert('Please provide all values');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/led_resistor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vs, vf, if_current })
        });
        const data = await response.json();
        document.getElementById('led_result').innerHTML = `
            <strong>Results:</strong><br>
            Calculated: ${data.result.calculated_resistor.toFixed(2)} Ω<br>
            Standard: ${data.result.closest_standard_resistor} Ω<br>
            Power: ${data.result.power.toFixed(4)} W<br>
            Recommended Power: ${data.result.recommended_power_rating.toFixed(4)} W
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateBatteryRuntime() {
    const capacity = parseFloat(document.getElementById('bat_capacity').value);
    const current = parseFloat(document.getElementById('bat_current').value);

    if (isNaN(capacity) || isNaN(current)) {
        showAlert('Please provide all values');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/battery_runtime', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ capacity_mah: capacity, current_ma: current })
        });
        const data = await response.json();
        document.getElementById('bat_result').innerHTML = `
            <strong>Results:</strong><br>
            Runtime: ${data.result.runtime_formatted}
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateRCTimeConstant() {
    const resistance = parseFloat(document.getElementById('rc_resistance').value);
    const capacitance = parseFloat(document.getElementById('rc_capacitance').value);

    if (isNaN(resistance) || isNaN(capacitance)) {
        showAlert('Please provide all values');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/rc_time_constant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resistance, capacitance })
        });
        const data = await response.json();
        document.getElementById('rc_result').innerHTML = `
            <strong>Results:</strong><br>
            Time Constant: ${data.result.time_constant.toFixed(6)} s<br>
            Charge Time (5τ): ${data.result.charge_time_5tau.toFixed(6)} s<br>
            Time Constant (ms): ${data.result.time_constant_ms.toFixed(3)} ms
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateLCResonantFrequency() {
    const inductance = parseFloat(document.getElementById('lc_inductance').value);
    const capacitance = parseFloat(document.getElementById('lc_capacitance').value);

    if (isNaN(inductance) || isNaN(capacitance)) {
        showAlert('Please provide all values');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/lc_resonant_frequency', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inductance, capacitance })
        });
        const data = await response.json();
        document.getElementById('lc_result').innerHTML = `
            <strong>Results:</strong><br>
            Resonant Frequency: ${data.result.resonant_frequency.toFixed(2)} Hz<br>
            Resonant Frequency (kHz): ${data.result.resonant_frequency_khz.toFixed(3)} kHz<br>
            Period: ${data.result.period.toFixed(6)} s
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateCapacitorEnergy() {
    const capacitance = parseFloat(document.getElementById('cap_capacitance').value);
    const voltage = parseFloat(document.getElementById('cap_voltage').value);

    if (isNaN(capacitance) || isNaN(voltage)) {
        showAlert('Please provide all values');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/capacitor_energy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ capacitance, voltage })
        });
        const data = await response.json();
        document.getElementById('cap_result').innerHTML = `
            <strong>Results:</strong><br>
            Energy: ${data.result.energy_joules.toFixed(6)} J<br>
            Energy (mJ): ${data.result.energy_millijoules.toFixed(3)} mJ
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateInductorEnergy() {
    const inductance = parseFloat(document.getElementById('ind_inductance').value);
    const current = parseFloat(document.getElementById('ind_current').value);

    if (isNaN(inductance) || isNaN(current)) {
        showAlert('Please provide all values');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/inductor_energy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inductance, current })
        });
        const data = await response.json();
        document.getElementById('ind_result').innerHTML = `
            <strong>Results:</strong><br>
            Energy: ${data.result.energy_joules.toFixed(6)} J<br>
            Energy (mJ): ${data.result.energy_millijoules.toFixed(3)} mJ
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateRLCImpedance() {
    const resistance = parseFloat(document.getElementById('rlc_resistance').value);
    const inductance = parseFloat(document.getElementById('rlc_inductance').value);
    const capacitance = parseFloat(document.getElementById('rlc_capacitance').value);
    const frequency = parseFloat(document.getElementById('rlc_frequency').value);

    if (isNaN(resistance) || isNaN(inductance) || isNaN(capacitance) || isNaN(frequency)) {
        showAlert('Please provide all values');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/rlc_impedance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resistance, inductance, capacitance, frequency })
        });
        const data = await response.json();
        document.getElementById('rlc_result').innerHTML = `
            <strong>Results:</strong><br>
            Impedance: ${data.result.impedance.toFixed(2)} Ω<br>
            Inductive Reactance: ${data.result.inductive_reactance.toFixed(2)} Ω<br>
            Capacitive Reactance: ${data.result.capacitive_reactance.toFixed(2)} Ω<br>
            Phase Angle: ${data.result.phase_angle_degrees.toFixed(2)}°
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculatePWMDutyCycle() {
    const onTime = parseFloat(document.getElementById('pwm_on_time').value);
    const period = parseFloat(document.getElementById('pwm_period').value);

    if (isNaN(onTime) || isNaN(period)) {
        showAlert('Please provide all values');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/pwm_duty_cycle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ on_time: onTime, period })
        });
        const data = await response.json();
        document.getElementById('pwm_result').innerHTML = `
            <strong>Results:</strong><br>
            Duty Cycle: ${data.result.duty_cycle_percent.toFixed(2)}%<br>
            Frequency: ${data.result.frequency.toFixed(2)} Hz
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateGearRatio() {
    const driver = parseInt(document.getElementById('gear_driver').value);
    const driven = parseInt(document.getElementById('gear_driven').value);

    if (isNaN(driver) || isNaN(driven)) {
        showAlert('Please provide all values');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/gear_ratio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teeth_driver: driver, teeth_driven: driven })
        });
        const data = await response.json();
        document.getElementById('gear_result').innerHTML = `
            <strong>Results:</strong><br>
            Gear Ratio: ${data.result.gear_ratio.toFixed(2)}:1<br>
            Speed Ratio: ${data.result.speed_ratio.toFixed(2)}:1<br>
            Torque Ratio: ${data.result.torque_ratio.toFixed(2)}:1
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateTorque() {
    const force = parseFloat(document.getElementById('torque_force').value);
    const radius = parseFloat(document.getElementById('torque_radius').value);
    const angle = parseFloat(document.getElementById('torque_angle').value) || 90;

    if (isNaN(force) || isNaN(radius)) {
        showAlert('Please provide force and radius');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/torque', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force, radius, angle })
        });
        const data = await response.json();
        document.getElementById('torque_result').innerHTML = `
            <strong>Results:</strong><br>
            Torque: ${data.result.torque.toFixed(4)} Nm
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateAngularVelocity() {
    const rpm = parseFloat(document.getElementById('angular_rpm').value);

    if (isNaN(rpm)) {
        showAlert('Please provide RPM');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/angular_velocity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rpm })
        });
        const data = await response.json();
        document.getElementById('angular_result').innerHTML = `
            <strong>Results:</strong><br>
            Angular Velocity: ${data.result.angular_velocity_rad_s.toFixed(2)} rad/s<br>
            Frequency: ${data.result.frequency_hz.toFixed(2)} Hz
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateThermalResistance() {
    const tempRise = parseFloat(document.getElementById('thermal_temp_rise').value);
    const power = parseFloat(document.getElementById('thermal_power').value);

    if (isNaN(tempRise) || isNaN(power)) {
        showAlert('Please provide all values');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/thermal_resistance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ temperature_rise: tempRise, power })
        });
        const data = await response.json();
        document.getElementById('thermal_result').innerHTML = `
            <strong>Results:</strong><br>
            Thermal Resistance: ${data.result.thermal_resistance.toFixed(2)} °C/W
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateHeatDissipation() {
    const thermalResistance = parseFloat(document.getElementById('heat_thermal_resistance').value);
    const power = parseFloat(document.getElementById('heat_power').value);

    if (isNaN(thermalResistance) || isNaN(power)) {
        showAlert('Please provide all values');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/heat_dissipation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thermal_resistance: thermalResistance, power })
        });
        const data = await response.json();
        document.getElementById('heat_result').innerHTML = `
            <strong>Results:</strong><br>
            Temperature Rise: ${data.result.temperature_rise.toFixed(2)} °C
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateTemperatureRise() {
    const ambientTemp = parseFloat(document.getElementById('temp_ambient').value);
    const power = parseFloat(document.getElementById('temp_power').value);
    const thermalResistance = parseFloat(document.getElementById('temp_thermal_resistance').value);

    if (isNaN(ambientTemp) || isNaN(power) || isNaN(thermalResistance)) {
        showAlert('Please provide all values');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/temperature_rise', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ambient_temp: ambientTemp, power, thermal_resistance: thermalResistance })
        });
        const data = await response.json();
        document.getElementById('temp_result').innerHTML = `
            <strong>Results:</strong><br>
            Final Temperature: ${data.result.final_temp.toFixed(2)} °C<br>
            Temperature Rise: ${data.result.temperature_rise.toFixed(2)} °C
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateDecibel() {
    const powerRatio = parseFloat(document.getElementById('db_power_ratio').value);
    const reference = document.getElementById('db_reference').value;

    if (isNaN(powerRatio)) {
        showAlert('Please provide power ratio');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/decibel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ power_ratio, reference: reference ? parseFloat(reference) : null })
        });
        const data = await response.json();
        let html = `<strong>Results:</strong><br>dB: ${data.result.db.toFixed(2)} dB`;
        if (data.result.db_absolute !== undefined) {
            html += `<br>Absolute dB: ${data.result.db_absolute.toFixed(2)} dB`;
        }
        document.getElementById('db_result').innerHTML = html;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateFrequencyToWavelength() {
    const frequency = parseFloat(document.getElementById('freq_frequency').value);

    if (isNaN(frequency)) {
        showAlert('Please provide frequency');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/frequency_to_wavelength', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ frequency })
        });
        const data = await response.json();
        document.getElementById('freq_result').innerHTML = `
            <strong>Results:</strong><br>
            Wavelength: ${data.result.wavelength_m.toFixed(6)} m<br>
            Wavelength (cm): ${data.result.wavelength_cm.toFixed(2)} cm<br>
            Wavelength (mm): ${data.result.wavelength_mm.toFixed(2)} mm
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateBaudRate() {
    const bitRate = parseFloat(document.getElementById('baud_bit_rate').value);
    const bitsPerSymbol = parseInt(document.getElementById('baud_bits_per_symbol').value) || 8;

    if (isNaN(bitRate)) {
        showAlert('Please provide bit rate');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/baud_rate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bit_rate: bitRate, bits_per_symbol: bitsPerSymbol })
        });
        const data = await response.json();
        document.getElementById('baud_result').innerHTML = `
            <strong>Results:</strong><br>
            Baud Rate: ${data.result.baud_rate.toFixed(2)} bps<br>
            Baud Rate (kbps): ${data.result.baud_rate_kbps.toFixed(3)} kbps
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function convertLength() {
    const value = parseFloat(document.getElementById('length_value').value);
    const fromUnit = document.getElementById('length_from').value;
    const toUnit = document.getElementById('length_to').value;

    if (isNaN(value)) {
        showAlert('Please provide value');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/convert_length', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value, from_unit: fromUnit, to_unit: toUnit })
        });
        const data = await response.json();
        document.getElementById('length_result').innerHTML = `
            <strong>Result:</strong> ${data.result.result.toFixed(6)} ${toUnit}
        `;
    } catch (error) {
        console.error('Error converting:', error);
    }
}

async function convertMass() {
    const value = parseFloat(document.getElementById('mass_value').value);
    const fromUnit = document.getElementById('mass_from').value;
    const toUnit = document.getElementById('mass_to').value;

    if (isNaN(value)) {
        showAlert('Please provide value');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/convert_mass', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value, from_unit: fromUnit, to_unit: toUnit })
        });
        const data = await response.json();
        document.getElementById('mass_result').innerHTML = `
            <strong>Result:</strong> ${data.result.result.toFixed(6)} ${toUnit}
        `;
    } catch (error) {
        console.error('Error converting:', error);
    }
}

async function convertTemperature() {
    const value = parseFloat(document.getElementById('temp_conv_value').value);
    const fromUnit = document.getElementById('temp_conv_from').value;
    const toUnit = document.getElementById('temp_conv_to').value;

    if (isNaN(value)) {
        showAlert('Please provide value');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/convert_temperature', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value, from_unit: fromUnit, to_unit: toUnit })
        });
        const data = await response.json();
        document.getElementById('temp_conv_result').innerHTML = `
            <strong>Result:</strong> ${data.result.result.toFixed(2)} ${toUnit}
        `;
    } catch (error) {
        console.error('Error converting:', error);
    }
}

async function convertPressure() {
    const value = parseFloat(document.getElementById('pressure_value').value);
    const fromUnit = document.getElementById('pressure_from').value;
    const toUnit = document.getElementById('pressure_to').value;

    if (isNaN(value)) {
        showAlert('Please provide value');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/convert_pressure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value, from_unit: fromUnit, to_unit: toUnit })
        });
        const data = await response.json();
        document.getElementById('pressure_result').innerHTML = `
            <strong>Result:</strong> ${data.result.result.toFixed(6)} ${toUnit}
        `;
    } catch (error) {
        console.error('Error converting:', error);
    }
}

async function calculateAWGWireGauge() {
    const awg = parseInt(document.getElementById('awg_gauge').value);

    if (isNaN(awg)) {
        showAlert('Please provide AWG');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/awg_wire_gauge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ awg })
        });
        const data = await response.json();
        document.getElementById('awg_result').innerHTML = `
            <strong>Results:</strong><br>
            Diameter: ${data.result.diameter_mm.toFixed(3)} mm<br>
            Diameter (in): ${data.result.diameter_inches.toFixed(4)} in<br>
            Area: ${data.result.area_mm2.toFixed(3)} mm²
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

async function calculateWireResistance() {
    const awg = parseInt(document.getElementById('wire_awg').value);
    const length = parseFloat(document.getElementById('wire_length').value);
    const temperature = parseFloat(document.getElementById('wire_temperature').value) || 20;
    const material = document.getElementById('wire_material').value;

    if (isNaN(awg) || isNaN(length)) {
        showAlert('Please provide AWG and length');
        return;
    }

    try {
        const response = await apiFetch('/api/toolbox/wire_resistance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ awg, length, temperature, material })
        });
        const data = await response.json();
        document.getElementById('wire_result').innerHTML = `
            <strong>Results:</strong><br>
            Resistance: ${data.result.resistance.toFixed(4)} Ω<br>
            Resistance (mΩ): ${data.result.resistance_mohms.toFixed(2)} mΩ
        `;
    } catch (error) {
        console.error('Error calculating:', error);
    }
}

// Clear Calculator Inputs
function clearCalculator(prefix) {
    const inputIds = {
        'ohms': ['ohms_voltage', 'ohms_current', 'ohms_resistance'],
        'vd': ['vd_vin', 'vd_r1', 'vd_r2'],
        'led': ['led_vs', 'led_vf', 'led_if'],
        'bat': ['bat_capacity', 'bat_current'],
        'rc': ['rc_resistance', 'rc_capacitance'],
        'lc': ['lc_inductance', 'lc_capacitance'],
        'cap': ['cap_capacitance', 'cap_voltage'],
        'ind': ['ind_inductance', 'ind_current'],
        'rlc': ['rlc_resistance', 'rlc_inductance', 'rlc_capacitance', 'rlc_frequency'],
        'pwm': ['pwm_on_time', 'pwm_period'],
        'gear': ['gear_driver', 'gear_driven'],
        'torque': ['torque_force', 'torque_radius', 'torque_angle'],
        'angular': ['angular_rpm'],
        'thermal': ['thermal_temp_rise', 'thermal_power'],
        'heat': ['heat_thermal_resistance', 'heat_power'],
        'temp': ['temp_ambient', 'temp_power', 'temp_thermal_resistance'],
        'db': ['db_power_ratio', 'db_reference'],
        'freq': ['freq_frequency'],
        'baud': ['baud_bit_rate', 'baud_bits_per_symbol'],
        'length': ['length_value'],
        'mass': ['mass_value'],
        'temp_conv': ['temp_conv_value'],
        'pressure': ['pressure_value'],
        'awg': ['awg_gauge'],
        'wire': ['wire_awg', 'wire_length', 'wire_temperature']
    };

    const resultIds = {
        'ohms': 'ohms_result',
        'vd': 'vd_result',
        'led': 'led_result',
        'bat': 'bat_result',
        'rc': 'rc_result',
        'lc': 'lc_result',
        'cap': 'cap_result',
        'ind': 'ind_result',
        'rlc': 'rlc_result',
        'pwm': 'pwm_result',
        'gear': 'gear_result',
        'torque': 'torque_result',
        'angular': 'angular_result',
        'thermal': 'thermal_result',
        'heat': 'heat_result',
        'temp': 'temp_result',
        'db': 'db_result',
        'freq': 'freq_result',
        'baud': 'baud_result',
        'length': 'length_result',
        'mass': 'mass_result',
        'temp_conv': 'temp_conv_result',
        'pressure': 'pressure_result',
        'awg': 'awg_result',
        'wire': 'wire_result'
    };

    // Clear inputs
    if (inputIds[prefix]) {
        inputIds[prefix].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.value = '';
            }
        });
    }

    // Clear result
    if (resultIds[prefix]) {
        const resultElement = document.getElementById(resultIds[prefix]);
        if (resultElement) {
            resultElement.textContent = '';
        }
    }

    // Reset select dropdowns for converters
    if (prefix === 'length') {
        document.getElementById('length_from').selectedIndex = 0;
        document.getElementById('length_to').selectedIndex = 0;
    } else if (prefix === 'mass') {
        document.getElementById('mass_from').selectedIndex = 0;
        document.getElementById('mass_to').selectedIndex = 0;
    } else if (prefix === 'temp_conv') {
        document.getElementById('temp_conv_from').selectedIndex = 0;
        document.getElementById('temp_conv_to').selectedIndex = 0;
    } else if (prefix === 'pressure') {
        document.getElementById('pressure_from').selectedIndex = 0;
        document.getElementById('pressure_to').selectedIndex = 0;
    } else if (prefix === 'wire') {
        document.getElementById('wire_material').selectedIndex = 0;
    }
}

// Search
async function performSearch() {
    const query = document.getElementById('search-input').value;
    if (!query) return;

    try {
        const response = await apiFetch(`/api/search?query=${encodeURIComponent(query)}`);
        const data = await response.json();

        const resultsDiv = document.getElementById('search-results');
        let html = `<h3>Search Results for "${query}"</h3>`;
        html += `<p style="color:var(--text-secondary); font-size:13px; margin-bottom:16px;">Intent: ${data.intent} | Keywords: ${(data.keywords || []).join(', ')}</p>`;

        let totalResults = 0;
        for (const [category, items] of Object.entries(data.results)) {
            if (items && items.length > 0) {
                totalResults += items.length;
                html += `<div class="search-category">`;
                html += `<h4 style="color:var(--accent-blue); margin-bottom:8px;">${category.charAt(0).toUpperCase() + category.slice(1)} (${items.length})</h4>`;
                html += `<div class="search-results-list">`;

                items.forEach(item => {
                    const title = item.title || item.name || item.log_title || 'Untitled';
                    const description = item.description || item.log_text || item.content || '';
                    const id = item.id;

                    html += `<div class="search-result-item" onclick="navigateToSearchResult('${category}', ${id})">`;
                    html += `<div class="search-result-title">${title}</div>`;
                    if (description) {
                        html += `<div class="search-result-description">${description.substring(0, 150)}${description.length > 150 ? '...' : ''}</div>`;
                    }
                    html += `</div>`;
                });

                html += `</div></div>`;
            }
        }

        if (totalResults === 0) {
            html += `<p style="color:var(--text-muted); padding:20px;">No results found. Try different keywords or a broader search term.</p>`;
        }

        resultsDiv.innerHTML = html;
    } catch (error) {
        console.error('Error searching:', error);
        const resultsDiv = document.getElementById('search-results');
        resultsDiv.innerHTML = `<p style="color:var(--accent-red);">Error performing search. Please try again.</p>`;
    }
}

function navigateToSearchResult(category, id) {
    switch (category) {
        case 'projects':
            loadProjectOverview(id);
            showPage('projects');
            break;
        case 'logs':
            loadExperimentDetail(id);
            showPage('experiments');
            break;
        case 'findings':
            showPage('findings');
            break;
        case 'components':
        case 'equipment':
            showPage('assets');
            break;
        case 'documents':
            showPage('resources');
            break;
        case 'notebook':
            showPage('notebook');
            break;
        default:
            console.log('Unknown category:', category);
    }
}

function loadSearch() {
    // Clear previous search results
    const resultsDiv = document.getElementById('search-results');
    if (resultsDiv) {
        resultsDiv.innerHTML = '';
    }
}

// AI Assistant Panel
function toggleAIPanel() {
    const panel = document.getElementById('ai-panel');
    panel.classList.toggle('collapsed');
    if (panel.classList.contains('collapsed')) {
        document.body.classList.remove('ai-panel-open');
    } else {
        document.body.classList.add('ai-panel-open');
    }
}

// Symbol Panel
const symbolCategories = {
    greek: ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω', 'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ', 'Ν', 'Ξ', 'Ο', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω'],
    math: ['∑', '∏', '∫', '∂', '∇', '√', '∞', '≠', '≈', '≤', '≥', '±', '∓', '×', '÷', '°', '′', '″', '‰', '‱', '∀', '∃', '∄', '∅', '∈', '∉', '∋', '∌', '⊂', '⊃', '⊄', '⊅', '∩', '∪', '∖', '∆', '∇', '⊕', '⊗', '⊥', '∥', '∠', '∠', '∟', '°', '∡', '∢', '∣', '∤', '∥', '∦', '∀', '∁', '∃', '∄', '∅', '∆', '∇', '∈', '∉', '∊', '∋', '∌', '∍', '∎', '∏', '∐', '∑', '−', '∓', '∔', '∕', '∖', '∗', '∘', '∙', '√', '∛', '∜', '∝', '∞', '∟', '∠', '∡', '∢', '∣', '∤', '∥', '∦', '∧', '∨', '∩', '∪', '∫', '∬', '∭', '∮', '∯', '∰', '∱', '∲', '∳', '∴', '∵', '∶', '∷', '∸', '∹', '∺', '∻', '∼', '∽', '∾', '∿', '≀', '≁', '≂', '≃', '≄', '≅', '≆', '≇', '≈', '≉', '≊', '≋', '≌', '≍', '≎', '≏', '≐', '≑', '≒', '≓', '≔', '≕', '≖', '≗', '≘', '≙', '≚', '≛', '≜', '≝', '≞', '≟', '≠', '≡', '≢', '≣', '≤', '≥', '≦', '≧', '≨', '≩', '≪', '≫', '≬', '≭', '≮', '≯', '≰', '≱', '≲', '≳', '≴', '≵', '≶', '≷', '≸', '≹', '≺', '≻', '≼', '≽', '≾', '≿', '⊀', '⊁', '⊂', '⊃', '⊄', '⊅', '⊆', '⊇', '⊈', '⊉', '⊊', '⊋', '⊌', '⊍', '⊎', '⊏', '⊐', '⊑', '⊒', '⊓', '⊔', '⊕', '⊖', '⊗', '⊘', '⊙', '⊚', '⊛', '⊜', '⊝', '⊞', '⊟', '⊠', '⊡', '⊢', '⊣', '⊤', '⊥', '⊦', '⊧', '⊨', '⊩', '⊪', '⊫', '⊬', '⊭', '⊮', '⊯', '⊰', '⊱', '⊲', '⊳', '⊴', '⊵', '⊶', '⊷', '⊸', '⊹', '⊺', '⊻', '⊼', '⊽', '⊾', '⊿', '⋀', '⋁', '⋂', '⋃', '⋄', '⋅', '⋆', '⋇', '⋈', '⋉', '⋊', '⋋', '⋌', '⋍', '⋎', '⋏', '⋐', '⋑', '⋒', '⋓', '⋔', '⋕', '⋖', '⋗', '⋘', '⋙', '⋚', '⋛', '⋜', '⋝', '⋞', '⋟', '⋠', '⋡', '⋢', '⋣', '⋤', '⋥', '⋦', '⋧', '⋨', '⋩', '⋪', '⋫', '⋬', '⋭', '⋮', '⋯', '⋰', '⋱', '⋲', '⋳', '⋴', '⋵', '⋶', '⋷', '⋸', '⋹', '⋺', '⋻', '⋼', '⋽', '⋾', '⋿'],
    engineering: ['Ω', 'Ω', 'Φ', 'Ψ', 'Λ', 'Σ', 'Π', 'Δ', 'Γ', 'Θ', 'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω', '∠', '∟', '°', '′', '″', '∴', '∵', '⊥', '∥', '∦', '∝', '∞', '∀', '∃', '∄', '∅', '∈', '∉', '∋', '∌', '∩', '∪', '∖', '∆', '∇', '⊕', '⊗', '⊥', '∥', '±', '∓', '×', '÷', '≈', '≠', '≤', '≥', '≡', '≢', '≣', '⊂', '⊃', '⊆', '⊇', '⊄', '⊅', '⊈', '⊉', '∩', '∪', '∀', '∁', '∃', '∄', '∅', '∆', '∇', '∈', '∉', '∊', '∋', '∌', '∍', '∎', '∏', '∐', '∑', '−', '∓', '∔', '∕', '∖', '∗', '∘', '∙', '√', '∛', '∜', '∝', '∞', '∟', '∠', '∡', '∢', '∣', '∤', '∥', '∦', '∧', '∨', '∩', '∪', '∫', '∬', '∭', '∮', '∯', '∰', '∱', '∲', '∳', '∴', '∵', '∶', '∷', '∸', '∹', '∺', '∻', '∼', '∽', '∾', '∿', '≀', '≁', '≂', '≃', '≄', '≅', '≆', '≇', '≈', '≉', '≊', '≋', '≌', '≍', '≎', '≏', '≐', '≑', '≒', '≓', '≔', '≕', '≖', '≗', '≘', '≙', '≚', '≛', '≜', '≝', '≞', '≟', '≠', '≡', '≢', '≣', '≤', '≥', '≦', '≧', '≨', '≩', '≪', '≫', '≬', '≭', '≮', '≯', '≰', '≱', '≲', '≳', '≴', '≵', '≶', '≷', '≸', '≹', '≺', '≻', '≼', '≽', '≾', '≿', '⊀', '⊁', '⊂', '⊃', '⊄', '⊅', '⊆', '⊇', '⊈', '⊉', '⊊', '⊋', '⊌', '⊍', '⊎', '⊏', '⊐', '⊑', '⊒', '⊓', '⊔', '⊕', '⊖', '⊗', '⊘', '⊙', '⊚', '⊛', '⊜', '⊝', '⊞', '⊟', '⊠', '⊡', '⊢', '⊣', '⊤', '⊥', '⊦', '⊧', '⊨', '⊩', '⊪', '⊫', '⊬', '⊭', '⊮', '⊯', '⊰', '⊱', '⊲', '⊳', '⊴', '⊵', '⊶', '⊷', '⊸', '⊹', '⊺', '⊻', '⊼', '⊽', '⊾', '⊿', '⋀', '⋁', '⋂', '⋃', '⋄', '⋅', '⋆', '⋇', '⋈', '⋉', '⋊', '⋋', '⋌', '⋍', '⋎', '⋏', '⋐', '⋑', '⋒', '⋓', '⋔', '⋕', '⋖', '⋗', '⋘', '⋙', '⋚', '⋛', '⋜', '⋝', '⋞', '⋟', '⋠', '⋡', '⋢', '⋣', '⋤', '⋥', '⋦', '⋧', '⋨', '⋩', '⋪', '⋫', '⋬', '⋭', '⋮', '⋯', '⋰', '⋱', '⋲', '⋳', '⋴', '⋵', '⋶', '⋷', '⋸', '⋹', '⋺', '⋻', '⋼', '⋽', '⋾', '⋿'],
    physics: ['c', 'h', 'k', 'λ', 'μ', 'ν', 'ρ', 'σ', 'τ', 'φ', 'ω', 'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω', 'F', 'E', 'P', 'V', 'I', 'R', 'C', 'L', 'Q', 'B', 'H', 'S', 'T', 'U', 'W', 'Φ', 'Ψ', 'Λ', 'Σ', 'Π', 'Δ', 'Γ', 'Θ', '∫', '∂', '∇', '√', '∞', '≈', '≠', '≤', '≥', '±', '×', '÷', '°', '′', '″', '‰', '∀', '∃', '∅', '∈', '∉', '∋', '∌', '⊂', '⊃', '⊄', '⊅', '∩', '∪', '∖', '∆', '∇', '⊕', '⊗', '⊥', '∥', '∠', '∟', '∡', '∢', '∣', '∤', '∦', '∧', '∨', '∫', '∬', '∭', '∮', '∯', '∰', '∱', '∲', '∳', '∴', '∵', '∶', '∷', '∸', '∹', '∺', '∻', '∼', '∽', '∾', '∿', '≀', '≁', '≂', '≃', '≄', '≅', '≆', '≇', '≈', '≉', '≊', '≋', '≌', '≍', '≎', '≏', '≐', '≑', '≒', '≓', '≔', '≕', '≖', '≗', '≘', '≙', '≚', '≛', '≜', '≝', '≞', '≟', '≠', '≡', '≢', '≣', '≤', '≥', '≦', '≧', '≨', '≩', '≪', '≫', '≬', '≭', '≮', '≯', '≰', '≱', '≲', '≳', '≴', '≵', '≶', '≷', '≸', '≹', '≺', '≻', '≼', '≽', '≾', '≿', '⊀', '⊁', '⊂', '⊃', '⊄', '⊅', '⊆', '⊇', '⊈', '⊉', '⊊', '⊋', '⊌', '⊍', '⊎', '⊏', '⊐', '⊑', '⊒', '⊓', '⊔', '⊕', '⊖', '⊗', '⊘', '⊙', '⊚', '⊛', '⊜', '⊝', '⊞', '⊟', '⊠', '⊡', '⊢', '⊣', '⊤', '⊥', '⊦', '⊧', '⊨', '⊩', '⊪', '⊫', '⊬', '⊭', '⊮', '⊯', '⊰', '⊱', '⊲', '⊳', '⊴', '⊵', '⊶', '⊷', '⊸', '⊹', '⊺', '⊻', '⊼', '⊽', '⊾', '⊿', '⋀', '⋁', '⋂', '⋃', '⋄', '⋅', '⋆', '⋇', '⋈', '⋉', '⋊', '⋋', '⋌', '⋍', '⋎', '⋏', '⋐', '⋑', '⋒', '⋓', '⋔', '⋕', '⋖', '⋗', '⋘', '⋙', '⋚', '⋛', '⋜', '⋝', '⋞', '⋟', '⋠', '⋡', '⋢', '⋣', '⋤', '⋥', '⋦', '⋧', '⋨', '⋩', '⋪', '⋫', '⋬', '⋭', '⋮', '⋯', '⋰', '⋱', '⋲', '⋳', '⋴', '⋵', '⋶', '⋷', '⋸', '⋹', '⋺', '⋻', '⋼', '⋽', '⋾', '⋿'],
    units: ['m', 'km', 'cm', 'mm', 'μm', 'nm', 'pm', 'Å', 'kg', 'g', 'mg', 'μg', 'ng', 't', 'lb', 'oz', 's', 'min', 'h', 'day', 'yr', 'A', 'mA', 'μA', 'nA', 'kA', 'V', 'mV', 'μV', 'kV', 'MV', 'W', 'mW', 'μW', 'kW', 'MW', 'J', 'kJ', 'MJ', 'eV', 'keV', 'MeV', 'GeV', 'TeV', 'Hz', 'kHz', 'MHz', 'GHz', 'THz', 'Pa', 'kPa', 'MPa', 'GPa', 'bar', 'mbar', 'atm', 'torr', 'psi', 'N', 'kN', 'MN', 'dyn', 'lbf', 'Ω', 'kΩ', 'MΩ', 'GΩ', 'mΩ', 'μΩ', 'S', 'mS', 'μS', 'F', 'mF', 'μF', 'nF', 'pF', 'H', 'mH', 'μH', 'nH', 'T', 'mT', 'μT', 'Wb', 'mWb', 'μWb', 'lm', 'cd', 'lx', 'mol', 'mmol', 'μmol', 'nmol', 'M', 'mM', 'μM', 'nM', 'pM', 'rad', 'deg', 'sr', '°C', '°F', 'K', 'cal', 'kcal', 'BTU', 'Wh', 'kWh', 'MWh', 'GWh', 'hp', 'knot', 'mach', 'c', 'AU', 'ly', 'pc', 'Å', 'barn', 'Ci', 'Gy', 'Sv', 'Bq', 'kat', 'pH', 'pOH', 'ppm', 'ppb', 'ppt', 'dB', 'dBm', 'dBW', 'dBi', 'dBd', 'Np'],
    arrows: ['→', '←', '↑', '↓', '↔', '↕', '↖', '↗', '↘', '↙', '⇒', '⇐', '⇑', '⇓', '⇔', '⇕', '⇖', '⇗', '⇘', '⇙', '⟶', '⟷', '⟹', '⟺', '⟻', '⟼', '⤂', '⤃', '⤄', '⤅', '⤆', '⤇', '⤈', '⤉', '⤊', '⤋', '⤌', '⤍', '⤎', '⤏', '⤐', '⤑', '⤒', '⤓', '⤔', '⤕', '⤖', '⤗', '⤘', '⤙', '⤚', '⤛', '⤜', '⤝', '⤞', '⤟', '⤠', '⤡', '⤢', '⤣', '⤤', '⤥', '⤦', '⤧', '⤨', '⤩', '⤪', '⤫', '⤬', '⤭', '⤮', '⤯', '⤰', '⤱', '⤲', '⤳', '⤴', '⤵', '⤶', '⤷', '⤸', '⤹', '⤺', '⤻', '⤼', '⤽', '⤾', '⤿', '⥀', '⥁', '⥂', '⥃', '⥄', '⥅', '⥆', '⥇', '⥈', '⥉', '⥊', '⥋', '⥌', '⥍', '⥎', '⥏', '⥐', '⥑', '⥒', '⥓', '⥔', '⥕', '⥖', '⥗', '⥘', '⥙', '⥚', '⥛', '⥜', '⥝', '⥞', '⥟', '⥠', '⥡', '⥢', '⥣', '⥤', '⥥', '⥦', '⥧', '⥨', '⥩', '⥪', '⥫', '⥬', '⥭', '⥮', '⥯', '⥰', '⥱', '⥲', '⥳', '⥴', '⥵', '⥶', '⥷', '⥸', '⥹', '⥺', '⥻', '⥼', '⥽', '⥾', '⥿', '⦀', '⦁', '⦂', '⦜', '⦝', '⦞', '⦟', '⦠', '⦡', '⦢', '⦣', '⦤', '⦥', '⦦', '⦧', '⦨', '⦩', '⦪', '⦫', '⦬', '⦭', '⦮', '⦯', '⸰', '⦱', '⦲', '⦳', '⦴', '⦵', '⦶', '⦷', '⦸', '⦹', '⦺', '⦻', '⦼', '⦽', '⦾', '⦿', '⧀', '⧁', '⧂', '⧃', '⧄', '⧅', '⧆', '⧇', '⧈', '⧉', '⧊', '⧋', '⧌', '⧍', '⧎', '⧏', '⧐', '⧑', '⧒', '⧓', '⧔', '⧕', '⧖', '⧗', '⧘', '⧙', '⧚', '⧛', '⧜', '⧝', '⧞', '⧟', '⧠', '⧡', '⧢', '⧣', '⧤', '⧥', '⧦', '⧧', '⧨', '⧩', '⧪', '⧫', '⧬', '⧭', '⧮', '⧯', '⧰', '⧱', '⧲', '⧳', '⧴', '⧵', '⧶', '⧷', '⧸', '⧹', '⧺', '⧻', '⧼', '⧽', '⧾', '⧿']
};

function toggleSymbolPanel() {
    const panel = document.getElementById('symbol-panel');
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        showSymbolCategory('greek');
    }
}

function toggleFormattingMenu() {
    const menu = document.getElementById('formatting-menu');
    const isVisible = menu.style.display !== 'none';
    menu.style.display = isVisible ? 'none' : 'block';
}

function toggleNotebookSidebar() {
    const sidebar = document.querySelector('.notebook-sidebar');
    const overlay = document.querySelector('.notebook-sidebar-overlay');
    const layout = document.querySelector('.notebook-layout');

    if (sidebar && overlay) {
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            // On mobile: toggle active class for slide-in behavior
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        } else {
            // On desktop: toggle collapsed class for width behavior
            sidebar.classList.toggle('collapsed');
            if (layout) {
                layout.classList.toggle('sidebar-collapsed');
            }
        }
    }
}

// Export to Notebook functionality
let currentCalculatorExport = null;
let currentCalculatorType = null;

function toggleExportDropdown(calculatorType) {
    const exportData = getCalculatorExportData(calculatorType);
    if (!exportData) {
        showAlert('Please calculate first before exporting.', 'Error');
        return;
    }

    currentCalculatorExport = exportData;
    currentCalculatorType = calculatorType;

    // Close all other dropdowns
    document.querySelectorAll('.export-dropdown-menu').forEach(menu => {
        if (menu.id !== `export-dropdown-${calculatorType}`) {
            menu.style.display = 'none';
        }
    });

    // Toggle current dropdown
    const dropdown = document.getElementById(`export-dropdown-${calculatorType}`);
    const isVisible = dropdown.style.display !== 'none';

    if (!isVisible) {
        // Load notebook entries
        loadNotebookEntriesForDropdown(calculatorType);
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }
}

function loadNotebookEntriesForDropdown(calculatorType) {
    const notesList = document.getElementById(`export-notes-${calculatorType}`);
    notesList.innerHTML = '<div class="export-note-item empty">Loading notes...</div>';

    fetch('/api/notebook')
        .then(response => response.json())
        .then(data => {
            notesList.innerHTML = '';

            const entries = data.entries || [];

            if (entries.length === 0) {
                notesList.innerHTML = '<div class="export-note-item empty">No notes found. Create a note first.</div>';
                return;
            }

            entries.forEach(entry => {
                const item = document.createElement('div');
                item.className = 'export-note-item';
                item.textContent = entry.title || 'Untitled Note';
                item.onclick = () => exportToNote(entry.id);
                notesList.appendChild(item);
            });
        })
        .catch(error => {
            console.error('Error loading notebook entries:', error);
            notesList.innerHTML = '<div class="export-note-item empty">Error loading notes. Check console for details.</div>';
        });
}

function exportToNote(noteId) {
    if (!currentCalculatorExport) {
        showAlert('No calculation data to export.', 'Error');
        return;
    }

    // Close all dropdowns
    document.querySelectorAll('.export-dropdown-menu').forEach(menu => {
        menu.style.display = 'none';
    });

    // Append the calculation to the selected note
    fetch(`/api/notebook/${noteId}`, {
        method: 'GET'
    })
        .then(response => response.json())
        .then(entry => {
            const entryData = entry.data || entry;
            const updatedContent = entryData.content + '\n\n' + currentCalculatorExport.formatted;

            return fetch(`/api/notebook/${noteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: entryData.title,
                    content: updatedContent
                })
            });
        })
        .then(response => response.json())
        .then(data => {
            showAlert('Calculation exported successfully!', 'Success');
            currentCalculatorExport = null;
            currentCalculatorType = null;
        })
        .catch(error => {
            console.error('Error exporting calculation:', error);
            showAlert('Error exporting calculation. Please try again.', 'Error');
        });
}

// Close dropdowns when clicking outside
document.addEventListener('click', function (event) {
    if (!event.target.closest('.export-dropdown')) {
        document.querySelectorAll('.export-dropdown-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    }
});

function getCalculatorExportData(calculatorType) {
    const data = {
        calculatorType: calculatorType,
        formula: '',
        procedure: '',
        inputs: {},
        result: '',
        formatted: ''
    };

    switch (calculatorType) {
        case 'ohms':
            const v = document.getElementById('ohms_voltage').value;
            const i = document.getElementById('ohms_current').value;
            const r = document.getElementById('ohms_resistance').value;
            const ohmsResult = document.getElementById('ohms_result').innerHTML;

            if (!ohmsResult || ohmsResult === '') return null;

            data.inputs = { Voltage: v + ' V', Current: i + ' A', Resistance: r + ' Ω' };
            data.formula = 'V = I × R, I = V / R, R = V / I';
            data.procedure = 'Using Ohm\'s Law, calculate the unknown value given two known values.';
            data.result = ohmsResult;
            data.formatted = `Ohm's Law Calculation\n\nFormula:\nV = I × R\nI = V / R\nR = V / I\n\nGiven Values:\n- Voltage (V): ${v} V\n- Current (I): ${i} A\n- Resistance (R): ${r} Ω\n\nProcedure:\nUsing Ohm's Law, calculate the unknown value given two known values.\n\nResult:\n${ohmsResult}`;
            break;

        case 'vd':
            const vin = document.getElementById('vd_vin').value;
            const r1 = document.getElementById('vd_r1').value;
            const r2 = document.getElementById('vd_r2').value;
            const vdResult = document.getElementById('vd_result').innerHTML;

            if (!vdResult || vdResult === '') return null;

            data.inputs = { 'Input Voltage': vin + ' V', R1: r1 + ' Ω', R2: r2 + ' Ω' };
            data.formula = 'Vout = Vin × (R2 / (R1 + R2))';
            data.procedure = 'Calculate the output voltage of a voltage divider circuit.';
            data.result = vdResult;
            data.formatted = `Voltage Divider Calculation\n\nFormula:\nVout = Vin × (R2 / (R1 + R2))\n\nGiven Values:\n- Input Voltage (Vin): ${vin} V\n- Resistor 1 (R1): ${r1} Ω\n- Resistor 2 (R2): ${r2} Ω\n\nProcedure:\nCalculate the output voltage of a voltage divider circuit.\n\nResult:\n${vdResult}`;
            break;

        case 'led':
            const vs = document.getElementById('led_vs').value;
            const vf = document.getElementById('led_vf').value;
            const if_val = document.getElementById('led_if').value;
            const ledResult = document.getElementById('led_result').innerHTML;

            if (!ledResult || ledResult === '') return null;

            data.inputs = { 'Source Voltage': vs + ' V', 'Forward Voltage': vf + ' V', 'Forward Current': if_val + ' A' };
            data.formula = 'R = (Vs - Vf) / If';
            data.procedure = 'Calculate the required series resistor for an LED.';
            data.result = ledResult;
            data.formatted = `LED Resistor Calculation\n\nFormula:\nR = (Vs - Vf) / If\n\nGiven Values:\n- Source Voltage (Vs): ${vs} V\n- Forward Voltage (Vf): ${vf} V\n- Forward Current (If): ${if_val} A\n\nProcedure:\nCalculate the required series resistor for an LED.\n\nResult:\n${ledResult}`;
            break;

        default:
            // Generic handler for other calculators
            const resultElement = document.getElementById(calculatorType + '_result');
            const result = resultElement ? resultElement.innerHTML : '';

            if (!result || result === '') return null;

            data.formula = 'See calculator for formula';
            data.procedure = 'See calculator for procedure';
            data.result = result;
            data.formatted = `${calculatorType.toUpperCase()} Calculation\n\nResult:\n${result}`;
            break;
    }

    return data;
}

function loadNotebookEntriesForExport() {
    const select = document.getElementById('export-note-select');
    select.innerHTML = '<option value="">-- Select a note --</option>';

    fetch('/api/notebook')
        .then(response => response.json())
        .then(data => {
            data.forEach(entry => {
                const option = document.createElement('option');
                option.value = entry.id;
                option.textContent = entry.title || 'Untitled Note';
                select.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error loading notebook entries:', error);
        });
}

function closeExportModal() {
    document.getElementById('export-modal').style.display = 'none';
    currentCalculatorExport = null;
}

function confirmExport() {
    const noteId = document.getElementById('export-note-select').value;

    if (!noteId) {
        showAlert('Please select a note to export to.', 'Error');
        return;
    }

    if (!currentCalculatorExport) {
        showAlert('No calculation data to export.', 'Error');
        return;
    }

    // Append the calculation to the selected note
    fetch(`/api/notebook/${noteId}`, {
        method: 'GET'
    })
        .then(response => response.json())
        .then(entry => {
            const updatedContent = entry.content + '\n\n' + currentCalculatorExport.formatted;

            return fetch(`/api/notebook/${noteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: entry.title,
                    content: updatedContent
                })
            });
        })
        .then(response => response.json())
        .then(data => {
            showAlert('Calculation exported successfully!', 'Success');
            closeExportModal();
        })
        .catch(error => {
            console.error('Error exporting calculation:', error);
            showAlert('Error exporting calculation. Please try again.', 'Error');
        });
}

// Close sidebar when clicking overlay
document.addEventListener('DOMContentLoaded', function () {
    const overlay = document.querySelector('.notebook-sidebar-overlay');
    if (overlay) {
        overlay.addEventListener('click', function () {
            toggleNotebookSidebar();
        });
    }
});

// Undo/Redo functionality
let notebookHistory = [];
let notebookHistoryIndex = -1;
const MAX_HISTORY = 50;

function saveToHistory() {
    const content = document.getElementById('notebook-editor-content').innerHTML;
    const drawingData = saveDrawingData();

    // Remove any future history if we're not at the end
    if (notebookHistoryIndex < notebookHistory.length - 1) {
        notebookHistory = notebookHistory.slice(0, notebookHistoryIndex + 1);
    }

    notebookHistory.push({
        content: content,
        drawingData: drawingData
    });

    // Limit history size
    if (notebookHistory.length > MAX_HISTORY) {
        notebookHistory.shift();
    } else {
        notebookHistoryIndex++;
    }
}

function undoNotebook() {
    if (notebookHistoryIndex > 0) {
        notebookHistoryIndex--;
        restoreFromHistory();
    }
}

function redoNotebook() {
    if (notebookHistoryIndex < notebookHistory.length - 1) {
        notebookHistoryIndex++;
        restoreFromHistory();
    }
}

function restoreFromHistory() {
    const state = notebookHistory[notebookHistoryIndex];
    if (state) {
        document.getElementById('notebook-editor-content').innerHTML = state.content;
        if (state.drawingData) {
            loadDrawingData(state.drawingData);
        } else {
            shapes = [];
            images = [];
            if (canvas) {
                redrawCanvas();
            }
        }
    }
}

// Initialize history on page load
document.addEventListener('DOMContentLoaded', function () {
    const editor = document.getElementById('notebook-editor-content');
    if (editor) {
        editor.addEventListener('input', function () {
            saveToHistory();
        });
    }

    // Initialize color selector event listener
    const colorInput = document.getElementById('drawing-color');
    if (colorInput) {
        colorInput.addEventListener('change', function () {
            // Update canvas context with new color
            if (ctx) {
                ctx.strokeStyle = this.value;
                ctx.fillStyle = this.value;
            }
        });
    }
});

// Drawing Mode
let drawingMode = false;
let formattingMode = false;
let currentTool = 'pen';
let isDrawing = false;
let canvas, ctx;
let drawStartX, drawStartY;
let shapes = [];
let currentShape = null;
let currentPath = [];
let images = [];
let selectedImage = null;

function toggleFormattingMode() {
    formattingMode = !formattingMode;
    const toolbar = document.getElementById('formatting-toolbar');

    if (formattingMode) {
        toolbar.style.display = 'flex';
        // Show feedback
        const savedIndicator = document.getElementById('saved-indicator');
        if (savedIndicator) {
            savedIndicator.textContent = 'Formatting tools';
            savedIndicator.style.color = 'var(--accent-blue)';
            setTimeout(() => {
                savedIndicator.textContent = '';
            }, 1500);
        }
    } else {
        toolbar.style.display = 'none';
    }
}

function toggleNotebookFooter() {
    const footer = document.querySelector('.notebook-editor-footer');
    const toggleBtn = document.querySelector('.notebook-footer-toggle');

    if (footer.classList.contains('visible')) {
        footer.classList.remove('visible');
        toggleBtn.style.transform = 'rotate(0deg)';
    } else {
        footer.classList.add('visible');
        toggleBtn.style.transform = 'rotate(180deg)';
    }
}

// Lab Assistant Panel Functions
let labAssistantContext = {
    type: null,
    id: null,
    data: null
};

function toggleLabAssistantPanel() {
    const panel = document.getElementById('lab-assistant-panel');
    panel.classList.toggle('collapsed');
}

function updateLabAssistantContext(type, id, data) {
    labAssistantContext = { type, id, data };
    const contextValue = document.getElementById('lab-assistant-context-value');
    const stageReviewBtn = document.getElementById('ai-stage-review-btn');

    if (type === 'stage') {
        contextValue.textContent = `Stage: ${data.stage_name || 'Unknown'}`;
        stageReviewBtn.disabled = false;
    } else if (type === 'component') {
        contextValue.textContent = `Component: ${data.component_name || 'Unknown'}`;
        stageReviewBtn.disabled = true;
    } else {
        contextValue.textContent = 'No active context';
        stageReviewBtn.disabled = true;
    }
}

async function runStageReview() {
    if (labAssistantContext.type !== 'stage' || !labAssistantContext.id) {
        showAlert('Please select a stage first', 'Error');
        return;
    }

    const output = document.getElementById('lab-assistant-output');
    output.innerHTML = '<div class="ai-loading">Analyzing stage design...</div>';

    try {
        const response = await fetch('/api/ai/stage-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stage_context: labAssistantContext.data })
        });

        if (!response.ok) throw new Error('Failed to get AI response');

        output.innerHTML = '<div class="ai-response-text"></div>';
        const responseText = output.querySelector('.ai-response-text');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            responseText.textContent += chunk;
            output.scrollTop = output.scrollHeight;
        }
    } catch (error) {
        output.innerHTML = `<div class="ai-response-text" style="color: var(--accent-red);">Error: ${error.message}</div>`;
        showAlert('Failed to run stage review', 'Error');
    }
}

function showAlternatesModal(componentDetails = null) {
    const details = componentDetails || (labAssistantContext.type === 'component' ? labAssistantContext.data?.component_name : null);

    if (!details) {
        showModal({
            type: 'prompt',
            title: 'Find Component Alternates',
            message: 'Enter component details:',
            callback: async (value) => {
                if (value) {
                    await findAlternates(value);
                }
            }
        });
    } else {
        findAlternates(details);
    }
}

async function findAlternates(componentDetails) {
    const output = document.getElementById('lab-assistant-output');
    output.innerHTML = '<div class="ai-loading">Finding alternatives...</div>';

    try {
        const response = await fetch('/api/ai/find-alternates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ component_details: componentDetails })
        });

        if (!response.ok) throw new Error('Failed to get AI response');

        output.innerHTML = '<div class="ai-response-text"></div>';
        const responseText = output.querySelector('.ai-response-text');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            responseText.textContent += chunk;
            output.scrollTop = output.scrollHeight;
        }
    } catch (error) {
        output.innerHTML = `<div class="ai-response-text" style="color: var(--accent-red);">Error: ${error.message}</div>`;
        showAlert('Failed to find alternatives', 'Error');
    }
}

function showFailureDiagnosisModal() {
    showModal({
        type: 'multi',
        title: 'Diagnose Circuit Failure',
        message: 'Enter failure observation:',
        fields: [
            { name: 'observation', label: 'Failure Observation', type: 'textarea', defaultValue: '', rows: 3 }
        ],
        callback: async (values) => {
            if (values && values.observation) {
                await diagnoseFailure(values.observation);
            }
        }
    });
}

async function diagnoseFailure(observation) {
    const output = document.getElementById('lab-assistant-output');
    output.innerHTML = '<div class="ai-loading">Analyzing failure...</div>';

    try {
        // Fetch recent experiment history
        let experimentHistory = [];
        try {
            const logsResponse = await apiFetch('/api/logs?limit=10&offset=0');
            if (logsResponse && logsResponse.data) {
                experimentHistory = logsResponse.data.map(log => ({
                    experiment_title: log.title,
                    experiment_outcome: log.outcome,
                    experiment_details: log.details,
                    stage_name: log.stage_name,
                    stage_goals: log.stage_goals,
                    status: log.status
                }));
            }
        } catch (e) {
            console.warn('Failed to fetch experiment history:', e);
            // Continue with empty history if fetch fails
        }

        const response = await fetch('/api/ai/diagnose-failure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                observation: observation,
                experiment_history: experimentHistory
            })
        });

        if (!response.ok) throw new Error('Failed to get AI response');

        output.innerHTML = '<div class="ai-response-text"></div>';
        const responseText = output.querySelector('.ai-response-text');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            responseText.textContent += chunk;
            output.scrollTop = output.scrollHeight;
        }
    } catch (error) {
        output.innerHTML = `<div class="ai-response-text" style="color: var(--accent-red);">Error: ${error.message}</div>`;
        showAlert('Failed to diagnose failure', 'Error');
    }
}

function showScriptGenerationModal() {
    showModal({
        type: 'multi',
        title: 'Generate Test Script',
        message: 'Enter test requirements:',
        fields: [
            { name: 'requirement', label: 'Test Requirement', type: 'textarea', defaultValue: '', rows: 3 },
            {
                name: 'language', label: 'Language', type: 'select', options: [
                    { value: 'python', label: 'Python' },
                    { value: 'cpp', label: 'C++' },
                    { value: 'arduino', label: 'Arduino' }
                ], defaultValue: 'python'
            }
        ],
        callback: async (values) => {
            if (values && values.requirement) {
                await generateTestScript(values.requirement, values.language);
            }
        }
    });
}

async function generateTestScript(requirement, language = 'python') {
    const output = document.getElementById('lab-assistant-output');
    output.innerHTML = '<div class="ai-loading">Generating script...</div>';

    try {
        const response = await fetch('/api/ai/generate-script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requirement: requirement,
                language: language
            })
        });

        if (!response.ok) throw new Error('Failed to get AI response');

        output.innerHTML = '<div class="ai-response-text"></div>';
        const responseText = output.querySelector('.ai-response-text');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            responseText.textContent += chunk;
            output.scrollTop = output.scrollHeight;
        }
    } catch (error) {
        output.innerHTML = `<div class="ai-response-text" style="color: var(--accent-red);">Error: ${error.message}</div>`;
        showAlert('Failed to generate script', 'Error');
    }
}

async function exportChatToNotebook(button) {
    const messageDiv = button.closest('.chat-message');
    const rawResponse = messageDiv.dataset.rawResponse;

    if (!rawResponse) {
        showAlert('No response to export', 'Error');
        return;
    }

    // Fetch existing notebook entries
    let notebookEntries = [];
    try {
        const response = await apiFetch('/api/notebook?limit=100');
        if (response && response.data) {
            notebookEntries = response.data;
        }
    } catch (e) {
        console.warn('Failed to fetch notebook entries:', e);
    }

    // Create notebook entry options
    const entryOptions = notebookEntries.map(entry => ({
        value: entry.id.toString(),
        label: entry.title || `Entry #${entry.id}`
    }));

    // Add "Create new entry" option
    entryOptions.unshift({ value: 'new', label: 'Create new entry...' });

    showModal({
        type: 'multi',
        title: 'Export to Notebook',
        message: 'Select a notebook entry to append this response to:',
        fields: [
            {
                name: 'entry_id',
                label: 'Notebook Entry',
                type: 'select',
                options: entryOptions,
                defaultValue: 'new'
            },
            {
                name: 'new_title',
                label: 'New Entry Title',
                type: 'text',
                defaultValue: '',
                placeholder: 'Enter title if creating new entry...',
                condition: (values) => values.entry_id === 'new'
            }
        ],
        callback: async (values) => {
            if (values) {
                await performExportToNotebook(rawResponse, values);
            }
        }
    });
}

async function performExportToNotebook(content, values) {
    try {
        let entryId;
        const parsedContent = parseMarkdownAndMath(content);

        if (values.entry_id === 'new') {
            // Create new notebook entry with proper markdown formatting converted to HTML
            const newEntryData = {
                title: values.new_title || 'AI Chat Export',
                content: parsedContent,
                entry_type: 'text',
                project_id: currentProjectId || null,
                experiment_id: currentExperimentId || null
            };

            const response = await apiFetch('/api/notebook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newEntryData)
            });

            const data = await response.json();

            // Check if entry was created successfully (API returns {id, message})
            if (data && data.id) {
                showAlert('Created new notebook entry with AI response', 'Success');
            } else {
                throw new Error('Failed to create notebook entry');
            }
        } else {
            // Append to existing entry
            const existingEntryResponse = await apiFetch(`/api/notebook/${values.entry_id}`);
            const existingEntry = await existingEntryResponse.json();

            if (existingEntry && existingEntry.data) {
                // Preserve existing content and append with proper markdown formatting converted to HTML
                const separator = '<hr><br>';
                const header = '<p><strong>AI Chat Response:</strong></p>';
                const updatedContent = existingEntry.data.content + separator + header + parsedContent;

                const updateResponse = await apiFetch(`/api/notebook/${values.entry_id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: updatedContent })
                });

                // Check if update was successful
                if (updateResponse.ok) {
                    showAlert('Appended AI response to notebook entry', 'Success');
                } else {
                    throw new Error('Failed to update notebook entry');
                }
            } else {
                throw new Error('Failed to fetch existing notebook entry');
            }
        }
    } catch (error) {
        console.error('Error exporting to notebook:', error);
        showAlert('Failed to export to notebook: ' + error.message, 'Error');
    }
}

function toggleDrawingMode() {
    drawingMode = !drawingMode;
    const toolbar = document.getElementById('drawing-toolbar');
    const canvasContainer = document.getElementById('drawing-canvas-container');
    const editor = document.getElementById('notebook-editor-content');

    if (drawingMode) {
        toolbar.style.display = 'flex';
        canvasContainer.style.display = 'block';
        editor.style.display = 'none';
        // Delay canvas initialization to ensure container has proper dimensions
        setTimeout(() => initCanvas(), 10);
        // Show feedback
        const savedIndicator = document.getElementById('saved-indicator');
        if (savedIndicator) {
            savedIndicator.textContent = 'Drawing mode';
            savedIndicator.style.color = 'var(--accent-blue)';
            setTimeout(() => {
                savedIndicator.textContent = '';
            }, 1500);
        }
    } else {
        // Auto-save drawing data when closing toolbar
        const currentNoteId = document.getElementById('notebook-editor-title').dataset.noteId;
        if (currentNoteId && (shapes.length > 0 || images.length > 0)) {
            saveNotebookEntry();
        }
        toolbar.style.display = 'none';
        canvasContainer.style.display = 'none';
        editor.style.display = 'block';
    }
}

function initCanvas() {
    canvas = document.getElementById('drawing-canvas');
    ctx = canvas.getContext('2d');

    // Set canvas size
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // Set default styles
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Redraw existing shapes and images
    redrawCanvas();

    // Remove existing event listeners to prevent duplicates
    canvas.removeEventListener('mousedown', startDrawing);
    canvas.removeEventListener('mousemove', draw);
    canvas.removeEventListener('mouseup', stopDrawing);
    canvas.removeEventListener('mouseout', stopDrawing);

    // Add event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
}

function setDrawingTool(tool) {
    currentTool = tool;

    // Update active state
    document.querySelectorAll('.drawing-tool-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tool === tool) {
            btn.classList.add('active');
        }
    });
}

async function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    drawStartX = e.clientX - rect.left;
    drawStartY = e.clientY - rect.top;

    const color = document.getElementById('drawing-color').value;
    const size = document.getElementById('drawing-size').value;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;

    if (currentTool === 'pen' || currentTool === 'eraser') {
        ctx.beginPath();
        ctx.moveTo(drawStartX, drawStartY);
        currentPath = [{ x: drawStartX, y: drawStartY }];
    } else if (currentTool === 'text') {
        const text = await showPrompt('Enter text:');
        if (text) {
            shapes.push({
                type: 'text',
                x: drawStartX,
                y: drawStartY,
                text: text,
                color: color,
                size: size
            });
            redrawCanvas();
        }
        isDrawing = false;
    } else if (currentTool === 'image') {
        // Check if clicking on an image
        selectedImage = null;
        for (let i = images.length - 1; i >= 0; i--) {
            const img = images[i];
            if (drawStartX >= img.x && drawStartX <= img.x + img.width &&
                drawStartY >= img.y && drawStartY <= img.y + img.height) {
                selectedImage = img;
                selectedImage.offsetX = drawStartX - img.x;
                selectedImage.offsetY = drawStartY - img.y;
                break;
            }
        }
        if (!selectedImage) {
            isDrawing = false;
        }
    }
}

function draw(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'pen') {
        ctx.lineTo(x, y);
        ctx.stroke();
        currentPath.push({ x: x, y: y });
    } else if (currentTool === 'eraser') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 20;
        ctx.lineTo(x, y);
        ctx.stroke();
    } else if (currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'arrow' || currentTool === 'line') {
        redrawCanvas();
        drawShape(drawStartX, drawStartY, x, y);
    } else if (currentTool === 'image' && selectedImage) {
        selectedImage.x = x - selectedImage.offsetX;
        selectedImage.y = y - selectedImage.offsetY;
        redrawCanvas();
    }
}

function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;

    const rect = canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    const color = document.getElementById('drawing-color').value;
    const size = document.getElementById('drawing-size').value;

    if (currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'arrow' || currentTool === 'line') {
        shapes.push({
            type: currentTool,
            startX: drawStartX,
            startY: drawStartY,
            endX: endX,
            endY: endY,
            color: color,
            size: size
        });
        redrawCanvas();
    }

    if (currentTool === 'pen') {
        shapes.push({
            type: 'path',
            points: [...currentPath],
            color: color,
            size: size
        });
        currentPath = [];
    }
}

function drawShape(x1, y1, x2, y2) {
    const color = document.getElementById('drawing-color').value;
    const size = document.getElementById('drawing-size').value;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;

    if (currentTool === 'rectangle') {
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    } else if (currentTool === 'circle') {
        const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        ctx.beginPath();
        ctx.arc(x1, y1, radius, 0, 2 * Math.PI);
        ctx.stroke();
    } else if (currentTool === 'line') {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    } else if (currentTool === 'arrow') {
        drawArrow(x1, y1, x2, y2);
    }
}

function drawArrow(x1, y1, x2, y2) {
    const headLength = 15;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
}

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw images first (behind shapes)
    images.forEach(img => {
        const imageObj = new Image();
        imageObj.src = img.src;
        ctx.drawImage(imageObj, img.x, img.y, img.width, img.height);
    });

    // Draw shapes
    shapes.forEach(shape => {
        ctx.strokeStyle = shape.color;
        ctx.fillStyle = shape.color;
        ctx.lineWidth = shape.size;

        if (shape.type === 'rectangle') {
            ctx.strokeRect(shape.startX, shape.startY, shape.endX - shape.startX, shape.endY - shape.startY);
        } else if (shape.type === 'circle') {
            const radius = Math.sqrt(Math.pow(shape.endX - shape.startX, 2) + Math.pow(shape.endY - shape.startY, 2));
            ctx.beginPath();
            ctx.arc(shape.startX, shape.startY, radius, 0, 2 * Math.PI);
            ctx.stroke();
        } else if (shape.type === 'line') {
            ctx.beginPath();
            ctx.moveTo(shape.startX, shape.startY);
            ctx.lineTo(shape.endX, shape.endY);
            ctx.stroke();
        } else if (shape.type === 'arrow') {
            drawArrow(shape.startX, shape.startY, shape.endX, shape.endY);
        } else if (shape.type === 'path') {
            ctx.beginPath();
            shape.points.forEach((point, index) => {
                if (index === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            });
            ctx.stroke();
        } else if (shape.type === 'text') {
            ctx.font = `${shape.size * 5}px Arial`;
            ctx.fillText(shape.text, shape.x, shape.y);
        }
    });
}

function getCurrentPath() {
    return [...currentPath];
}

function clearCanvas() {
    shapes = [];
    images = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function addImageToCanvas() {
    const input = document.getElementById('drawing-image-input');
    input.click();
}

document.getElementById('drawing-image-input').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        const img = new Image();
        img.onload = function () {
            const sizeSelect = document.getElementById('image-size').value;
            let width = img.width;
            let height = img.height;

            // Calculate thumbnail size based on selection
            if (sizeSelect === 'small') {
                const maxSize = 150;
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = (height / width) * maxSize;
                        width = maxSize;
                    } else {
                        width = (width / height) * maxSize;
                        height = maxSize;
                    }
                }
            } else if (sizeSelect === 'medium') {
                const maxSize = 300;
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = (height / width) * maxSize;
                        width = maxSize;
                    } else {
                        width = (width / height) * maxSize;
                        height = maxSize;
                    }
                }
            } else if (sizeSelect === 'large') {
                const maxSize = 500;
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = (height / width) * maxSize;
                        width = maxSize;
                    } else {
                        width = (width / height) * maxSize;
                        height = maxSize;
                    }
                }
            }
            // original size keeps the image as is

            images.push({
                src: event.target.result,
                x: 50,
                y: 50,
                width: width,
                height: height,
                originalWidth: img.width,
                originalHeight: img.height
            });

            redrawCanvas();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
});

function saveDrawingData() {
    if (shapes.length === 0 && images.length === 0) return null;
    return JSON.stringify({
        shapes: shapes,
        images: images
    });
}

function loadDrawingData(data) {
    if (!data) return;
    try {
        const parsed = JSON.parse(data);
        // Handle old format (just shapes) and new format (shapes + images)
        if (Array.isArray(parsed)) {
            shapes = parsed;
            images = [];
        } else {
            shapes = parsed.shapes || [];
            images = parsed.images || [];
        }
        if (canvas) {
            redrawCanvas();
        }
    } catch (e) {
        console.error('Error loading drawing data:', e);
        shapes = [];
        images = [];
    }
}

function showSymbolCategory(category) {
    const grid = document.getElementById('symbol-grid');
    const symbols = symbolCategories[category] || [];

    // Update active tab
    document.querySelectorAll('.symbol-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent.toLowerCase() === category) {
            tab.classList.add('active');
        }
    });

    // Clear and populate grid
    grid.innerHTML = '';
    symbols.forEach(symbol => {
        const btn = document.createElement('button');
        btn.className = 'symbol-btn';
        btn.textContent = symbol;
        btn.onclick = () => insertSymbol(symbol);
        grid.appendChild(btn);
    });
}

function insertSymbol(symbol) {
    const editor = document.getElementById('notebook-editor-content');
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);

    range.deleteContents();
    range.insertNode(document.createTextNode(symbol));

    editor.focus();
}

// Auto-save functions
function startAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
    autoSaveInterval = setInterval(autoSaveNotebookEntry, 30000); // 30 seconds
}

function stopAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }
}

async function autoSaveNotebookEntry() {
    const title = document.getElementById('notebook-editor-title').value;
    const content = document.getElementById('notebook-editor-content').innerHTML;

    // Only save if content has changed
    const currentContent = title + content;
    if (currentContent === lastSavedContent) {
        return;
    }

    // Store in localStorage as fallback
    localStorage.setItem('notebook_draft', JSON.stringify({ title, content, currentNoteId }));

    if (!title || !content) {
        return;
    }

    try {
        if (currentNoteId) {
            // Update existing entry
            const response = await apiFetch(`/api/notebook/${currentNoteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content }),
                skipErrorAlert: true
            });
            if (response.ok) {
                lastSavedContent = currentContent;
                updateSavedIndicator(true);
            } else {
                updateSavedIndicator(false);
            }
        } else {
            // Create new entry
            const response = await apiFetch('/api/notebook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content }),
                skipErrorAlert: true
            });
            if (response.ok) {
                const data = await response.json();
                currentNoteId = data.id;
                lastSavedContent = currentContent;
                updateSavedIndicator(true);
            } else {
                updateSavedIndicator(false);
            }
        }
    } catch (error) {
        console.error('Auto-save failed:', error);
        updateSavedIndicator(false);
    }
}

function updateSavedIndicator(saved) {
    const indicator = document.getElementById('saved-indicator');
    if (indicator) {
        if (saved) {
            indicator.textContent = 'Saved';
            indicator.style.color = 'var(--success-green)';
        } else {
            indicator.textContent = 'Saving...';
            indicator.style.color = 'var(--text-muted)';
        }
        setTimeout(() => {
            indicator.textContent = '';
        }, 2000);
    }
}

function loadDraftFromStorage() {
    const draft = localStorage.getItem('notebook_draft');
    if (draft) {
        try {
            const data = JSON.parse(draft);
            document.getElementById('notebook-editor-title').value = data.title || '';
            document.getElementById('notebook-editor-content').innerHTML = data.content || '';
            currentNoteId = data.currentNoteId;
            lastSavedContent = data.title + data.content;
            startAutoSave();
            return true;
        } catch (error) {
            console.error('Error loading draft:', error);
        }
    }
    return false;
}

// Custom Modal System
let modalCallback = null;
let modalType = null;

function showModal(options) {
    console.log('showModal called:', options);
    const overlay = document.getElementById('modal-overlay');
    console.log('overlay element:', overlay);

    if (!overlay) {
        console.error('Modal overlay not found!');
        return;
    }

    const title = document.getElementById('modal-title');
    const message = document.getElementById('modal-message');
    const fieldsContainer = document.getElementById('modal-fields-container');
    const input = document.getElementById('modal-input');
    const textarea = document.getElementById('modal-textarea');
    const select = document.getElementById('modal-select');
    const cancelBtn = document.getElementById('modal-cancel');
    const confirmBtn = document.getElementById('modal-confirm');

    // Reset all input fields
    input.style.display = 'none';
    input.value = '';
    textarea.style.display = 'none';
    textarea.value = '';
    select.style.display = 'none';
    select.innerHTML = '';
    fieldsContainer.innerHTML = '';

    // Set title and message
    title.textContent = options.title || 'Modal';
    message.textContent = options.message || '';

    // Configure input type
    modalType = options.type || 'alert';

    if (modalType === 'multi') {
        // Handle multi-field modal
        if (options.fields && options.fields.length > 0) {
            options.fields.forEach(field => {
                const fieldDiv = document.createElement('div');
                fieldDiv.className = 'modal-field';

                const label = document.createElement('label');
                label.className = 'modal-field-label';
                label.textContent = field.label;
                fieldDiv.appendChild(label);

                if (field.type === 'select') {
                    const selectEl = document.createElement('select');
                    selectEl.className = 'modal-field-select';
                    selectEl.id = `modal-field-${field.name}`;
                    if (field.options && field.options.length > 0) {
                        field.options.forEach(opt => {
                            const option = document.createElement('option');
                            // Support both plain strings and {value, label} objects
                            if (typeof opt === 'string') {
                                option.value = opt;
                                option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
                            } else {
                                option.value = opt.value;
                                option.textContent = opt.label;
                                if (opt.selected) option.selected = true;
                            }
                            selectEl.appendChild(option);
                        });
                    }
                    if (field.defaultValue) selectEl.value = field.defaultValue;
                    fieldDiv.appendChild(selectEl);
                } else if (field.type === 'textarea') {
                    const textareaEl = document.createElement('textarea');
                    textareaEl.className = 'modal-field-input';
                    textareaEl.id = `modal-field-${field.name}`;
                    textareaEl.rows = field.rows || 3;
                    textareaEl.placeholder = field.placeholder || '';
                    if (field.defaultValue) textareaEl.value = field.defaultValue;
                    fieldDiv.appendChild(textareaEl);
                } else {
                    const inputEl = document.createElement('input');
                    inputEl.type = field.type || 'text';
                    inputEl.className = 'modal-field-input';
                    inputEl.id = `modal-field-${field.name}`;
                    inputEl.placeholder = field.placeholder || '';
                    if (field.defaultValue) inputEl.value = field.defaultValue;
                    fieldDiv.appendChild(inputEl);
                }

                // Document picker: allow selecting from device (upload) or existing resources
                if (field.type === 'docpicker') {
                    const pickerDiv = document.createElement('div');
                    pickerDiv.className = 'modal-docpicker';

                    const sourceRow = document.createElement('div');
                    sourceRow.style.display = 'flex';
                    sourceRow.style.gap = '12px';

                    const deviceLabel = document.createElement('label');
                    deviceLabel.style.display = 'flex';
                    deviceLabel.style.alignItems = 'center';
                    const deviceRadio = document.createElement('input');
                    deviceRadio.type = 'radio';
                    deviceRadio.name = `modal-doc-source-${field.name}`;
                    deviceRadio.value = 'device';
                    deviceRadio.checked = true;
                    deviceLabel.appendChild(deviceRadio);
                    deviceLabel.appendChild(document.createTextNode(' From device'));

                    const resourcesLabel = document.createElement('label');
                    resourcesLabel.style.display = 'flex';
                    resourcesLabel.style.alignItems = 'center';
                    const resourcesRadio = document.createElement('input');
                    resourcesRadio.type = 'radio';
                    resourcesRadio.name = `modal-doc-source-${field.name}`;
                    resourcesRadio.value = 'resources';
                    resourcesLabel.appendChild(resourcesRadio);
                    resourcesLabel.appendChild(document.createTextNode(' From resources'));

                    sourceRow.appendChild(deviceLabel);
                    sourceRow.appendChild(resourcesLabel);
                    pickerDiv.appendChild(sourceRow);

                    // File input for device
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.multiple = true;
                    fileInput.className = 'modal-field-files';
                    fileInput.id = `modal-field-${field.name}-files`;
                    fileInput.style.marginTop = '8px';
                    pickerDiv.appendChild(fileInput);

                    // Resources select (will be populated asynchronously)
                    const resourcesSelect = document.createElement('select');
                    resourcesSelect.multiple = true;
                    resourcesSelect.style.display = 'none';
                    resourcesSelect.style.marginTop = '8px';
                    resourcesSelect.className = 'modal-field-select';
                    resourcesSelect.id = `modal-field-${field.name}-resources`;
                    pickerDiv.appendChild(resourcesSelect);

                    // Hidden input to capture the resulting attachment IDs/JSON
                    const hiddenInput = document.createElement('input');
                    hiddenInput.type = 'hidden';
                    hiddenInput.className = 'modal-field-input';
                    hiddenInput.id = `modal-field-${field.name}`;
                    hiddenInput.value = field.defaultValue || '';
                    pickerDiv.appendChild(hiddenInput);

                    // Toggle display based on radio
                    function updatePickerVisibility() {
                        if (deviceRadio.checked) {
                            fileInput.style.display = 'block';
                            resourcesSelect.style.display = 'none';
                        } else {
                            fileInput.style.display = 'none';
                            resourcesSelect.style.display = 'block';
                        }
                    }
                    deviceRadio.addEventListener('change', updatePickerVisibility);
                    resourcesRadio.addEventListener('change', updatePickerVisibility);

                    // When resources selected, update hidden input with IDs
                    resourcesSelect.addEventListener('change', () => {
                        const ids = Array.from(resourcesSelect.selectedOptions).map(o => o.value);
                        hiddenInput.value = ids.join(',');
                    });

                    // Handle file uploads: upload each file and collect returned IDs
                    fileInput.addEventListener('change', async () => {
                        if (!fileInput.files || fileInput.files.length === 0) return;
                        const uploadedIds = [];
                        for (let i = 0; i < fileInput.files.length; i++) {
                            const f = fileInput.files[i];
                            const form = new FormData();
                            form.append('file', f);
                            form.append('title', f.name);
                            const ext = f.name.split('.').pop().toLowerCase();
                            form.append('file_type', ext);
                            try {
                                const resp = await fetch('http://127.0.0.1:8000/api/documents', { method: 'POST', body: form });
                                if (resp.ok) {
                                    const data = await resp.json();
                                    if (data && data.id) uploadedIds.push(data.id);
                                }
                            } catch (e) {
                                console.error('Error uploading file from docpicker:', e);
                            }
                        }
                        if (uploadedIds.length > 0) hiddenInput.value = uploadedIds.join(',');
                    });

                    // Populate resources list asynchronously
                    try {
                        apiFetch('/api/documents').then(async (r) => {
                            try {
                                const data = await r.json();
                                const docs = data.documents || [];
                                docs.forEach(doc => {
                                    const opt = document.createElement('option');
                                    opt.value = String(doc.id);
                                    opt.textContent = `${doc.title} (${doc.id})`;
                                    resourcesSelect.appendChild(opt);
                                });
                            } catch (ee) { console.error('Error parsing docs for docpicker', ee); }
                        }).catch(err => { console.error('Error fetching docs for docpicker', err); });
                    } catch (e) { }

                    fieldsContainer.appendChild(pickerDiv);
                }

                fieldsContainer.appendChild(fieldDiv);
            });
            // Focus first input
            const firstInput = fieldsContainer.querySelector('input, select, textarea');
            if (firstInput) firstInput.focus();
        }
    } else if (modalType === 'input' || modalType === 'prompt') {
        input.style.display = 'block';
        input.placeholder = options.placeholder || 'Enter value...';
        if (options.defaultValue) input.value = options.defaultValue;
        input.focus();
    } else if (modalType === 'textarea') {
        textarea.style.display = 'block';
        textarea.placeholder = options.placeholder || 'Enter text...';
        if (options.defaultValue) textarea.value = options.defaultValue;
        textarea.focus();
    } else if (modalType === 'select') {
        select.style.display = 'block';
        if (options.options && options.options.length > 0) {
            options.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                if (opt.selected) option.selected = true;
                select.appendChild(option);
            });
        }
        select.focus();
    }

    // Configure buttons
    if (modalType === 'alert') {
        cancelBtn.style.display = 'none';
        confirmBtn.textContent = 'OK';
    } else {
        cancelBtn.style.display = 'block';
        cancelBtn.textContent = options.cancelText || 'Cancel';
        confirmBtn.textContent = options.confirmText || 'Confirm';
    }

    // Store callback
    modalCallback = options.callback;

    // Show modal
    overlay.style.display = 'flex';
    overlay.style.pointerEvents = 'auto';
    // Close modal when clicking outside the container (but not when clicking inside)
    function __overlayClickHandler(e) {
        if (e.target === overlay) {
            closeModal();
        }
    }
    // store handler so we can remove it later
    overlay.__overlayClickHandler = __overlayClickHandler;
    overlay.addEventListener('click', __overlayClickHandler);
    console.log('Modal shown');

    // Handle Enter key for input modals
    if (modalType === 'input' || modalType === 'prompt') {
        input.addEventListener('keydown', handleModalEnter);
    }
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    const input = document.getElementById('modal-input');

    if (overlay) {
        overlay.style.display = 'none';
        overlay.style.pointerEvents = 'none';
        if (overlay.__overlayClickHandler) {
            overlay.removeEventListener('click', overlay.__overlayClickHandler);
            delete overlay.__overlayClickHandler;
        }
    }
    input.removeEventListener('keydown', handleModalEnter);

    if (modalCallback && modalType !== 'alert') {
        modalCallback(null);
    }

    modalCallback = null;
    modalType = null;
}

function confirmModal() {
    const overlay = document.getElementById('modal-overlay');
    const fieldsContainer = document.getElementById('modal-fields-container');
    const input = document.getElementById('modal-input');
    const textarea = document.getElementById('modal-textarea');
    const select = document.getElementById('modal-select');

    let value = null;

    if (modalType === 'multi') {
        // Collect all field values
        value = {};
        fieldsContainer.querySelectorAll('.modal-field-input, .modal-field-select').forEach(el => {
            const fieldName = el.id.replace('modal-field-', '');
            value[fieldName] = el.value;
        });
    } else if (modalType === 'input' || modalType === 'prompt') {
        value = input.value;
    } else if (modalType === 'textarea') {
        value = textarea.value;
    } else if (modalType === 'select') {
        value = select.value;
    } else if (modalType === 'confirm') {
        value = true;
    }

    overlay.style.display = 'none';
    if (overlay) {
        overlay.style.pointerEvents = 'none';
        if (overlay.__overlayClickHandler) {
            overlay.removeEventListener('click', overlay.__overlayClickHandler);
            delete overlay.__overlayClickHandler;
        }
    }
    input.removeEventListener('keydown', handleModalEnter);

    if (modalCallback) {
        modalCallback(value);
    }

    modalCallback = null;
    modalType = null;
}

function handleModalEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        confirmModal();
    }
}

// Convenience functions
function showAlert(message, title = 'Alert') {
    console.log('showAlert called:', message);
    showModal({
        type: 'alert',
        title: title,
        message: message,
        callback: () => { }
    });
}

function showConfirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
        showModal({
            type: 'confirm',
            title: title,
            message: message,
            callback: (result) => resolve(result)
        });
    });
}

function showPrompt(message, defaultValue = '', title = 'Input', placeholder = 'Enter value...') {
    return new Promise((resolve) => {
        showModal({
            type: 'prompt',
            title: title,
            message: message,
            defaultValue: defaultValue,
            placeholder: placeholder,
            callback: (result) => resolve(result)
        });
    });
}

function showInput(message, defaultValue = '', title = 'Input', placeholder = 'Enter value...') {
    return new Promise((resolve) => {
        showModal({
            type: 'input',
            title: title,
            message: message,
            defaultValue: defaultValue,
            placeholder: placeholder,
            callback: (result) => resolve(result)
        });
    });
}

function showTextarea(message, defaultValue = '', title = 'Input', placeholder = 'Enter text...') {
    return new Promise((resolve) => {
        showModal({
            type: 'textarea',
            title: title,
            message: message,
            defaultValue: defaultValue,
            placeholder: placeholder,
            callback: (result) => resolve(result)
        });
    });
}

function showSelect(message, options, title = 'Select') {
    return new Promise((resolve) => {
        showModal({
            type: 'select',
            title: title,
            message: message,
            options: options,
            callback: (result) => resolve(result)
        });
    });
}

function showMultiField(fields, title = 'Input', message = '') {
    return new Promise((resolve) => {
        showModal({
            type: 'multi',
            title: title,
            message: message,
            fields: fields,
            callback: (result) => resolve(result)
        });
    });
}

// Quick Toolbox Functions
function toggleToolboxDropdown() {
    const menu = document.getElementById('toolbox-dropdown-menu');
    if (menu.style.display === 'none') {
        menu.style.display = 'block';
    } else {
        menu.style.display = 'none';
    }
}

function openToolboxModal(tool) {
    const modal = document.getElementById('draggable-toolbox-modal');
    const title = document.getElementById('toolbox-modal-title');
    const content = document.getElementById('toolbox-modal-content');

    // Close dropdown
    document.getElementById('toolbox-dropdown-menu').style.display = 'none';

    // Set content based on tool
    let html = '';
    switch (tool) {
        case 'ohms':
            title.textContent = 'Ohm\'s Law Calculator';
            html = `
                <div class="toolbox-calc-inputs">
                    <input type="number" id="tb_ohms_v" class="toolbox-calc-input" placeholder="Voltage (V)">
                    <input type="number" id="tb_ohms_i" class="toolbox-calc-input" placeholder="Current (A)">
                    <input type="number" id="tb_ohms_r" class="toolbox-calc-input" placeholder="Resistance (Ω)">
                </div>
                <button class="btn btn-primary" onclick="calculateToolboxOhms()">Calculate</button>
                <div id="tb_ohms_result" class="toolbox-calc-result"></div>
            `;
            break;
        case 'power':
            title.textContent = 'Power Calculator';
            html = `
                <div class="toolbox-calc-inputs">
                    <input type="number" id="tb_power_v" class="toolbox-calc-input" placeholder="Voltage (V)">
                    <input type="number" id="tb_power_i" class="toolbox-calc-input" placeholder="Current (A)">
                </div>
                <button class="btn btn-primary" onclick="calculateToolboxPower()">Calculate</button>
                <div id="tb_power_result" class="toolbox-calc-result"></div>
            `;
            break;
        case 'resistance':
            title.textContent = 'Resistance Calculator';
            html = `
                <div class="toolbox-calc-inputs">
                    <input type="number" id="tb_res_v" class="toolbox-calc-input" placeholder="Voltage (V)">
                    <input type="number" id="tb_res_i" class="toolbox-calc-input" placeholder="Current (A)">
                </div>
                <button class="btn btn-primary" onclick="calculateToolboxResistance()">Calculate</button>
                <div id="tb_res_result" class="toolbox-calc-result"></div>
            `;
            break;
        case 'voltage-divider':
            title.textContent = 'Voltage Divider Calculator';
            html = `
                <div class="toolbox-calc-inputs">
                    <input type="number" id="tb_vd_vin" class="toolbox-calc-input" placeholder="Input Voltage (V)">
                    <input type="number" id="tb_vd_r1" class="toolbox-calc-input" placeholder="R1 (Ω)">
                    <input type="number" id="tb_vd_r2" class="toolbox-calc-input" placeholder="R2 (Ω)">
                </div>
                <button class="btn btn-primary" onclick="calculateToolboxVoltageDivider()">Calculate</button>
                <div id="tb_vd_result" class="toolbox-calc-result"></div>
            `;
            break;
        case 'scientific':
            title.textContent = 'Scientific Calculator';
            html = `
                <div class="scientific-calculator">
                    <div class="calc-mode-selector">
                        <button class="calc-mode-btn calc-mode-active" onclick="setCalcMode('standard')" data-mode="standard">Standard</button>
                        <button class="calc-mode-btn" onclick="setCalcMode('quadratic')" data-mode="quadratic">Quadratic Eq</button>
                        <button class="calc-mode-btn" onclick="setCalcMode('simultaneous')" data-mode="simultaneous">Simultaneous</button>
                        <button class="calc-mode-btn" onclick="setCalcMode('matrix')" data-mode="matrix">Matrix</button>
                        <button class="calc-mode-btn" onclick="setCalcMode('vector')" data-mode="vector">Vector</button>
                        <button class="calc-mode-btn" onclick="setCalcMode('integral')" data-mode="integral">Integral</button>
                        <button class="calc-mode-btn" onclick="setCalcMode('derivative')" data-mode="derivative">Derivative</button>
                    </div>
                    <input type="text" class="calc-display" id="calc-display" value="0" autocomplete="off" spellcheck="false">
                    <div class="calc-buttons" id="calc-buttons-standard">
                        <div class="calc-row">
                            <button class="calc-btn calc-btn-func" onclick="calcInput('sin')">sin</button>
                            <button class="calc-btn calc-btn-func" onclick="calcInput('cos')">cos</button>
                            <button class="calc-btn calc-btn-func" onclick="calcInput('tan')">tan</button>
                            <button class="calc-btn calc-btn-func" onclick="calcInput('sqrt')">√</button>
                        </div>
                        <div class="calc-row">
                            <button class="calc-btn calc-btn-func" onclick="calcInput('log')">log</button>
                            <button class="calc-btn calc-btn-func" onclick="calcInput('ln')">ln</button>
                            <button class="calc-btn calc-btn-func" onclick="calcInput('^')">x^y</button>
                            <button class="calc-btn calc-btn-func" onclick="calcInput('(')">(</button>
                        </div>
                        <div class="calc-row">
                            <button class="calc-btn calc-btn-func" onclick="calcInput(')')">)</button>
                            <button class="calc-btn calc-btn-func" onclick="calcInput('pi')">π</button>
                            <button class="calc-btn calc-btn-func" onclick="calcInput('e')">e</button>
                            <button class="calc-btn calc-btn-func" onclick="calcInput('!')">x!</button>
                        </div>
                        <div class="calc-row">
                            <button class="calc-btn calc-btn-num" onclick="calcInput('7')">7</button>
                            <button class="calc-btn calc-btn-num" onclick="calcInput('8')">8</button>
                            <button class="calc-btn calc-btn-num" onclick="calcInput('9')">9</button>
                            <button class="calc-btn calc-btn-op" onclick="calcInput('/')">÷</button>
                        </div>
                        <div class="calc-row">
                            <button class="calc-btn calc-btn-num" onclick="calcInput('4')">4</button>
                            <button class="calc-btn calc-btn-num" onclick="calcInput('5')">5</button>
                            <button class="calc-btn calc-btn-num" onclick="calcInput('6')">6</button>
                            <button class="calc-btn calc-btn-op" onclick="calcInput('*')">×</button>
                        </div>
                        <div class="calc-row">
                            <button class="calc-btn calc-btn-num" onclick="calcInput('1')">1</button>
                            <button class="calc-btn calc-btn-num" onclick="calcInput('2')">2</button>
                            <button class="calc-btn calc-btn-num" onclick="calcInput('3')">3</button>
                            <button class="calc-btn calc-btn-op" onclick="calcInput('-')">−</button>
                        </div>
                        <div class="calc-row">
                            <button class="calc-btn calc-btn-num" onclick="calcInput('0')">0</button>
                            <button class="calc-btn calc-btn-num" onclick="calcInput('.')">.</button>
                            <button class="calc-btn calc-btn-equal" onclick="calcEqual()">=</button>
                            <button class="calc-btn calc-btn-op" onclick="calcInput('+')">+</button>
                        </div>
                        <div class="calc-row">
                            <button class="calc-btn calc-btn-clear" onclick="calcClear()">C</button>
                            <button class="calc-btn calc-btn-clear" onclick="calcBackspace()">⌫</button>
                        </div>
                    </div>
                    <div class="calc-buttons" id="calc-buttons-quadratic" style="display: none;">
                        <div class="calc-equation-form">
                            <p class="calc-equation-label">Solve: ax² + bx + c = 0</p>
                            <div class="calc-input-row">
                                <label>a =</label>
                                <input type="number" id="quadratic-a" class="calc-input" placeholder="a">
                            </div>
                            <div class="calc-input-row">
                                <label>b =</label>
                                <input type="number" id="quadratic-b" class="calc-input" placeholder="b">
                            </div>
                            <div class="calc-input-row">
                                <label>c =</label>
                                <input type="number" id="quadratic-c" class="calc-input" placeholder="c">
                            </div>
                            <button class="calc-btn calc-btn-equal" onclick="solveQuadraticEquation()">Solve</button>
                            <div id="quadratic-result" class="calc-result"></div>
                        </div>
                    </div>
                    <div class="calc-buttons" id="calc-buttons-simultaneous" style="display: none;">
                        <div class="calc-equation-form">
                            <p class="calc-equation-label">Solve: Simultaneous Equations</p>
                            <div class="calc-sim-mode-selector">
                                <button class="calc-sim-mode-btn calc-sim-mode-active" onclick="setSimMode('2x3')" data-mode="2x3">2x3</button>
                                <button class="calc-sim-mode-btn" onclick="setSimMode('3x3')" data-mode="3x3">3x3</button>
                            </div>
                            <div class="calc-matrix-layout">
                                <div class="calc-coefficient-grid">
                                    <input type="number" id="sim-a1" class="calc-input" placeholder="a₁">
                                    <input type="number" id="sim-b1" class="calc-input" placeholder="b₁">
                                    <input type="number" id="sim-c1" class="calc-input" placeholder="c₁">
                                    <input type="number" id="sim-a2" class="calc-input" placeholder="a₂">
                                    <input type="number" id="sim-b2" class="calc-input" placeholder="b₂">
                                    <input type="number" id="sim-c2" class="calc-input" placeholder="c₂">
                                    <input type="number" id="sim-a3" class="calc-input sim-row-3" placeholder="a₃">
                                    <input type="number" id="sim-b3" class="calc-input sim-row-3" placeholder="b₃">
                                    <input type="number" id="sim-c3" class="calc-input sim-row-3" placeholder="c₃">
                                </div>
                                <div class="calc-constants-column">
                                    <input type="number" id="sim-d1" class="calc-input" placeholder="d₁">
                                    <input type="number" id="sim-d2" class="calc-input" placeholder="d₂">
                                    <input type="number" id="sim-d3" class="calc-input sim-row-3" placeholder="d₃">
                                </div>
                            </div>
                            <button class="calc-btn calc-btn-equal" onclick="solveSimultaneousEquations()">Solve</button>
                            <div id="simultaneous-result" class="calc-result"></div>
                        </div>
                    </div>
                    <div class="calc-buttons" id="calc-buttons-integral" style="display: none;">
                        <div class="calc-equation-form">
                            <p class="calc-equation-label">Numerical Integration (Trapezoidal Rule)</p>
                            <div class="calc-input-row">
                                <label>f(x) =</label>
                                <input type="text" id="integral-func" class="calc-input" placeholder="e.g., x^2">
                            </div>
                            <div class="calc-input-row">
                                <label>a =</label>
                                <input type="number" id="integral-a" class="calc-input" placeholder="lower bound">
                            </div>
                            <div class="calc-input-row">
                                <label>b =</label>
                                <input type="number" id="integral-b" class="calc-input" placeholder="upper bound">
                            </div>
                            <div class="calc-input-row">
                                <label>n =</label>
                                <input type="number" id="integral-n" class="calc-input" placeholder="intervals" value="100">
                            </div>
                            <button class="calc-btn calc-btn-equal" onclick="calculateIntegral()">Integrate</button>
                            <div id="integral-result" class="calc-result"></div>
                        </div>
                    </div>
                    <div class="calc-buttons" id="calc-buttons-derivative" style="display: none;">
                        <div class="calc-equation-form">
                            <p class="calc-equation-label">Numerical Derivative</p>
                            <div class="calc-input-row">
                                <label>f(x) =</label>
                                <input type="text" id="derivative-func" class="calc-input" placeholder="e.g., x^2">
                            </div>
                            <div class="calc-input-row">
                                <label>x =</label>
                                <input type="number" id="derivative-x" class="calc-input" placeholder="point">
                            </div>
                            <div class="calc-input-row">
                                <label>h =</label>
                                <input type="number" id="derivative-h" class="calc-input" placeholder="step size" value="0.0001">
                            </div>
                            <button class="calc-btn calc-btn-equal" onclick="calculateDerivative()">Differentiate</button>
                            <div id="derivative-result" class="calc-result"></div>
                        </div>
                    </div>
                    <div class="calc-buttons" id="calc-buttons-matrix" style="display: none;">
                        <div class="calc-equation-form">
                            <p class="calc-equation-label">Matrix Operations</p>
                            <div class="calc-matrix-mode-selector">
                                <button class="calc-matrix-mode-btn calc-matrix-mode-active" onclick="setMatrixMode('add')" data-mode="add">Add</button>
                                <button class="calc-matrix-mode-btn" onclick="setMatrixMode('subtract')" data-mode="subtract">Subtract</button>
                                <button class="calc-matrix-mode-btn" onclick="setMatrixMode('multiply')" data-mode="multiply">Multiply</button>
                                <button class="calc-matrix-mode-btn" onclick="setMatrixMode('determinant')" data-mode="determinant">Determinant</button>
                                <button class="calc-matrix-mode-btn" onclick="setMatrixMode('inverse')" data-mode="inverse">Inverse</button>
                            </div>
                            <div class="calc-matrix-input-section" id="matrix-input-section">
                                <div class="calc-matrix-label">Matrix A (comma-separated rows, space-separated values):</div>
                                <textarea id="matrix-a" class="calc-textarea" rows="3" placeholder="1 2 3, 4 5 6, 7 8 9"></textarea>
                                <div class="calc-matrix-label" id="matrix-b-label">Matrix B:</div>
                                <textarea id="matrix-b" class="calc-textarea" rows="3" placeholder="1 2 3, 4 5 6, 7 8 9" style="display: none;"></textarea>
                            </div>
                            <button class="calc-btn calc-btn-equal" onclick="calculateMatrix()">Calculate</button>
                            <div id="matrix-result" class="calc-result"></div>
                        </div>
                    </div>
                    <div class="calc-buttons" id="calc-buttons-vector" style="display: none;">
                        <div class="calc-equation-form">
                            <p class="calc-equation-label">Vector Operations</p>
                            <div class="calc-vector-mode-selector">
                                <button class="calc-vector-mode-btn calc-vector-mode-active" onclick="setVectorMode('dot')" data-mode="dot">Dot Product</button>
                                <button class="calc-vector-mode-btn" onclick="setVectorMode('cross')" data-mode="cross">Cross Product</button>
                                <button class="calc-vector-mode-btn" onclick="setVectorMode('magnitude')" data-mode="magnitude">Magnitude</button>
                                <button class="calc-vector-mode-btn" onclick="setVectorMode('normalize')" data-mode="normalize">Normalize</button>
                                <button class="calc-vector-mode-btn" onclick="setVectorMode('angle')" data-mode="angle">Angle Between</button>
                            </div>
                            <div class="calc-vector-input-section">
                                <div class="calc-vector-label">Vector A (space-separated):</div>
                                <input type="text" id="vector-a" class="calc-input" placeholder="1 2 3">
                                <div class="calc-vector-label" id="vector-b-label">Vector B:</div>
                                <input type="text" id="vector-b" class="calc-input" placeholder="1 2 3" style="display: none;">
                            </div>
                            <button class="calc-btn calc-btn-equal" onclick="calculateVector()">Calculate</button>
                            <div id="vector-result" class="calc-result"></div>
                        </div>
                    </div>
                </div>
            `;
            break;
    }

    content.innerHTML = html;
    modal.style.display = 'block';

    // Initialize dragging
    initDraggable();

    // Initialize calculator keyboard support
    initCalcKeyboard();
}

function initCalcKeyboard() {
    const display = document.getElementById('calc-display');
    if (!display) return;

    display.addEventListener('keydown', function (e) {
        // Allow cursor navigation and editing
        if (e.key === 'Enter') {
            e.preventDefault();
            calcEqual();
        } else if (e.key === 'Escape') {
            calcClear();
        } else if (e.key === 'Backspace') {
            // Allow default backspace behavior for cursor deletion
        } else if (e.key === 'Delete') {
            // Allow default delete behavior
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
            e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
            e.key === 'Home' || e.key === 'End') {
            // Allow cursor navigation
        } else if (e.ctrlKey || e.metaKey) {
            // Allow copy/paste
        } else if (e.key === ' ') {
            e.preventDefault();
        }
        // Other keys are allowed for direct input
    });

    // Update calcDisplay variable when input changes
    display.addEventListener('input', function () {
        calcDisplay = display.value;
    });
}

function closeToolboxModal() {
    document.getElementById('draggable-toolbox-modal').style.display = 'none';
}

function calculateToolboxOhms() {
    const v = parseFloat(document.getElementById('tb_ohms_v').value);
    const i = parseFloat(document.getElementById('tb_ohms_i').value);
    const r = parseFloat(document.getElementById('tb_ohms_r').value);

    let result = '';

    if (v && i) {
        result = `R = ${(v / i).toFixed(2)} Ω`;
    } else if (v && r) {
        result = `I = ${(v / r).toFixed(2)} A`;
    } else if (i && r) {
        result = `V = ${(i * r).toFixed(2)} V`;
    } else {
        result = 'Enter 2 values';
    }

    document.getElementById('tb_ohms_result').textContent = result;
}

function calculateToolboxPower() {
    const v = parseFloat(document.getElementById('tb_power_v').value);
    const i = parseFloat(document.getElementById('tb_power_i').value);

    if (v && i) {
        const power = v * i;
        document.getElementById('tb_power_result').textContent = `P = ${power.toFixed(2)} W`;
    } else {
        document.getElementById('tb_power_result').textContent = 'Enter V and I';
    }
}

function calculateToolboxResistance() {
    const v = parseFloat(document.getElementById('tb_res_v').value);
    const i = parseFloat(document.getElementById('tb_res_i').value);

    if (v && i) {
        const r = v / i;
        document.getElementById('tb_res_result').textContent = `R = ${r.toFixed(2)} Ω`;
    } else {
        document.getElementById('tb_res_result').textContent = 'Enter V and I';
    }
}

function calculateToolboxVoltageDivider() {
    const vin = parseFloat(document.getElementById('tb_vd_vin').value);
    const r1 = parseFloat(document.getElementById('tb_vd_r1').value);
    const r2 = parseFloat(document.getElementById('tb_vd_r2').value);

    if (vin && r1 && r2) {
        const vout = vin * (r2 / (r1 + r2));
        document.getElementById('tb_vd_result').textContent = `Vout = ${vout.toFixed(2)} V`;
    } else {
        document.getElementById('tb_vd_result').textContent = 'Enter Vin, R1, R2';
    }
}

function calculateToolboxScientific() {
    const value = parseFloat(document.getElementById('tb_sci_value').value);
    const func = document.getElementById('tb_sci_function').value;

    if (isNaN(value)) {
        document.getElementById('tb_sci_result').textContent = 'Enter a value';
        return;
    }

    // Convert degrees to radians
    const radians = value * (Math.PI / 180);
    let result = 0;

    switch (func) {
        case 'sin':
            result = Math.sin(radians);
            document.getElementById('tb_sci_result').textContent = `sin(${value}°) = ${result.toFixed(4)}`;
            break;
        case 'cos':
            result = Math.cos(radians);
            document.getElementById('tb_sci_result').textContent = `cos(${value}°) = ${result.toFixed(4)}`;
            break;
        case 'tan':
            result = Math.tan(radians);
            document.getElementById('tb_sci_result').textContent = `tan(${value}°) = ${result.toFixed(4)}`;
            break;
    }
}

// Scientific Calculator Functions
let calcExpression = '';
let calcDisplay = '0';
let calcMode = 'standard';
let matrixMode = 'add';
let vectorMode = 'dot';

function setCalcMode(mode) {
    calcMode = mode;

    // Update mode buttons
    document.querySelectorAll('.calc-mode-btn').forEach(btn => {
        btn.classList.remove('calc-mode-active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('calc-mode-active');
        }
    });

    // Hide all button sets
    document.getElementById('calc-buttons-standard').style.display = 'none';
    document.getElementById('calc-buttons-quadratic').style.display = 'none';
    document.getElementById('calc-buttons-simultaneous').style.display = 'none';
    document.getElementById('calc-buttons-matrix').style.display = 'none';
    document.getElementById('calc-buttons-vector').style.display = 'none';
    document.getElementById('calc-buttons-integral').style.display = 'none';
    document.getElementById('calc-buttons-derivative').style.display = 'none';

    // Show selected mode
    document.getElementById(`calc-buttons-${mode}`).style.display = 'flex';

    // Show/hide display based on mode
    const display = document.getElementById('calc-display');
    if (mode === 'standard') {
        display.style.display = 'block';
    } else {
        display.style.display = 'none';
    }

    // Clear results
    document.getElementById('quadratic-result').textContent = '';
    document.getElementById('simultaneous-result').textContent = '';
    document.getElementById('matrix-result').textContent = '';
    document.getElementById('vector-result').textContent = '';
    document.getElementById('integral-result').textContent = '';
    document.getElementById('derivative-result').textContent = '';
}

let simMode = '2x3';

function setSimMode(mode) {
    simMode = mode;

    // Update mode buttons
    document.querySelectorAll('.calc-sim-mode-btn').forEach(btn => {
        btn.classList.remove('calc-sim-mode-active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('calc-sim-mode-active');
        }
    });

    // Show/hide third row inputs
    const row3Inputs = document.querySelectorAll('.sim-row-3');
    if (mode === '3x3') {
        row3Inputs.forEach(input => input.classList.add('visible'));
    } else {
        row3Inputs.forEach(input => input.classList.remove('visible'));
    }

    // Clear result
    document.getElementById('simultaneous-result').textContent = '';
}

function setMatrixMode(mode) {
    matrixMode = mode;

    // Update mode buttons
    document.querySelectorAll('.calc-matrix-mode-btn').forEach(btn => {
        btn.classList.remove('calc-matrix-mode-active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('calc-matrix-mode-active');
        }
    });

    // Show/hide matrix B based on operation
    const matrixBLabel = document.getElementById('matrix-b-label');
    const matrixB = document.getElementById('matrix-b');

    if (mode === 'add' || mode === 'subtract' || mode === 'multiply') {
        matrixBLabel.style.display = 'block';
        matrixB.style.display = 'block';
    } else {
        matrixBLabel.style.display = 'none';
        matrixB.style.display = 'none';
    }

    // Clear result
    document.getElementById('matrix-result').textContent = '';
}

function setVectorMode(mode) {
    vectorMode = mode;

    // Update mode buttons
    document.querySelectorAll('.calc-vector-mode-btn').forEach(btn => {
        btn.classList.remove('calc-vector-mode-active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('calc-vector-mode-active');
        }
    });

    // Show/hide vector B based on operation
    const vectorBLabel = document.getElementById('vector-b-label');
    const vectorB = document.getElementById('vector-b');

    if (mode === 'dot' || mode === 'cross' || mode === 'angle') {
        vectorBLabel.style.display = 'block';
        vectorB.style.display = 'block';
    } else {
        vectorBLabel.style.display = 'none';
        vectorB.style.display = 'none';
    }

    // Clear result
    document.getElementById('vector-result').textContent = '';
}

function parseMatrix(input) {
    const rows = input.split(',').map(row => row.trim());
    const matrix = rows.map(row => row.split(/\s+/).map(val => parseFloat(val)));
    return matrix;
}

function formatMatrix(matrix) {
    return matrix.map(row => row.map(val => val.toFixed(2)).join('  ')).join('\n');
}

function calculateMatrix() {
    const matrixAInput = document.getElementById('matrix-a').value;
    const matrixBInput = document.getElementById('matrix-b').value;
    const resultDiv = document.getElementById('matrix-result');

    try {
        const matrixA = parseMatrix(matrixAInput);

        if (matrixMode === 'determinant') {
            const det = calculateDeterminant(matrixA);
            resultDiv.textContent = `Determinant: ${det.toFixed(4)}`;
        } else if (matrixMode === 'inverse') {
            const inverse = calculateMatrixInverse(matrixA);
            if (inverse) {
                resultDiv.textContent = `Inverse:\n${formatMatrix(inverse)}`;
            } else {
                resultDiv.textContent = 'Matrix is not invertible (determinant = 0)';
            }
        } else {
            const matrixB = parseMatrix(matrixBInput);

            if (matrixMode === 'add') {
                const result = matrixAdd(matrixA, matrixB);
                resultDiv.textContent = `Result:\n${formatMatrix(result)}`;
            } else if (matrixMode === 'subtract') {
                const result = matrixSubtract(matrixA, matrixB);
                resultDiv.textContent = `Result:\n${formatMatrix(result)}`;
            } else if (matrixMode === 'multiply') {
                const result = matrixMultiply(matrixA, matrixB);
                resultDiv.textContent = `Result:\n${formatMatrix(result)}`;
            }
        }
    } catch (error) {
        resultDiv.textContent = `Error: ${error.message}`;
    }
}

function matrixAdd(A, B) {
    if (A.length !== B.length || A[0].length !== B[0].length) {
        throw new Error('Matrices must have the same dimensions');
    }
    return A.map((row, i) => row.map((val, j) => val + B[i][j]));
}

function matrixSubtract(A, B) {
    if (A.length !== B.length || A[0].length !== B[0].length) {
        throw new Error('Matrices must have the same dimensions');
    }
    return A.map((row, i) => row.map((val, j) => val - B[i][j]));
}

function matrixMultiply(A, B) {
    if (A[0].length !== B.length) {
        throw new Error('Number of columns in A must equal number of rows in B');
    }
    const result = [];
    for (let i = 0; i < A.length; i++) {
        result[i] = [];
        for (let j = 0; j < B[0].length; j++) {
            let sum = 0;
            for (let k = 0; k < B.length; k++) {
                sum += A[i][k] * B[k][j];
            }
            result[i][j] = sum;
        }
    }
    return result;
}

function calculateDeterminant(matrix) {
    if (matrix.length !== matrix[0].length) {
        throw new Error('Matrix must be square');
    }
    const n = matrix.length;

    if (n === 1) return matrix[0][0];
    if (n === 2) return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];

    let det = 0;
    for (let j = 0; j < n; j++) {
        det += matrix[0][j] * Math.pow(-1, j) * calculateDeterminant(getMinor(matrix, 0, j));
    }
    return det;
}

function getMinor(matrix, row, col) {
    return matrix.filter((_, i) => i !== row).map(row => row.filter((_, j) => j !== col));
}

function calculateMatrixInverse(matrix) {
    const det = calculateDeterminant(matrix);
    if (Math.abs(det) < 1e-10) return null;

    const n = matrix.length;
    const inverse = [];

    for (let i = 0; i < n; i++) {
        inverse[i] = [];
        for (let j = 0; j < n; j++) {
            const minor = getMinor(matrix, i, j);
            const cofactor = calculateDeterminant(minor) * Math.pow(-1, i + j);
            inverse[i][j] = cofactor / det;
        }
    }

    // Transpose
    return inverse[0].map((_, i) => inverse.map(row => row[i]));
}

function parseVector(input) {
    return input.split(/\s+/).map(val => parseFloat(val));
}

function calculateVector() {
    const vectorAInput = document.getElementById('vector-a').value;
    const vectorBInput = document.getElementById('vector-b').value;
    const resultDiv = document.getElementById('vector-result');

    try {
        const vectorA = parseVector(vectorAInput);

        if (vectorMode === 'magnitude') {
            const mag = calculateMagnitude(vectorA);
            resultDiv.textContent = `Magnitude: ${mag.toFixed(4)}`;
        } else if (vectorMode === 'normalize') {
            const normalized = normalizeVector(vectorA);
            resultDiv.textContent = `Normalized: [${normalized.map(v => v.toFixed(4)).join(', ')}]`;
        } else {
            const vectorB = parseVector(vectorBInput);

            if (vectorMode === 'dot') {
                const dot = dotProduct(vectorA, vectorB);
                resultDiv.textContent = `Dot Product: ${dot.toFixed(4)}`;
            } else if (vectorMode === 'cross') {
                if (vectorA.length !== 3 || vectorB.length !== 3) {
                    resultDiv.textContent = 'Cross product requires 3D vectors';
                } else {
                    const cross = crossProduct(vectorA, vectorB);
                    resultDiv.textContent = `Cross Product: [${cross.map(v => v.toFixed(4)).join(', ')}]`;
                }
            } else if (vectorMode === 'angle') {
                const angle = angleBetween(vectorA, vectorB);
                resultDiv.textContent = `Angle: ${angle.toFixed(4)} radians (${(angle * 180 / Math.PI).toFixed(2)}°)`;
            }
        }
    } catch (error) {
        resultDiv.textContent = `Error: ${error.message}`;
    }
}

function dotProduct(A, B) {
    if (A.length !== B.length) {
        throw new Error('Vectors must have the same dimension');
    }
    return A.reduce((sum, val, i) => sum + val * B[i], 0);
}

function crossProduct(A, B) {
    return [
        A[1] * B[2] - A[2] * B[1],
        A[2] * B[0] - A[0] * B[2],
        A[0] * B[1] - A[1] * B[0]
    ];
}

function calculateMagnitude(vector) {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
}

function normalizeVector(vector) {
    const mag = calculateMagnitude(vector);
    if (mag === 0) throw new Error('Cannot normalize zero vector');
    return vector.map(val => val / mag);
}

function angleBetween(A, B) {
    if (A.length !== B.length) {
        throw new Error('Vectors must have the same dimension');
    }
    const dot = dotProduct(A, B);
    const magA = calculateMagnitude(A);
    const magB = calculateMagnitude(B);
    if (magA === 0 || magB === 0) throw new Error('Cannot calculate angle with zero vector');
    return Math.acos(dot / (magA * magB));
}

function calcInput(value) {
    const display = document.getElementById('calc-display');
    if (!display) return;

    const startPos = display.selectionStart;
    const endPos = display.selectionEnd;
    const currentValue = display.value;

    if (currentValue === '0' && value !== '.') {
        display.value = value;
    } else {
        display.value = currentValue.slice(0, startPos) + value + currentValue.slice(endPos);
    }

    calcDisplay = display.value;

    // Move cursor after inserted value
    const newPos = startPos + value.length;
    display.setSelectionRange(newPos, newPos);
    display.focus();
}

function calcClear() {
    calcDisplay = '0';
    calcExpression = '';
    const display = document.getElementById('calc-display');
    if (display) {
        display.value = '0';
    }
}

function calcBackspace() {
    const display = document.getElementById('calc-display');
    if (!display) return;

    const startPos = display.selectionStart;
    const endPos = display.selectionEnd;
    const currentValue = display.value;

    if (startPos === endPos) {
        // Delete character before cursor
        if (startPos > 0) {
            display.value = currentValue.slice(0, startPos - 1) + currentValue.slice(endPos);
            display.setSelectionRange(startPos - 1, startPos - 1);
        }
    } else {
        // Delete selection
        display.value = currentValue.slice(0, startPos) + currentValue.slice(endPos);
        display.setSelectionRange(startPos, startPos);
    }

    if (display.value === '') {
        display.value = '0';
    }

    calcDisplay = display.value;
    display.focus();
}

function calcEqual() {
    const display = document.getElementById('calc-display');
    if (!display) return;

    try {
        let expression = display.value;

        // Replace mathematical functions with JavaScript equivalents
        expression = expression.replace(/sin\(/g, 'Math.sin(');
        expression = expression.replace(/cos\(/g, 'Math.cos(');
        expression = expression.replace(/tan\(/g, 'Math.tan(');
        expression = expression.replace(/asin\(/g, 'Math.asin(');
        expression = expression.replace(/acos\(/g, 'Math.acos(');
        expression = expression.replace(/atan\(/g, 'Math.atan(');
        expression = expression.replace(/log\(/g, 'Math.log10(');
        expression = expression.replace(/ln\(/g, 'Math.log(');
        expression = expression.replace(/sqrt\(/g, 'Math.sqrt(');
        expression = expression.replace(/\^/g, '**');
        expression = expression.replace(/pi/g, Math.PI);
        expression = expression.replace(/e/g, Math.E);
        expression = expression.replace(/abs\(/g, 'Math.abs(');

        // Handle 10^x
        expression = expression.replace(/10\^/g, 'Math.pow(10,');

        // Handle e^x
        expression = expression.replace(/e\^/g, 'Math.pow(Math.E,');

        // Handle 1/x
        expression = expression.replace(/1\//g, '1/');

        // Handle factorial
        expression = expression.replace(/(\d+)!/g, function (match, num) {
            return factorial(parseInt(num));
        });

        // Convert degrees to radians for trig functions
        expression = expression.replace(/Math\.(sin|cos|tan)\(([^)]+)\)/g, function (match, func, args) {
            return `Math.${func}((${args}) * Math.PI / 180)`;
        });

        const result = eval(expression);

        if (isNaN(result) || !isFinite(result)) {
            display.value = 'Error';
        } else {
            display.value = parseFloat(result.toFixed(8)).toString();
        }

        calcDisplay = display.value;
    } catch (error) {
        display.value = 'Error';
        calcDisplay = 'Error';
    }
}

function solveQuadraticEquation() {
    const a = parseFloat(document.getElementById('quadratic-a').value);
    const b = parseFloat(document.getElementById('quadratic-b').value);
    const c = parseFloat(document.getElementById('quadratic-c').value);
    const resultDiv = document.getElementById('quadratic-result');

    if (isNaN(a) || isNaN(b) || isNaN(c)) {
        resultDiv.textContent = 'Please enter valid numbers';
        return;
    }

    if (a === 0) {
        // Not quadratic, solve as linear
        if (b === 0) {
            if (c === 0) {
                resultDiv.textContent = 'Infinite solutions';
            } else {
                resultDiv.textContent = 'No solution';
            }
        } else {
            const x = -c / b;
            resultDiv.textContent = `x = ${x.toFixed(4)} (linear)`;
        }
        return;
    }

    const discriminant = b * b - 4 * a * c;

    if (discriminant > 0) {
        const x1 = (-b + Math.sqrt(discriminant)) / (2 * a);
        const x2 = (-b - Math.sqrt(discriminant)) / (2 * a);
        resultDiv.textContent = `x₁ = ${x1.toFixed(4)}, x₂ = ${x2.toFixed(4)}`;
    } else if (discriminant === 0) {
        const x = -b / (2 * a);
        resultDiv.textContent = `x = ${x.toFixed(4)} (double root)`;
    } else {
        const realPart = -b / (2 * a);
        const imagPart = Math.sqrt(-discriminant) / (2 * a);
        resultDiv.textContent = `x₁ = ${realPart.toFixed(4)} + ${imagPart.toFixed(4)}i, x₂ = ${realPart.toFixed(4)} - ${imagPart.toFixed(4)}i`;
    }
}

function solveSimultaneousEquations() {
    const a1 = parseFloat(document.getElementById('sim-a1').value);
    const b1 = parseFloat(document.getElementById('sim-b1').value);
    const c1 = parseFloat(document.getElementById('sim-c1').value);
    const d1 = parseFloat(document.getElementById('sim-d1').value);
    const a2 = parseFloat(document.getElementById('sim-a2').value);
    const b2 = parseFloat(document.getElementById('sim-b2').value);
    const c2 = parseFloat(document.getElementById('sim-c2').value);
    const d2 = parseFloat(document.getElementById('sim-d2').value);
    const resultDiv = document.getElementById('simultaneous-result');

    if (simMode === '2x3') {
        // 2x3 system (2 equations, 3 unknowns)
        if (isNaN(a1) || isNaN(b1) || isNaN(c1) || isNaN(d1) ||
            isNaN(a2) || isNaN(b2) || isNaN(c2) || isNaN(d2)) {
            resultDiv.textContent = 'Please enter valid numbers';
            return;
        }

        // For 2x3 system, we can solve for 2 variables in terms of the third
        // Solve for x and y in terms of z
        // a1*x + b1*y = d1 - c1*z
        // a2*x + b2*y = d2 - c2*z

        const det = a1 * b2 - a2 * b1;

        if (Math.abs(det) < 1e-10) {
            resultDiv.textContent = 'No unique solution (determinant = 0)';
            return;
        }

        resultDiv.textContent = 'x = ' + ((d1 * b2 - d2 * b1) / det).toFixed(4) + ' - ' + ((c1 * b2 - c2 * b1) / det).toFixed(4) + 'z, y = ' + ((a1 * d2 - a2 * d1) / det).toFixed(4) + ' - ' + ((a1 * c2 - a2 * c1) / det).toFixed(4) + 'z';
    } else {
        // 3x3 system (3 equations, 3 unknowns)
        const a3 = parseFloat(document.getElementById('sim-a3').value);
        const b3 = parseFloat(document.getElementById('sim-b3').value);
        const c3 = parseFloat(document.getElementById('sim-c3').value);
        const d3 = parseFloat(document.getElementById('sim-d3').value);

        if (isNaN(a1) || isNaN(b1) || isNaN(c1) || isNaN(d1) ||
            isNaN(a2) || isNaN(b2) || isNaN(c2) || isNaN(d2) ||
            isNaN(a3) || isNaN(b3) || isNaN(c3) || isNaN(d3)) {
            resultDiv.textContent = 'Please enter valid numbers';
            return;
        }

        // Calculate determinant of the coefficient matrix (3x3)
        const det = a1 * (b2 * c3 - b3 * c2) -
            b1 * (a2 * c3 - a3 * c2) +
            c1 * (a2 * b3 - a3 * b2);

        if (Math.abs(det) < 1e-10) {
            resultDiv.textContent = 'No unique solution (determinant = 0)';
            return;
        }

        // Calculate determinants for x, y, z using Cramer's rule
        const detX = d1 * (b2 * c3 - b3 * c2) -
            b1 * (d2 * c3 - d3 * c2) +
            c1 * (d2 * b3 - d3 * b2);

        const detY = a1 * (d2 * c3 - d3 * c2) -
            d1 * (a2 * c3 - a3 * c2) +
            c1 * (a2 * d3 - a3 * d2);

        const detZ = a1 * (b2 * d3 - b3 * d2) -
            b1 * (a2 * d3 - a3 * d2) +
            d1 * (a2 * b3 - a3 * b2);

        const x = detX / det;
        const y = detY / det;
        const z = detZ / det;

        resultDiv.textContent = `x = ${x.toFixed(4)}, y = ${y.toFixed(4)}, z = ${z.toFixed(4)}`;
    }
}

function calculateIntegral() {
    const funcStr = document.getElementById('integral-func').value;
    const a = parseFloat(document.getElementById('integral-a').value);
    const b = parseFloat(document.getElementById('integral-b').value);
    const n = parseInt(document.getElementById('integral-n').value);
    const resultDiv = document.getElementById('integral-result');

    if (!funcStr || isNaN(a) || isNaN(b) || isNaN(n)) {
        resultDiv.textContent = 'Please enter valid values';
        return;
    }

    try {
        const f = (x) => {
            // Simple function parser for basic expressions
            let expr = funcStr;
            expr = expr.replace(/\^/g, '**');
            expr = expr.replace(/sin\(/g, 'Math.sin(');
            expr = expr.replace(/cos\(/g, 'Math.cos(');
            expr = expr.replace(/tan\(/g, 'Math.tan(');
            expr = expr.replace(/sqrt\(/g, 'Math.sqrt(');
            expr = expr.replace(/log\(/g, 'Math.log10(');
            expr = expr.replace(/ln\(/g, 'Math.log(');
            expr = expr.replace(/pi/gi, Math.PI);
            expr = expr.replace(/e/gi, Math.E);
            return eval(expr);
        };

        const h = (b - a) / n;
        let sum = 0.5 * (f(a) + f(b));

        for (let i = 1; i < n; i++) {
            sum += f(a + i * h);
        }

        const result = sum * h;
        resultDiv.textContent = `∫ from ${a} to ${b} ≈ ${result.toFixed(6)}`;
    } catch (error) {
        resultDiv.textContent = 'Error evaluating function';
    }
}

function calculateDerivative() {
    const funcStr = document.getElementById('derivative-func').value;
    const x = parseFloat(document.getElementById('derivative-x').value);
    const h = parseFloat(document.getElementById('derivative-h').value);
    const resultDiv = document.getElementById('derivative-result');

    if (!funcStr || isNaN(x) || isNaN(h)) {
        resultDiv.textContent = 'Please enter valid values';
        return;
    }

    try {
        const f = (val) => {
            let expr = funcStr;
            expr = expr.replace(/\^/g, '**');
            expr = expr.replace(/sin\(/g, 'Math.sin(');
            expr = expr.replace(/cos\(/g, 'Math.cos(');
            expr = expr.replace(/tan\(/g, 'Math.tan(');
            expr = expr.replace(/sqrt\(/g, 'Math.sqrt(');
            expr = expr.replace(/log\(/g, 'Math.log10(');
            expr = expr.replace(/ln\(/g, 'Math.log(');
            expr = expr.replace(/pi/gi, Math.PI);
            expr = expr.replace(/e/gi, Math.E);
            expr = expr.replace(/x/g, `(${val})`);
            return eval(expr);
        };

        // Central difference formula
        const derivative = (f(x + h) - f(x - h)) / (2 * h);
        resultDiv.textContent = `f'(${x}) ≈ ${derivative.toFixed(6)}`;
    } catch (error) {
        resultDiv.textContent = 'Error evaluating function';
    }
}

function factorial(n) {
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}

function initDraggable() {
    const modal = document.getElementById('draggable-toolbox-modal');
    const header = document.getElementById('draggable-header');

    header.addEventListener('mousedown', toolboxStartDrag);
    document.addEventListener('mousemove', toolboxDrag);
    document.addEventListener('mouseup', toolboxStopDrag);
}

function toolboxStartDrag(e) {
    isDragging = true;
    const modal = document.getElementById('draggable-toolbox-modal');
    if (!modal) return;
    const rect = modal.getBoundingClientRect();
    const clientX = (typeof e.clientX === 'number') ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX);
    const clientY = (typeof e.clientY === 'number') ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY);
    dragOffsetX = clientX - rect.left;
    dragOffsetY = clientY - rect.top;
}

function toolboxDrag(e) {
    if (!isDragging) return;
    const modal = document.getElementById('draggable-toolbox-modal');
    if (!modal) return;
    const clientX = (typeof e.clientX === 'number') ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX);
    const clientY = (typeof e.clientY === 'number') ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY);
    if (clientX === undefined || clientX === null) return;
    const x = clientX - dragOffsetX;
    const y = clientY - dragOffsetY;
    modal.style.left = x + 'px';
    modal.style.top = y + 'px';
    modal.style.right = 'auto';
}

function toolboxStopDrag() {
    isDragging = false;
}

// Close dropdown when clicking outside
document.addEventListener('click', function (e) {
    const dropdown = document.querySelector('.quick-toolbox-dropdown');
    const menu = document.getElementById('toolbox-dropdown-menu');

    if (!dropdown.contains(e.target)) {
        menu.style.display = 'none';
    }
});

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function handleAIInput(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendAIMessage();
    }
}

// Conversation history for AI chat
let aiConversationHistory = [];
let aiSessionId = 'default';

// Voice recognition and TTS state
let isRecording = false;
let recognition = null;
let ttsEnabled = false;
let synthesis = window.speechSynthesis;
let currentUtterance = null;
let voicesLoaded = false;

window.activeUtterances = [];

function safeSpeak(utterance) {
    if (!window.activeUtterances) {
        window.activeUtterances = [];
    }
    
    // Store the reference
    window.activeUtterances.push(utterance);
    
    // Cleanup reference when the utterance completes or fails
    const cleanup = () => {
        window.activeUtterances = window.activeUtterances.filter(u => u !== utterance);
    };
    
    // Chain onto existing events
    const originalOnEnd = utterance.onend;
    utterance.onend = (e) => {
        cleanup();
        if (originalOnEnd) originalOnEnd(e);
    };
    
    const originalOnError = utterance.onerror;
    utterance.onerror = (e) => {
        cleanup();
        if (originalOnError) originalOnError(e);
    };
    
    synthesis.speak(utterance);
}

// Load voices when they become available
if (synthesis) {
    synthesis.onvoiceschanged = () => {
        voicesLoaded = true;
    };
    // Try to load voices immediately in case they're already available
    synthesis.getVoices();
}

// Notebook voice input state
let notebookRecognition = null;
let notebookIsRecording = false;
let notebookTtsEnabled = false;

// Web Audio WAV Recorder State
let localAudioContext = null;
let localMediaStreamSource = null;
let localAudioBuffer = [];
let localSampleRate = 44100;

async function loadChatHistory() {
    try {
        const response = await apiFetch(`/api/ai/chat-history?session_id=${aiSessionId}`);
        const data = await response.json();

        // Always clear the container first
        const container = document.getElementById('ai-chat-container');
        container.innerHTML = '';

        // Clear conversation history
        aiConversationHistory = [];

        if (data && data.data && data.data.length > 0) {
            // Load messages from database
            data.data.forEach(msg => {
                // Add to conversation history in Gemini format
                if (msg.role === 'user' || msg.role === 'model') {
                    aiConversationHistory.push({ role: msg.role, parts: [msg.content] });
                }

                // Display message in chat interface
                addAIMessage(msg.content, msg.role === 'user' ? 'user' : 'assistant');
            });
        } else {
            // Show default welcome message if no history
            showDefaultWelcomeMessage();
        }
    } catch (e) {
        console.warn('Failed to load chat history:', e);
        // Show default welcome message on error
        showDefaultWelcomeMessage();
    }
}

function showDefaultWelcomeMessage() {
    const container = document.getElementById('ai-chat-container');
    const assistantAvatar = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>`;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message assistant';
    messageDiv.innerHTML = `
        <div class="chat-avatar assistant-avatar">${assistantAvatar}</div>
        <div class="chat-content">
            <div class="chat-bubble assistant-bubble">
                <p>Hello! I'm your AI research assistant. Ask me anything about your lab data, projects, or experiments.</p>
            </div>
            <div class="chat-time">Just now</div>
        </div>
    `;
    container.appendChild(messageDiv);
}

async function startNewChat() {
    // Generate a new session ID
    const newSessionId = 'session_' + Date.now();

    // Switch to new session
    aiSessionId = newSessionId;

    // Clear conversation history
    aiConversationHistory = [];

    // Clear chat container and show welcome message
    const container = document.getElementById('ai-chat-container');
    container.innerHTML = '';
    showDefaultWelcomeMessage();
}

function toggleChatHistoryDropdown() {
    const dropdown = document.getElementById('chat-history-dropdown');
    const isVisible = dropdown.style.display !== 'none';

    if (isVisible) {
        dropdown.style.display = 'none';
    } else {
        loadChatSessionsToDropdown();
        dropdown.style.display = 'block';
    }
}

async function loadChatSessionsToDropdown() {
    const dropdownList = document.getElementById('chat-history-list');
    dropdownList.innerHTML = '<div class="dropdown-item-empty">Loading…</div>';

    try {
        const response = await apiFetch('/api/ai/chat-sessions');
        const data = await response.json();

        dropdownList.innerHTML = '';

        // Helper to build one session row
        const buildSessionItem = (sessionId, title, msgCount, timeAgo, isActive) => {
            const item = document.createElement('div');
            item.className = 'chat-session-item' + (isActive ? ' active-session' : '');
            item.dataset.sessionId = sessionId;

            const chatIconSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
            const trashIconSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>`;

            item.innerHTML = `
                <div class="chat-session-icon">${chatIconSvg}</div>
                <div class="chat-session-info">
                    <div class="chat-session-title" title="${title}">${title}</div>
                    <div class="chat-session-meta">
                        <span class="chat-session-count">${msgCount} msg${msgCount !== 1 ? 's' : ''}</span>
                        <span>·</span>
                        <span>${timeAgo}</span>
                    </div>
                </div>
                <button class="chat-session-delete" title="Delete this chat" data-sid="${sessionId}">${trashIconSvg}</button>
            `;

            // Click on the row body => switch session
            item.addEventListener('click', async (e) => {
                if (e.target.closest('.chat-session-delete')) return; // let delete handle it
                await switchToSession(sessionId);
                toggleChatHistoryDropdown();
            });

            // Click on delete button
            item.querySelector('.chat-session-delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                await deleteChatSession(sessionId);
            });

            return item;
        };

        if (!data || !data.data || data.data.length === 0) {
            // Show "current unsaved session" if we have messages
            if (aiConversationHistory.length > 0) {
                const currentItem = buildSessionItem(
                    aiSessionId,
                    'Current session',
                    aiConversationHistory.length,
                    'just now',
                    true
                );
                dropdownList.appendChild(currentItem);
            } else {
                dropdownList.innerHTML = '<div class="dropdown-item-empty">No previous chat sessions</div>';
            }
            return;
        }

        const sessions = data.data;

        // Prepend current unsaved session if not yet persisted
        if (!sessions.find(s => s.session_id === aiSessionId) && aiConversationHistory.length > 0) {
            const currentItem = buildSessionItem(
                aiSessionId,
                'Current session',
                aiConversationHistory.length,
                'just now',
                true
            );
            dropdownList.appendChild(currentItem);
        }

        sessions.forEach(session => {
            let title = 'New chat';
            if (session.first_message) {
                const words = session.first_message.trim().split(/\s+/).slice(0, 6).join(' ');
                title = words.length < session.first_message.length ? words + '…' : words;
            }
            const timeAgo = getRelativeTime(new Date(session.last_message));
            const isActive = session.session_id === aiSessionId;
            const item = buildSessionItem(session.session_id, title, session.message_count || 0, timeAgo, isActive);
            dropdownList.appendChild(item);
        });

    } catch (e) {
        console.error('Error loading chat sessions:', e);
        dropdownList.innerHTML = '<div class="dropdown-item-empty">Failed to load sessions</div>';
    }
}

async function deleteChatSession(sessionId) {
    const confirmed = await showConfirm('Delete this chat history? This cannot be undone.');
    if (!confirmed) return;

    try {
        const resp = await apiFetch(`/api/ai/chat-history?session_id=${encodeURIComponent(sessionId)}`, {
            method: 'DELETE'
        });
        const result = await resp.json();

        if (result.success) {
            // If deleting the active session, start a fresh chat
            if (sessionId === aiSessionId) {
                await startNewChat();
            }
            // Refresh the dropdown list
            await loadChatSessionsToDropdown();
        } else {
            showAlert('Failed to delete chat history.', 'Error');
        }
    } catch (e) {
        console.error('Error deleting chat session:', e);
        showAlert('Error deleting chat history.', 'Error');
    }
}

function getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSecs < 60) {
        return `${diffSecs}s ago`;
    } else if (diffMins < 60) {
        return `${diffMins}min ago`;
    } else if (diffHours < 24) {
        return `${diffHours}hrs ago`;
    } else if (diffDays < 30) {
        return `${diffDays}day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffMonths < 12) {
        return `${diffMonths}month${diffMonths > 1 ? 's' : ''} ago`;
    } else {
        return `${diffYears}year${diffYears > 1 ? 's' : ''} ago`;
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('chat-history-dropdown');
    const toggleBtn = document.querySelector('.dropdown-toggle');

    if (dropdown && dropdown.style.display !== 'none') {
        if (!dropdown.contains(e.target) && !toggleBtn.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    }
});

async function switchToSession(sessionId) {
    // Switch to selected session
    aiSessionId = sessionId;

    // Load chat history for the selected session
    await loadChatHistory();
}

// ========== Selective Read-Aloud Popup ==========

let selectionReadText = '';
let selectionReadActive = false;

function getPreferredVoice() {
    const voices = synthesis.getVoices();
    if (!voices.length) return null;
    return voices.find(v =>
        v.name.includes('Female') ||
        v.name.includes('Samantha') ||
        v.name.includes('Google US English')
    ) || voices[0];
}

function showSelectionPopup(x, y) {
    const popup = document.getElementById('selection-read-aloud-popup');
    if (!popup) return;
    popup.style.display = 'flex';
    popup.style.flexDirection = 'row';

    // Position: above the anchor point, offset to stay in viewport
    const popupW = 230;
    const popupH = 40;
    let left = x - popupW / 2;
    let top = y - popupH - 10;

    left = Math.max(8, Math.min(left, window.innerWidth - popupW - 8));
    top = Math.max(8, top);

    popup.style.left = left + 'px';
    popup.style.top = top + 'px';

    // Show read btn, hide stop btn
    const readBtn = document.getElementById('selection-read-btn');
    const stopBtn = document.getElementById('selection-stop-btn');
    if (readBtn) readBtn.style.display = 'flex';
    if (stopBtn) stopBtn.style.display = 'none';
}

function hideSelectionPopup() {
    const popup = document.getElementById('selection-read-aloud-popup');
    if (popup) popup.style.display = 'none';
    selectionReadText = '';
}

function readSelectionAloud() {
    if (!selectionReadText || !synthesis) return;

    selectionReadActive = true;
    synthesis.cancel();

    const readBtn = document.getElementById('selection-read-btn');
    const stopBtn = document.getElementById('selection-stop-btn');
    if (readBtn) readBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'flex';

    const normalizedText = normalizeSTEMText(selectionReadText.trim());
    const MAX_CHUNK = 1000;
    const chunks = [];
    if (normalizedText.length > MAX_CHUNK) {
        const sentences = normalizedText.match(/[^.!?]+[.!?]+/g) || [normalizedText];
        let current = '';
        sentences.forEach(s => {
            if ((current + s).length <= MAX_CHUNK) {
                current += s;
            } else {
                if (current) chunks.push(current);
                current = s;
            }
        });
        if (current) chunks.push(current);
    } else {
        chunks.push(normalizedText);
    }

    let chunkIndex = 0;

    function speakSelectionChunk() {
        if (!selectionReadActive || chunkIndex >= chunks.length) {
            selectionReadActive = false;
            hideSelectionPopup();
            return;
        }
        const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        const voice = getPreferredVoice();
        if (voice) utterance.voice = voice;

        utterance.onend = () => {
            chunkIndex++;
            speakSelectionChunk();
        };

        utterance.onerror = (e) => {
            if (e.error !== 'interrupted') {
                console.error('Selection TTS error:', e.error);
            }
            selectionReadActive = false;
            hideSelectionPopup();
        };

        safeSpeak(utterance);
    }

    speakSelectionChunk();
}

function stopSelectionReading() {
    selectionReadActive = false;
    synthesis.cancel();
    hideSelectionPopup();
}

// Listen for text selection anywhere in the document
document.addEventListener('mouseup', (e) => {
    const popup = document.getElementById('selection-read-aloud-popup');
    // If the user clicked inside the popup itself, do not reset
    if (popup && popup.contains(e.target)) return;

    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';

    if (text.length > 5) {
        selectionReadText = text;
        // Position popup at mouseup point
        showSelectionPopup(e.clientX, e.clientY);
    } else {
        if (!selectionReadActive) {
            hideSelectionPopup();
        }
    }
});

document.addEventListener('keyup', (e) => {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (text.length > 5) {
        selectionReadText = text;
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        showSelectionPopup(rect.left + rect.width / 2, rect.top + window.scrollY);
    }
});

// ========== Web Audio WAV Recording Utilities ==========

// AudioWorklet processor code — compiled inline to avoid a separate file
const _pcmWorkletCode = `
class PCMCaptureProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._buffer = [];
    }
    process(inputs) {
        const channel = inputs[0] && inputs[0][0];
        if (channel && channel.length > 0) {
            this.port.postMessage(channel.slice());
        }
        return true; // keep alive
    }
}
registerProcessor('pcm-capture-processor', PCMCaptureProcessor);
`;

let localWorkletNode = null;
let localWorkletBlobUrl = null;
let _wavResolve = null; // resolves with the WAV blob when recording stops

async function startLocalWavRecording() {
    localAudioBuffer = [];
    _wavResolve = null;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        window.activeLocalAudioStream = stream;

        localAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        localSampleRate = localAudioContext.sampleRate;

        // Create a blob URL for the worklet so AudioContext.addModule() can load it
        const blob = new Blob([_pcmWorkletCode], { type: 'application/javascript' });
        localWorkletBlobUrl = URL.createObjectURL(blob);

        await localAudioContext.audioWorklet.addModule(localWorkletBlobUrl);

        localMediaStreamSource = localAudioContext.createMediaStreamSource(stream);
        localWorkletNode = new AudioWorkletNode(localAudioContext, 'pcm-capture-processor');

        // Collect PCM chunks sent back from the worklet
        localWorkletNode.port.onmessage = (e) => {
            localAudioBuffer.push(new Float32Array(e.data));
        };

        localMediaStreamSource.connect(localWorkletNode);
        // Do NOT connect to destination — avoids mic feedback loop

    } catch (err) {
        console.error('Error starting audio recording:', err);
        showAlert('Could not access microphone: ' + err.message, 'Error');
        // Cleanup any partially initialised resources
        if (window.activeLocalAudioStream) {
            window.activeLocalAudioStream.getTracks().forEach(t => t.stop());
            window.activeLocalAudioStream = null;
        }
        if (localAudioContext) {
            localAudioContext.close();
            localAudioContext = null;
        }
    }
}

function stopLocalWavRecording() {
    // Return a Promise so callers can await the final WAV blob
    return new Promise((resolve) => {
        if (localWorkletNode) {
            // Give the worklet one final tick to flush pending frames
            setTimeout(() => {
                try { localWorkletNode.disconnect(); } catch (_) {}
                localWorkletNode.port.onmessage = null;
                localWorkletNode = null;

                _finishStopRecording(resolve);
            }, 100);
        } else {
            _finishStopRecording(resolve);
        }
    });
}

function _finishStopRecording(resolve) {
    if (localMediaStreamSource) {
        try { localMediaStreamSource.disconnect(); } catch (_) {}
        localMediaStreamSource = null;
    }
    if (localAudioContext) {
        localAudioContext.close();
        localAudioContext = null;
    }
    if (window.activeLocalAudioStream) {
        window.activeLocalAudioStream.getTracks().forEach(t => t.stop());
        window.activeLocalAudioStream = null;
    }
    if (localWorkletBlobUrl) {
        URL.revokeObjectURL(localWorkletBlobUrl);
        localWorkletBlobUrl = null;
    }

    if (localAudioBuffer.length === 0) {
        resolve(null);
        return;
    }

    const merged = mergeLocalBuffers(localAudioBuffer);
    localAudioBuffer = [];
    const wavBlob = encodeLocalWAV(merged, localSampleRate);
    resolve(wavBlob);
}

function mergeLocalBuffers(buffers) {
    let totalLength = 0;
    for (let i = 0; i < buffers.length; i++) {
        totalLength += buffers[i].length;
    }
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (let i = 0; i < buffers.length; i++) {
        result.set(buffers[i], offset);
        offset += buffers[i].length;
    }
    return result;
}

function encodeLocalWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    writeLocalString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeLocalString(view, 8, 'WAVE');
    writeLocalString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeLocalString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    floatTo16BitLocalPCM(view, 44, samples);

    return new Blob([view], { type: 'audio/wav' });
}

function floatTo16BitLocalPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

function writeLocalString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// ========== Voice Input Handlers ==========

function toggleVoiceInput() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

async function startRecording() {
    isRecording = true;
    const voiceBtn = document.getElementById('ai-voice-btn');
    if (voiceBtn) voiceBtn.classList.add('recording');
    await startLocalWavRecording();
    // If setup failed (e.g. mic denied), reset UI
    if (!window.activeLocalAudioStream) {
        isRecording = false;
        if (voiceBtn) voiceBtn.classList.remove('recording');
    }
}

async function stopRecording() {
    isRecording = false;
    const voiceBtn = document.getElementById('ai-voice-btn');
    if (voiceBtn) voiceBtn.classList.remove('recording');

    const wavBlob = await stopLocalWavRecording();
    if (!wavBlob) return;

    const input = document.getElementById('ai-input');
    const originalPlaceholder = input.placeholder;
    input.placeholder = "Transcribing voice...";
    input.disabled = true;

    try {
        const reader = new FileReader();
        const base64Data = await new Promise((res, rej) => {
            reader.onloadend = () => res(reader.result.split(',')[1]);
            reader.onerror = rej;
            reader.readAsDataURL(wavBlob);
        });
        const response = await apiFetch('/api/voice/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio_base64: base64Data })
        });
        const result = await response.json();
        if (result.success && result.text) {
            input.value = input.value + (input.value ? ' ' : '') + result.text;
            autoResizeTextarea(input);
        }
    } catch (e) {
        console.error('Error transcribing audio:', e);
        showAlert('Transcription failed: ' + e.message, 'Error');
    } finally {
        input.placeholder = originalPlaceholder;
        input.disabled = false;
        input.focus();
    }
}

function toggleTTS() {
    ttsEnabled = !ttsEnabled;
    const ttsBtn = document.getElementById('ai-tts-btn');

    if (ttsEnabled) {
        ttsBtn.classList.add('active');
    } else {
        ttsBtn.classList.remove('active');
        synthesis.cancel(); // Stop any ongoing speech
    }
}

function speakText(text) {
    if (!ttsEnabled || !text) return;

    // Cancel any ongoing speech
    synthesis.cancel();

    // Create new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Try to use a natural voice
    const voices = synthesis.getVoices();
    if (voices.length > 0) {
        // Prefer a female voice if available
        const preferredVoice = voices.find(voice =>
            voice.name.includes('Female') ||
            voice.name.includes('Samantha') ||
            voice.name.includes('Google US English')
        );
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }
    }

    safeSpeak(utterance);
}

function readMessageAloud(button) {
    if (!synthesis) {
        showAlert('Speech synthesis is not supported in your browser', 'Error');
        return;
    }

    // If this button is paused, resume
    if (button.classList.contains('paused')) {
        synthesis.resume();
        button.classList.remove('paused');
        button.classList.add('speaking');
        updateTTSStatus(button, 'Playing');
        return;
    }

    // If this button is speaking, pause it
    if (button.classList.contains('speaking')) {
        synthesis.pause();
        button.classList.remove('speaking');
        button.classList.add('paused');
        updateTTSStatus(button, 'Paused');
        return;
    }

    // If any other button is speaking, cancel it
    if (synthesis.speaking) {
        synthesis.cancel();
        // Clear speaking class from all buttons
        document.querySelectorAll('.chat-action-btn[data-action="read-aloud"]').forEach(btn => {
            btn.classList.remove('speaking');
            btn.classList.remove('paused');
            updateTTSStatus(btn, '');
        });
        // Wait a moment for cancel to take effect
        setTimeout(() => {
            startSpeaking(button);
        }, 100);
        return;
    }

    startSpeaking(button);
}

function updateTTSStatus(button, status) {
    const statusSpan = button.querySelector('.tts-status');
    if (statusSpan) {
        statusSpan.textContent = status;
    }
}

// Add right-click to stop
document.addEventListener('contextmenu', function (e) {
    if (e.target.closest('.chat-action-btn[data-action="read-aloud"]')) {
        e.preventDefault();
        const button = e.target.closest('.chat-action-btn[data-action="read-aloud"]');
        synthesis.cancel();
        button.classList.remove('speaking');
        button.classList.remove('paused');
        updateTTSStatus(button, '');
    }

    if (e.target.closest('#notebook-tts-btn')) {
        e.preventDefault();
        synthesis.cancel();
        const ttsBtn = document.getElementById('notebook-tts-btn');
        if (ttsBtn) {
            ttsBtn.classList.remove('active');
            ttsBtn.classList.remove('paused');
        }
        updateNotebookTTSStatus('');
        notebookTtsEnabled = false;
    }
});

function startSpeaking(button) {
    // Clear speaking class from all other buttons
    document.querySelectorAll('.chat-action-btn[data-action="read-aloud"]').forEach(btn => {
        btn.classList.remove('speaking');
    });

    const messageDiv = button.closest('.chat-message');
    const chatBubble = messageDiv.querySelector('.chat-bubble');

    // Get the text content from the chat bubble
    let text = chatBubble.textContent || chatBubble.innerText;

    // If the message has rawResponse stored (for AI messages), use that
    if (messageDiv.dataset.rawResponse) {
        text = messageDiv.dataset.rawResponse;
    }

    // Remove duplicate consecutive content (common in HTML with hidden elements)
    text = text.replace(/(.{10,})\1+/g, '$1');

    // Strip markdown for speech
    const plainText = text
        .replace(/#{1,6}\s/g, '') // Remove headers
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
        .replace(/\*([^*]+)\*/g, '$1') // Remove italic
        .replace(/`([^`]+)`/g, '$1') // Remove inline code
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .trim();

    // Apply STEM text normalization
    const normalizedText = normalizeSTEMText(plainText);

    if (!normalizedText) {
        showAlert('No text to read', 'Error');
        return;
    }

    console.log('AI Panel TTS: Plain text length:', plainText.length);
    console.log('AI Panel TTS: Normalized text length:', normalizedText.length);

    // Resume synthesis if it's paused
    if (synthesis.paused) {
        synthesis.resume();
    }

    // For long text, break it into chunks to avoid browser issues
    const MAX_CHUNK_LENGTH = 1000; // Characters per chunk (increased for smoother playback)
    let chunks = [];

    if (normalizedText.length > MAX_CHUNK_LENGTH) {
        // Split by sentences to avoid cutting mid-sentence
        const sentences = normalizedText.match(/[^.!?]+[.!?]+/g) || [normalizedText];
        let currentChunk = '';

        sentences.forEach(sentence => {
            if ((currentChunk + sentence).length <= MAX_CHUNK_LENGTH) {
                currentChunk += sentence;
            } else {
                if (currentChunk) chunks.push(currentChunk);
                currentChunk = sentence;
            }
        });
        if (currentChunk) chunks.push(currentChunk);

        console.log('AI Panel TTS: Split into', chunks.length, 'chunks');
    } else {
        chunks = [normalizedText];
    }

    // Speak chunks sequentially
    let chunkIndex = 0;

    function speakNextChunk() {
        if (chunkIndex >= chunks.length) {
            console.log('AI Panel TTS: All chunks spoken');
            button.classList.remove('speaking');
            updateTTSStatus(button, '');
            return;
        }

        const chunk = chunks[chunkIndex];
        console.log('AI Panel TTS: Speaking chunk', chunkIndex + 1, 'of', chunks.length);

        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        // Try to use a natural voice
        const voices = synthesis.getVoices();
        if (voices.length > 0) {
            const preferredVoice = voices.find(voice =>
                voice.name.includes('Female') ||
                voice.name.includes('Samantha') ||
                voice.name.includes('Google US English')
            );
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            } else {
                utterance.voice = voices[0];
            }
        }

        utterance.onstart = () => {
            console.log('AI Panel TTS: Chunk', chunkIndex + 1, 'started');
        };

        utterance.onend = () => {
            console.log('AI Panel TTS: Chunk', chunkIndex + 1, 'ended');
            chunkIndex++;
            speakNextChunk();
        };

        utterance.onerror = (event) => {
            console.error('AI Panel TTS: Chunk', chunkIndex + 1, 'error:', event);
            button.classList.remove('speaking');
            // Don't show alert for interrupted errors (user stopped it)
            if (event.error !== 'interrupted') {
                showAlert('Error playing audio: ' + event.error, 'Error');
            }
        };

        safeSpeak(utterance);
    }

    button.classList.add('speaking');
    updateTTSStatus(button, 'Playing');
    // Start speaking the first chunk
    speakNextChunk();
}

function toggleNotebookVoiceInput() {
    if (notebookIsRecording) {
        stopNotebookRecording();
    } else {
        startNotebookRecording();
    }
}

async function startNotebookRecording() {
    notebookIsRecording = true;
    const voiceBtn = document.getElementById('notebook-voice-btn');
    if (voiceBtn) voiceBtn.classList.add('recording');
    await startLocalWavRecording();
    // If setup failed (e.g. mic denied), reset UI
    if (!window.activeLocalAudioStream) {
        notebookIsRecording = false;
        if (voiceBtn) voiceBtn.classList.remove('recording');
    }
}

async function stopNotebookRecording() {
    notebookIsRecording = false;
    const voiceBtn = document.getElementById('notebook-voice-btn');
    if (voiceBtn) voiceBtn.classList.remove('recording');

    const wavBlob = await stopLocalWavRecording();
    if (!wavBlob) return;

    const originalTitle = voiceBtn ? voiceBtn.title || 'Voice Input' : 'Voice Input';
    if (voiceBtn) voiceBtn.title = 'Transcribing...';

    try {
        const reader = new FileReader();
        const base64Data = await new Promise((res, rej) => {
            reader.onloadend = () => res(reader.result.split(',')[1]);
            reader.onerror = rej;
            reader.readAsDataURL(wavBlob);
        });
        const response = await apiFetch('/api/voice/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio_base64: base64Data })
        });
        const result = await response.json();
        if (result.success && result.text) {
            const textarea = document.querySelector('.notebook-editor-textarea');
            if (textarea) {
                const endsWithSpace = /[\s\u00a0]$/.test(textarea.innerText) || textarea.innerHTML.endsWith('<br>');
                const space = (textarea.innerHTML.trim().length > 0 && !endsWithSpace) ? ' ' : '';
                const textNode = document.createTextNode(space + result.text);
                textarea.appendChild(textNode);
                textarea.dispatchEvent(new Event('input'));
            }
        }
    } catch (e) {
        console.error('Error transcribing notebook audio:', e);
        showAlert('Transcription failed: ' + e.message, 'Error');
    } finally {
        if (voiceBtn) voiceBtn.title = originalTitle;
    }
}

function toggleNotebookTTS() {
    const ttsBtn = document.getElementById('notebook-tts-btn');

    // If paused, resume
    if (ttsBtn.classList.contains('paused')) {
        synthesis.resume();
        ttsBtn.classList.remove('paused');
        ttsBtn.classList.add('active');
        updateNotebookTTSStatus('Playing');
        return;
    }

    // If active (speaking), pause
    if (ttsBtn.classList.contains('active')) {
        synthesis.pause();
        ttsBtn.classList.remove('active');
        ttsBtn.classList.add('paused');
        updateNotebookTTSStatus('Paused');
        return;
    }

    // If not active, start speaking
    notebookTtsEnabled = true;
    ttsBtn.classList.add('active');
    updateNotebookTTSStatus('Playing');
    readNotebookContent();
}

function updateNotebookTTSStatus(status) {
    const statusSpan = document.querySelector('.notebook-tts-status');
    if (statusSpan) {
        statusSpan.textContent = status;
    }
}

// STEM Text Normalization for TTS
function normalizeSTEMText(text) {
    let normalized = text;

    // Greek letters
    normalized = normalized.replace(/Δ/g, 'delta');
    normalized = normalized.replace(/θ/g, 'theta');
    normalized = normalized.replace(/λ/g, 'lambda');
    normalized = normalized.replace(/Ω/g, 'ohms');
    normalized = normalized.replace(/µ/g, 'micro');
    normalized = normalized.replace(/α/g, 'alpha');
    normalized = normalized.replace(/β/g, 'beta');
    normalized = normalized.replace(/γ/g, 'gamma');
    normalized = normalized.replace(/δ/g, 'delta');
    normalized = normalized.replace(/ε/g, 'epsilon');
    normalized = normalized.replace(/π/g, 'pi');
    normalized = normalized.replace(/ρ/g, 'rho');
    normalized = normalized.replace(/σ/g, 'sigma');
    normalized = normalized.replace(/τ/g, 'tau');
    normalized = normalized.replace(/φ/g, 'phi');
    normalized = normalized.replace(/ω/g, 'omega');

    // Mathematical symbols
    normalized = normalized.replace(/≈/g, 'is approximately equal to');
    normalized = normalized.replace(/±/g, 'plus or minus');
    normalized = normalized.replace(/∞/g, 'infinity');
    normalized = normalized.replace(/≠/g, 'is not equal to');
    normalized = normalized.replace(/≤/g, 'is less than or equal to');
    normalized = normalized.replace(/≥/g, 'is greater than or equal to');
    normalized = normalized.replace(/√/g, 'the square root of');
    normalized = normalized.replace(/∑/g, 'the summation of');
    normalized = normalized.replace(/∫/g, 'the integral of');
    normalized = normalized.replace(/∂/g, 'the partial derivative of');
    normalized = normalized.replace(/∇/g, 'the gradient of');
    normalized = normalized.replace(/→/g, 'approaches');
    normalized = normalized.replace(/←/g, 'is assigned to');
    normalized = normalized.replace(/≡/g, 'is identical to');
    normalized = normalized.replace(/∝/g, 'is proportional to');

    // Units and measurements
    normalized = normalized.replace(/°C/g, 'degrees Celsius');
    normalized = normalized.replace(/°F/g, 'degrees Fahrenheit');
    normalized = normalized.replace(/°K/g, 'degrees Kelvin');
    normalized = normalized.replace(/°R/g, 'degrees Rankine');
    normalized = normalized.replace(/°/g, 'degrees');
    normalized = normalized.replace(/Ω/g, 'ohms');
    normalized = normalized.replace(/μA/g, 'microamperes');
    normalized = normalized.replace(/mA/g, 'milliamperes');
    normalized = normalized.replace(/(\d+)\s*A/g, '$1 amperes');
    normalized = normalized.replace(/(\d+)A/g, '$1 amperes');
    normalized = normalized.replace(/μV/g, 'microvolts');
    normalized = normalized.replace(/mV/g, 'millivolts');
    normalized = normalized.replace(/kV/g, 'kilovolts');
    normalized = normalized.replace(/(\d+)\s*V/g, '$1 volts');
    normalized = normalized.replace(/(\d+)V/g, '$1 volts');
    normalized = normalized.replace(/μW/g, 'microwatts');
    normalized = normalized.replace(/mW/g, 'milliwatts');
    normalized = normalized.replace(/kW/g, 'kilowatts');
    normalized = normalized.replace(/MW/g, 'megawatts');
    normalized = normalized.replace(/(\d+)\s*W/g, '$1 watts');
    normalized = normalized.replace(/(\d+)W/g, '$1 watts');
    normalized = normalized.replace(/Hz/g, 'hertz');
    normalized = normalized.replace(/kHz/g, 'kilohertz');
    normalized = normalized.replace(/MHz/g, 'megahertz');
    normalized = normalized.replace(/GHz/g, 'gigahertz');
    normalized = normalized.replace(/μF/g, 'microfarads');
    normalized = normalized.replace(/nF/g, 'nanofarads');
    normalized = normalized.replace(/pF/g, 'picofarads');
    normalized = normalized.replace(/(\d+)\s*F/g, '$1 farads');
    normalized = normalized.replace(/(\d+)F/g, '$1 farads');
    normalized = normalized.replace(/μH/g, 'microhenries');
    normalized = normalized.replace(/mH/g, 'millihenries');
    normalized = normalized.replace(/(\d+)\s*H/g, '$1 henries');
    normalized = normalized.replace(/(\d+)H/g, '$1 henries');
    normalized = normalized.replace(/kΩ/g, 'kiloohms');
    normalized = normalized.replace(/MΩ/g, 'megaohms');

    // Exponents and powers
    normalized = normalized.replace(/x²/g, 'x squared');
    normalized = normalized.replace(/x³/g, 'x cubed');
    normalized = normalized.replace(/y²/g, 'y squared');
    normalized = normalized.replace(/y³/g, 'y cubed');
    normalized = normalized.replace(/z²/g, 'z squared');
    normalized = normalized.replace(/z³/g, 'z cubed');
    normalized = normalized.replace(/(\w+)\^2/g, '$1 squared');
    normalized = normalized.replace(/(\w+)\^3/g, '$1 cubed');
    normalized = normalized.replace(/(\w+)\^(\d+)/g, '$1 to the power of $2');

    // Function notation
    normalized = normalized.replace(/f\(x\)/g, 'f of x');
    normalized = normalized.replace(/g\(x\)/g, 'g of x');
    normalized = normalized.replace(/h\(x\)/g, 'h of x');
    normalized = normalized.replace(/(\w+)\((\w+)\)/g, '$1 of $2');

    // Fractions (simple cases)
    normalized = normalized.replace(/½/g, 'one half');
    normalized = normalized.replace(/⅓/g, 'one third');
    normalized = normalized.replace(/⅔/g, 'two thirds');
    normalized = normalized.replace(/¼/g, 'one quarter');
    normalized = normalized.replace(/¾/g, 'three quarters');
    normalized = normalized.replace(/⅕/g, 'one fifth');
    normalized = normalized.replace(/⅖/g, 'two fifths');
    normalized = normalized.replace(/⅗/g, 'three fifths');
    normalized = normalized.replace(/⅘/g, 'four fifths');

    // Common scientific abbreviations
    normalized = normalized.replace(/pH/g, 'P H');
    normalized = normalized.replace(/DNA/g, 'D N A');
    normalized = normalized.replace(/RNA/g, 'R N A');
    normalized = normalized.replace(/ATP/g, 'A T P');
    normalized = normalized.replace(/ADP/g, 'A D P');
    normalized = normalized.replace(/CO₂/g, 'carbon dioxide');
    normalized = normalized.replace(/H₂O/g, 'water');
    normalized = normalized.replace(/NaCl/g, 'sodium chloride');
    normalized = normalized.replace(/KCl/g, 'potassium chloride');

    // Chemical formulas (basic)
    normalized = normalized.replace(/H₂/g, 'H two');
    normalized = normalized.replace(/O₂/g, 'O two');
    normalized = normalized.replace(/N₂/g, 'N two');
    normalized = normalized.replace(/CO₂/g, 'C O two');
    normalized = normalized.replace(/SO₂/g, 'S O two');
    normalized = normalized.replace(/NO₂/g, 'N O two');

    // Percentages
    normalized = normalized.replace(/%/g, 'percent');

    // Ratios
    normalized = normalized.replace(/(\d+):(\d+)/g, '$1 to $2');

    return normalized;
}

function readNotebookContent() {
    if (!synthesis) {
        showAlert('Speech synthesis is not supported in your browser', 'Error');
        return;
    }

    const textarea = document.querySelector('.notebook-editor-textarea');
    if (!textarea) {
        console.error('Notebook TTS: Textarea not found');
        return;
    }

    // Get the text content - use innerText for better text extraction from HTML
    let text = textarea.innerText || textarea.textContent;

    console.log('Notebook TTS: Raw text length:', text.length);
    console.log('Notebook TTS: Raw text preview:', text.substring(0, 100));

    // Remove duplicate consecutive content (common in HTML with hidden elements)
    text = text.replace(/(.{10,})\1+/g, '$1');

    // Strip markdown for speech
    const plainText = text
        .replace(/#{1,6}\s/g, '') // Remove headers
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
        .replace(/\*([^*]+)\*/g, '$1') // Remove italic
        .replace(/`([^`]+)`/g, '$1') // Remove inline code
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .trim();

    // Apply STEM text normalization
    const normalizedText = normalizeSTEMText(plainText);

    if (!normalizedText) {
        showAlert('No text to read', 'Error');
        return;
    }

    console.log('Notebook TTS: Speaking text:', normalizedText.substring(0, 50) + '...');
    console.log('Notebook TTS: Plain text length:', plainText.length);
    console.log('Notebook TTS: Normalized text length:', normalizedText.length);

    // Cancel any ongoing speech
    synthesis.cancel();

    // Resume synthesis if it's paused
    if (synthesis.paused) {
        synthesis.resume();
    }

    // For long text, break it into chunks to avoid browser issues
    const MAX_CHUNK_LENGTH = 1000; // Characters per chunk (increased for smoother playback)
    let chunks = [];

    if (normalizedText.length > MAX_CHUNK_LENGTH) {
        // Split by sentences to avoid cutting mid-sentence
        const sentences = normalizedText.match(/[^.!?]+[.!?]+/g) || [normalizedText];
        let currentChunk = '';

        sentences.forEach(sentence => {
            if ((currentChunk + sentence).length <= MAX_CHUNK_LENGTH) {
                currentChunk += sentence;
            } else {
                if (currentChunk) chunks.push(currentChunk);
                currentChunk = sentence;
            }
        });
        if (currentChunk) chunks.push(currentChunk);

        console.log('Notebook TTS: Split into', chunks.length, 'chunks');
    } else {
        chunks = [normalizedText];
    }

    // Speak chunks sequentially
    let chunkIndex = 0;

    function speakNextChunk() {
        if (chunkIndex >= chunks.length) {
            console.log('Notebook TTS: All chunks spoken');
            notebookTtsEnabled = false;
            const ttsBtn = document.getElementById('notebook-tts-btn');
            if (ttsBtn) ttsBtn.classList.remove('active');
            updateNotebookTTSStatus('');
            return;
        }

        const chunk = chunks[chunkIndex];
        console.log('Notebook TTS: Speaking chunk', chunkIndex + 1, 'of', chunks.length);

        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        // Try to use a natural voice
        const voices = synthesis.getVoices();
        if (voices.length > 0) {
            const preferredVoice = voices.find(voice =>
                voice.name.includes('Female') ||
                voice.name.includes('Samantha') ||
                voice.name.includes('Google US English')
            );
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            } else {
                utterance.voice = voices[0];
            }
        }

        utterance.onstart = () => {
            console.log('Notebook TTS: Chunk', chunkIndex + 1, 'started');
        };

        utterance.onend = () => {
            console.log('Notebook TTS: Chunk', chunkIndex + 1, 'ended');
            chunkIndex++;
            speakNextChunk();
        };

        utterance.onerror = (event) => {
            console.error('Notebook TTS: Chunk', chunkIndex + 1, 'error:', event);
            notebookTtsEnabled = false;
            const ttsBtn = document.getElementById('notebook-tts-btn');
            if (ttsBtn) ttsBtn.classList.remove('active');
            // Don't show alert for interrupted errors (user stopped it)
            if (event.error !== 'interrupted') {
                showAlert('Error playing audio: ' + event.error, 'Error');
            }
        };

        safeSpeak(utterance);
    }

    // Start speaking the first chunk
    speakNextChunk();
}

function sendAIMessage() {
    const input = document.getElementById('ai-input');
    const message = input.value.trim();
    if (message) {
        addAIMessage(message, 'user');
        input.value = '';
        input.style.height = 'auto';

        // Add to conversation history (without session_id for Gemini API)
        aiConversationHistory.push({ role: 'user', parts: [message] });

        // Call Gemini API with streaming
        fetchGeminiChat(message, aiConversationHistory);
    }
}

async function fetchGeminiChat(message, conversationHistory) {
    const container = document.getElementById('ai-chat-container');

    // Create assistant message placeholder
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message assistant';

    const assistantAvatar = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>`;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageDiv.innerHTML = `
        <div class="chat-avatar assistant-avatar">${assistantAvatar}</div>
        <div class="chat-content">
            <div class="chat-bubble assistant-bubble">
                <div class="ai-typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
            <div class="chat-actions">
                <button class="chat-action-btn" data-action="read-aloud" title="Read Aloud">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 13 21 13 21 5 11 5"></polygon>
                    </svg>
                </button>
                <button class="chat-action-btn" data-action="export-notebook" title="Export to Notebook">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                </button>
            </div>
            <div class="chat-time">${time}</div>
        </div>
    `;

    // Add event listeners for action buttons
    const readAloudBtn = messageDiv.querySelector('[data-action="read-aloud"]');
    const exportBtn = messageDiv.querySelector('[data-action="export-notebook"]');

    if (readAloudBtn) {
        readAloudBtn.addEventListener('click', () => readMessageAloud(readAloudBtn));
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => exportChatToNotebook(exportBtn));
    }

    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;

    const typingIndicator = messageDiv.querySelector('.ai-typing-indicator');
    const chatBubble = messageDiv.querySelector('.chat-bubble');
    let streamingText = null;
    let fullResponse = '';

    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                conversation_history: conversationHistory
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(errorData.detail || 'Failed to get AI response');
        }

        // Replace typing indicator with streaming text
        if (typingIndicator) {
            typingIndicator.remove();
        }

        streamingText = document.createElement('div');
        streamingText.className = 'ai-streaming-text';
        chatBubble.appendChild(streamingText);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            fullResponse += chunk;
            streamingText.textContent = fullResponse;
            container.scrollTop = container.scrollHeight;
        }

        // Convert markdown to HTML after streaming is complete
        if (typeof marked !== 'undefined') {
            streamingText.innerHTML = marked.parse(fullResponse);
            renderMath(streamingText);
        }

        // Store the raw response for export
        messageDiv.dataset.rawResponse = fullResponse;

        // Add to conversation history
        aiConversationHistory.push({ role: 'model', parts: [fullResponse] });

        // Speak the response if TTS is enabled
        if (ttsEnabled) {
            // Strip markdown for speech
            const plainText = fullResponse
                .replace(/#{1,6}\s/g, '') // Remove headers
                .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
                .replace(/\*([^*]+)\*/g, '$1') // Remove italic
                .replace(/`([^`]+)`/g, '$1') // Remove inline code
                .replace(/```[\s\S]*?```/g, '') // Remove code blocks
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
                .replace(/\n+/g, ' ') // Replace newlines with spaces
                .trim();

            speakText(plainText);
        }

    } catch (error) {
        // Remove typing indicator if still present
        if (typingIndicator) {
            typingIndicator.remove();
        }

        // Create streaming text element for error message
        if (!streamingText) {
            streamingText = document.createElement('div');
            streamingText.className = 'ai-streaming-text';
            chatBubble.appendChild(streamingText);
        }

        // Ask user if they want to retry
        const shouldRetry = confirm(`Error: ${error.message}\n\nWould you like to retry?`);

        if (shouldRetry) {
            // Remove the error message and retry
            messageDiv.remove();
            fetchGeminiChat(message, conversationHistory);
        } else {
            streamingText.textContent = `Error: ${error.message}`;
            streamingText.style.color = 'var(--accent-red)';
        }
    }
}

function addAIMessage(message, type) {
    const container = document.getElementById('ai-chat-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;

    const assistantAvatar = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>`;
    const userAvatar = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
    </svg>`;

    const avatar = type === 'assistant' ? assistantAvatar : userAvatar;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let contentHTML = '';
    if (type === 'assistant') {
        // Parse markdown for assistant messages
        contentHTML = parseMarkdownAndMath(message);
    } else {
        contentHTML = message;
    }

    let actionsHTML = '';
    if (type === 'assistant') {
        actionsHTML = `
            <div class="chat-actions">
                <button class="chat-action-btn" data-action="read-aloud" title="Read Aloud">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 13 21 13 21 5 11 5"></polygon>
                    </svg>
                    <span class="tts-status"></span>
                </button>
                <button class="chat-action-btn" data-action="export-notebook" title="Export to Notebook">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                </button>
            </div>
        `;
    }

    messageDiv.innerHTML = `
        <div class="chat-avatar ${type}-avatar">${avatar}</div>
        <div class="chat-content">
            <div class="chat-bubble ${type}-bubble">
                <div class="ai-streaming-text">${contentHTML}</div>
            </div>
            ${actionsHTML}
            <div class="chat-time">${time}</div>
        </div>
    `;

    // Store raw response for AI messages
    if (type === 'assistant') {
        messageDiv.dataset.rawResponse = message;
    }

    // Add event listeners for action buttons
    if (type === 'assistant') {
        const readAloudBtn = messageDiv.querySelector('[data-action="read-aloud"]');
        const exportBtn = messageDiv.querySelector('[data-action="export-notebook"]');

        if (readAloudBtn) {
            readAloudBtn.addEventListener('click', () => readMessageAloud(readAloudBtn));
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => exportChatToNotebook(exportBtn));
        }
    }

    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;

    // Render math equations in the newly appended bubble (must be in DOM first)
    if (type === 'assistant') {
        const bubble = messageDiv.querySelector('.ai-streaming-text');
        if (bubble) renderMath(bubble);
    }
}

// Assets (formerly Tracking) functionality
let currentTrackingTab = 'overview';

function initAssets() {
    // Setup tab switching
    document.querySelectorAll('.tracking-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tracking-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTrackingTab = tab.dataset.tab;
            // Save current tab to sessionStorage
            sessionStorage.setItem('assetsCurrentTab', tab.dataset.tab);
            // Show/hide add button based on tab
            const addBtn = document.getElementById('assets-add-btn');
            if (addBtn) {
                addBtn.style.display = currentTrackingTab === 'overview' ? 'none' : '';
            }
            loadTrackingData(currentTrackingTab);
        });
    });

    // Hide add button on overview tab by default
    const addBtn = document.getElementById('assets-add-btn');
    if (addBtn) addBtn.style.display = 'none';

    // Load initial data - restore previous tab if available, otherwise overview
    const savedTab = sessionStorage.getItem('assetsCurrentTab');
    if (savedTab && savedTab !== 'overview') {
        // Manually set the tab as active and load data
        document.querySelectorAll('.tracking-tab').forEach(t => t.classList.remove('active'));
        const tab = document.querySelector(`.tracking-tab[data-tab="${savedTab}"]`);
        if (tab) tab.classList.add('active');
        currentTrackingTab = savedTab;
        if (addBtn) addBtn.style.display = '';
        loadTrackingData(savedTab);
    } else {
        // Reset to overview
        document.querySelectorAll('.tracking-tab').forEach(t => t.classList.remove('active'));
        const overviewTab = document.querySelector(`.tracking-tab[data-tab="overview"]`);
        if (overviewTab) overviewTab.classList.add('active');
        currentTrackingTab = 'overview';
        loadTrackingData('overview');
    }
}

async function loadTrackingData(type) {
    const content = document.getElementById('tracking-content');
    content.innerHTML = '<p>Loading...</p>';

    if (type === 'overview') {
        await loadAssetsOverview();
        return;
    }

    try {
        let endpoint;
        switch (type) {
            case 'equipment':
                endpoint = '/api/equipment';
                break;
            case 'tools':
                endpoint = '/api/tools';
                break;
            case 'materials':
                endpoint = '/api/materials';
                break;
            case 'components':
                endpoint = '/api/components';
                break;
            default:
                content.innerHTML = '<p>Unknown asset type</p>';
                return;
        }

        const response = await apiFetch(endpoint);
        const data = await response.json();

        if (data.success) {
            renderTrackingTable(type, data.data);
        } else {
            content.innerHTML = '<p>Error loading data</p>';
        }
    } catch (error) {
        console.error('Error loading tracking data:', error);
        content.innerHTML = '<p>Error loading data</p>';
    }
}

async function loadAssetsOverview() {
    const content = document.getElementById('tracking-content');
    try {
        // Fetch counts from all asset endpoints in parallel
        const [eqRes, toolRes, matRes, compRes] = await Promise.allSettled([
            apiFetch('/api/equipment').then(r => r.json()),
            apiFetch('/api/tools').then(r => r.json()),
            apiFetch('/api/materials').then(r => r.json()),
            apiFetch('/api/components').then(r => r.json())
        ]);

        const eq = eqRes.status === 'fulfilled' && eqRes.value.success ? eqRes.value.data : [];
        const tools = toolRes.status === 'fulfilled' && toolRes.value.success ? toolRes.value.data : [];
        const mats = matRes.status === 'fulfilled' && matRes.value.success ? matRes.value.data : [];
        const comps = compRes.status === 'fulfilled' && compRes.value.success ? compRes.value.data : [];

        content.innerHTML = `
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:16px; margin-bottom:24px;">
                <div class="dashboard-card" style="cursor:pointer;" onclick="switchAssetsTab('equipment')">
                    <div style="font-size:28px;font-weight:700;color:var(--accent-blue);">${eq.length}</div>
                    <div style="color:var(--text-secondary);margin-top:4px;">Equipment</div>
                </div>
                <div class="dashboard-card" style="cursor:pointer;" onclick="switchAssetsTab('tools')">
                    <div style="font-size:28px;font-weight:700;color:var(--accent-green);">${tools.length}</div>
                    <div style="color:var(--text-secondary);margin-top:4px;">Tools</div>
                </div>
                <div class="dashboard-card" style="cursor:pointer;" onclick="switchAssetsTab('materials')">
                    <div style="font-size:28px;font-weight:700;color:var(--accent-orange);">${mats.length}</div>
                    <div style="color:var(--text-secondary);margin-top:4px;">Materials</div>
                </div>
                <div class="dashboard-card" style="cursor:pointer;" onclick="switchAssetsTab('components')">
                    <div style="font-size:28px;font-weight:700;color:var(--accent-purple, #a78bfa);">${comps.length}</div>
                    <div style="color:var(--text-secondary);margin-top:4px;">Components</div>
                </div>
            </div>
            <div class="dashboard-card">
                <h3>Assets at a Glance</h3>
                <table class="tracking-table" style="margin-top:12px;">
                    <thead><tr><th>Category</th><th>Total Items</th><th>Available</th><th>In Use / Low Stock</th></tr></thead>
                    <tbody>
                        <tr><td>Equipment</td><td>${eq.length}</td><td>${eq.filter(i => i.status === 'available').length}</td><td>${eq.filter(i => i.status === 'in_use').length}</td></tr>
                        <tr><td>Tools</td><td>${tools.length}</td><td>${tools.filter(i => i.status === 'available').length}</td><td>${tools.filter(i => i.status === 'in_use').length}</td></tr>
                        <tr><td>Materials</td><td>${mats.length}</td><td>—</td><td>${mats.filter(i => i.quantity <= i.min_quantity).length} low stock</td></tr>
                        <tr><td>Components</td><td>${comps.length}</td><td>—</td><td>${comps.filter(i => i.quantity <= i.min_quantity).length} low stock</td></tr>
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        content.innerHTML = '<p>Error loading assets overview</p>';
    }
}

function switchAssetsTab(tabName) {
    document.querySelectorAll('.tracking-tab').forEach(t => t.classList.remove('active'));
    const tab = document.querySelector(`.tracking-tab[data-tab="${tabName}"]`);
    if (tab) tab.classList.add('active');
    currentTrackingTab = tabName;
    // Save current tab to sessionStorage
    sessionStorage.setItem('assetsCurrentTab', tabName);
    const addBtn = document.getElementById('assets-add-btn');
    if (addBtn) addBtn.style.display = '';
    loadTrackingData(tabName);
}

function openAddAssetModal() {
    openAddTrackingModal();
}

function renderTrackingTable(type, items) {
    const content = document.getElementById('tracking-content');

    if (!items || items.length === 0) {
        content.innerHTML = '<p>No items found</p>';
        return;
    }

    let html = '<table class="tracking-table"><thead><tr>';

    switch (type) {
        case 'equipment':
            html += '<th>Name</th><th>Model</th><th>Status</th><th>Calibration Date</th><th>Actions</th>';
            break;
        case 'tools':
            html += '<th>Name</th><th>Type</th><th>Quantity</th><th>Status</th><th>Actions</th>';
            break;
        case 'materials':
            html += '<th>Name</th><th>Type</th><th>Unit Mass</th><th>Quantity</th><th>Actions</th>';
            break;
        case 'components':
            html += '<th>Name</th><th>Part Number</th><th>Quantity</th><th>Actions</th>';
            break;
        case 'others':
            html += '<th>Name</th><th>Category</th><th>Status</th><th>Location</th><th>Actions</th>';
            break;
    }

    html += '</tr></thead><tbody>';

    items.forEach(item => {
        html += '<tr>';

        switch (type) {
            case 'equipment':
                html += `<td>${item.name}</td><td>${item.model || '-'}</td><td><span class="status-badge ${item.status}">${item.status}</span></td><td>${item.calibration_date || '-'}</td>`;
                break;
            case 'tools':
                html += `<td>${item.name}</td><td>${item.tool_type || '-'}</td><td>${item.quantity}</td><td><span class="status-badge ${item.status}">${item.status}</span></td>`;
                break;
            case 'materials':
                html += `<td>${item.name}</td><td>${item.material_type || '-'}</td><td>${item.unit_mass || 0} ${item.unit_mass_unit || ''}</td><td>${item.quantity || 0} units</td>`;
                break;
            case 'components':
                html += `<td>${item.name}</td><td>${item.part_number || '-'}</td><td>${item.quantity}</td>`;
                break;
            case 'others':
                html += `<td>${item.name}</td><td>${item.category || '-'}</td><td><span class="status-badge ${item.status || 'available'}">${item.status || 'available'}</span></td><td>${item.location || '-'}</td>`;
                break;
        }

        html += `<td class="tracking-actions">
            <button class="btn btn-primary" onclick="editAsset('${type}', ${item.id})">Edit</button>
            ${type !== 'others' ? `<button class="btn btn-secondary" onclick="recordUsage('${type}', ${item.id})">Use</button>` : ''}
            <button class="btn btn-secondary" onclick="${type !== 'others' ? `viewUsageHistory('${type}', ${item.id})` : `viewAssetOtherDetails(${item.id})`}">${type !== 'others' ? 'History' : 'Details'}</button>
            <button class="btn btn-secondary" onclick="deleteAsset('${type}', ${item.id})" style="color:var(--accent-red);">Delete</button>
        </td></tr>`;
    });

    html += '</tbody></table>';
    content.innerHTML = html;
}

async function recordUsage(type, itemId) {
    const result = await showMultiField([
        { name: 'project', label: 'Project ID (optional)', type: 'text', placeholder: 'e.g. 1' },
        { name: 'experiment', label: 'Experiment ID (optional)', type: 'text', placeholder: 'e.g. 2' },
        { name: 'quantity', label: 'Quantity Used *', type: 'text', placeholder: 'e.g. 1' },
        { name: 'postUseStatus', label: 'Post-Use Status', type: 'select', options: ['usable', 'finished', 'spoiled', 'missing'] },
        { name: 'conditionNotes', label: 'Condition Notes (optional)', type: 'text', placeholder: 'Any observations...' },
        { name: 'efficiency', label: 'Efficiency % (optional)', type: 'text', placeholder: 'e.g. 95' }
    ], 'Record Usage', 'Fill in the usage details:');

    if (!result) return;
    const { project, experiment, quantity, postUseStatus, conditionNotes, efficiency } = result;

    if (!quantity) {
        showAlert('Quantity is required');
        return;
    }

    try {
        let endpoint, payload;

        switch (type) {
            case 'equipment':
                endpoint = '/api/equipment-usage';
                payload = {
                    equipment_id: itemId,
                    usage_type: 'checkout',
                    project_id: project ? parseInt(project) : null,
                    experiment_id: experiment ? parseInt(experiment) : null,
                    post_use_status: postUseStatus,
                    condition_notes: conditionNotes,
                    efficiency_percentage: efficiency ? parseFloat(efficiency) : null
                };
                break;
            case 'tools':
                endpoint = '/api/tool-usage';
                payload = {
                    tool_id: itemId,
                    quantity_used: parseInt(quantity),
                    amount_left: 0,
                    project_id: project ? parseInt(project) : null,
                    experiment_id: experiment ? parseInt(experiment) : null,
                    post_use_status: postUseStatus,
                    condition_notes: conditionNotes,
                    efficiency_percentage: efficiency ? parseFloat(efficiency) : null
                };
                break;
            case 'materials':
                endpoint = '/api/material-usage';
                payload = {
                    material_id: itemId,
                    quantity_used: parseFloat(quantity),
                    amount_left: 0,
                    project_id: project ? parseInt(project) : null,
                    experiment_id: experiment ? parseInt(experiment) : null,
                    post_use_status: postUseStatus,
                    condition_notes: conditionNotes
                };
                break;
            case 'components':
                // Use component usage
                endpoint = '/api/component-usage';
                payload = {
                    component_id: itemId,
                    quantity_used: parseInt(quantity),
                    project_id: project ? parseInt(project) : null,
                    experiment_id: experiment ? parseInt(experiment) : null
                };
                break;
        }

        const response = await apiFetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            showAlert('Usage recorded successfully');
            loadTrackingData(type);
        } else {
            showAlert('Error recording usage');
        }
    } catch (error) {
        console.error('Error recording usage:', error);
        showAlert('Error recording usage');
    }
}

async function viewUsageHistory(type, itemId) {
    try {
        let endpoint;
        switch (type) {
            case 'equipment':
                endpoint = `/api/equipment-usage?equipment_id=${itemId}`;
                break;
            case 'tools':
                endpoint = `/api/tool-usage?tool_id=${itemId}`;
                break;
            case 'materials':
                endpoint = `/api/material-usage?material_id=${itemId}`;
                break;
            case 'components':
                endpoint = `/api/component-usage?component_id=${itemId}`;
                break;
        }

        const response = await apiFetch(endpoint);
        const data = await response.json();

        if (data.success) {
            if (!data.data || data.data.length === 0) {
                showAlert('No usage history found for this item.', 'Usage History');
                return;
            }
            // Build an HTML table for the history and show in a modal
            let rows = data.data.map(record => `
                <tr>
                    <td>${new Date(record.usage_date).toLocaleString()}</td>
                    <td>${record.project_id || '—'}</td>
                    <td>${record.quantity_used || '—'}</td>
                    <td>${record.post_use_status || '—'}</td>
                    <td>${record.condition_notes || '—'}</td>
                    <td>${record.efficiency_percentage != null ? record.efficiency_percentage + '%' : '—'}</td>
                </tr>`).join('');
            const html = `
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                        <tr style="background:var(--bg-tertiary);">
                            <th style="padding:8px;text-align:left;">Date</th>
                            <th style="padding:8px;text-align:left;">Project</th>
                            <th style="padding:8px;text-align:left;">Qty</th>
                            <th style="padding:8px;text-align:left;">Status</th>
                            <th style="padding:8px;text-align:left;">Notes</th>
                            <th style="padding:8px;text-align:left;">Efficiency</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;
            // Re-use the generic modal overlay
            showModal({
                type: 'alert',
                title: 'Usage History',
                message: '',
                confirmText: 'Close',
                callback: () => { }
            });
            // Inject table into modal message area
            const msgEl = document.getElementById('modal-message');
            if (msgEl) { msgEl.innerHTML = html; }
        } else {
            showAlert('Error loading usage history');
        }
    } catch (error) {
        console.error('Error loading usage history:', error);
        showAlert('Error loading usage history');
    }
}

async function deleteAsset(type, itemId) {
    const confirmed = await showConfirm('Are you sure you want to delete this asset?', 'Delete Asset');
    if (!confirmed) return;
    try {
        const endpointMap = {
            equipment: `/api/equipment/${itemId}`,
            tools: `/api/tools/${itemId}`,
            materials: `/api/materials/${itemId}`,
            components: `/api/components/${itemId}`,
            others: `/api/assets-other/${itemId}`
        };
        const response = await apiFetch(endpointMap[type], { method: 'DELETE' });
        const data = await response.json();
        if (data.success !== false) {
            showAlert('Asset deleted successfully.');
            loadTrackingData(type);
        } else {
            showAlert('Error deleting asset.');
        }
    } catch (err) {
        showAlert('Error deleting asset.');
    }
}

async function viewAssetOtherDetails(itemId) {
    try {
        const response = await apiFetch(`/api/assets-other/${itemId}`);
        const data = await response.json();
        if (data.success && data.data) {
            const item = data.data;
            showAlert(`Name: ${item.name}\nCategory: ${item.category || '—'}\nStatus: ${item.status || '—'}\nLocation: ${item.location || '—'}\nNotes: ${item.notes || '—'}`, 'Asset Details');
        }
    } catch (e) {
        showAlert('Error loading asset details.');
    }
}

function openAddTrackingModal() {
    const type = currentTrackingTab;
    const modal = document.getElementById('add-tracking-modal');
    const title = document.getElementById('tracking-modal-title');
    const formFields = document.getElementById('tracking-form-fields');

    title.textContent = `Add ${type.charAt(0).toUpperCase() + type.slice(1)}`;

    // Generate form fields based on type
    let fieldsHtml = '';

    switch (type) {
        case 'equipment':
            fieldsHtml = `
                <div class="tracking-form-group">
                    <label for="equipment-name">Name *</label>
                    <input type="text" id="equipment-name" name="name" required>
                </div>
                <div class="tracking-form-group">
                    <label for="equipment-model">Model</label>
                    <input type="text" id="equipment-model" name="model">
                </div>
                <div class="tracking-form-group">
                    <label for="equipment-status">Status *</label>
                    <select id="equipment-status" name="status" required>
                        <option value="available">Available</option>
                        <option value="in_use">In Use</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="retired">Retired</option>
                    </select>
                </div>
                <div class="tracking-form-group">
                    <label for="equipment-calibration">Calibration Date</label>
                    <input type="date" id="equipment-calibration" name="calibration_date">
                </div>
                <div class="tracking-form-group">
                    <label for="equipment-location">Location</label>
                    <input type="text" id="equipment-location" name="location">
                </div>
                <div class="tracking-form-group">
                    <label for="equipment-notes">Notes</label>
                    <textarea id="equipment-notes" name="notes" rows="3"></textarea>
                </div>
            `;
            break;
        case 'tools':
            fieldsHtml = `
                <div class="tracking-form-group">
                    <label for="tool-name">Name *</label>
                    <input type="text" id="tool-name" name="name" required>
                </div>
                <div class="tracking-form-group">
                    <label for="tool-type">Type *</label>
                    <select id="tool-type" name="tool_type" required>
                        <option value="hand_tool">Hand Tool</option>
                        <option value="power_tool">Power Tool</option>
                        <option value="measuring">Measuring</option>
                        <option value="cutting">Cutting</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="tracking-form-group">
                    <label for="tool-quantity">Quantity *</label>
                    <input type="number" id="tool-quantity" name="quantity" min="1" required>
                </div>
                <div class="tracking-form-group">
                    <label for="tool-status">Status *</label>
                    <select id="tool-status" name="status" required>
                        <option value="available">Available</option>
                        <option value="in_use">In Use</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="lost">Lost</option>
                    </select>
                </div>
                <div class="tracking-form-group">
                    <label for="tool-location">Location</label>
                    <input type="text" id="tool-location" name="location">
                </div>
                <div class="tracking-form-group">
                    <label for="tool-notes">Notes</label>
                    <textarea id="tool-notes" name="notes" rows="3"></textarea>
                </div>
            `;
            break;
        case 'materials':
            fieldsHtml = `
                <div class="tracking-form-group">
                    <label for="material-name">Name *</label>
                    <input type="text" id="material-name" name="name" required>
                </div>
                <div class="tracking-form-group">
                    <label for="material-type">Type *</label>
                    <select id="material-type" name="material_type" required>
                        <option value="metal">Metal</option>
                        <option value="plastic">Plastic</option>
                        <option value="wood">Wood</option>
                        <option value="chemical">Chemical</option>
                        <option value="electronic">Electronic</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="tracking-form-group">
                    <label for="material-unit-mass">Unit Mass/Size *</label>
                    <input type="number" id="material-unit-mass" name="unit_mass" min="0" step="0.01" required placeholder="e.g., 500">
                </div>
                <div class="tracking-form-group">
                    <label for="material-unit-mass-unit">Unit Mass Unit *</label>
                    <select id="material-unit-mass-unit" name="unit_mass_unit" required>
                        <option value="kg">Kilograms (kg)</option>
                        <option value="g">Grams (g)</option>
                        <option value="l">Liters (l)</option>
                        <option value="ml">Milliliters (ml)</option>
                        <option value="m">Meters (m)</option>
                        <option value="cm">Centimeters (cm)</option>
                    </select>
                </div>
                <div class="tracking-form-group">
                    <label for="material-quantity">Number of Units *</label>
                    <input type="number" id="material-quantity" name="quantity" min="1" required placeholder="e.g., 10">
                </div>
                <div class="tracking-form-group">
                    <label for="material-supplier">Supplier</label>
                    <input type="text" id="material-supplier" name="supplier">
                </div>
                <div class="tracking-form-group">
                    <label for="material-storage-location">Storage Location</label>
                    <input type="text" id="material-storage-location" name="storage_location">
                </div>
                <div class="tracking-form-group">
                    <label for="material-notes">Notes</label>
                    <textarea id="material-notes" name="notes" rows="3"></textarea>
                </div>
            `;
            break;
        case 'components':
            fieldsHtml = `
                <div class="tracking-form-group">
                    <label for="component-name">Name *</label>
                    <input type="text" id="component-name" name="name" required>
                </div>
                <div class="tracking-form-group">
                    <label for="component-part-number">Part Number</label>
                    <input type="text" id="component-part-number" name="part_number">
                </div>
                <div class="tracking-form-group">
                    <label for="component-quantity">Quantity *</label>
                    <input type="number" id="component-quantity" name="quantity" min="0" required>
                </div>
                <div class="tracking-form-group">
                    <label for="component-supplier">Supplier</label>
                    <input type="text" id="component-supplier" name="supplier">
                </div>
                <div class="tracking-form-group">
                    <label for="component-storage-location">Storage Location</label>
                    <input type="text" id="component-storage-location" name="storage_location">
                </div>
                <div class="tracking-form-group">
                    <label for="component-notes">Notes</label>
                    <textarea id="component-notes" name="notes" rows="3"></textarea>
                </div>
            `;
            break;
    }

    formFields.innerHTML = fieldsHtml;
    modal.style.display = 'block';
}

function closeAddTrackingModal() {
    const modal = document.getElementById('add-tracking-modal');
    modal.style.display = 'none';
    document.getElementById('tracking-form').reset();
    // Clear edit mode
    delete document.getElementById('tracking-form').dataset.editId;
    delete document.getElementById('tracking-form').dataset.editType;
    document.getElementById('tracking-modal-title').textContent = 'Add Asset';
    document.querySelector('#add-tracking-modal .btn-primary').textContent = 'Add Item';
}

async function editAsset(type, itemId) {
    try {
        const response = await apiFetch(`/api/${type}/${itemId}`);
        const result = await response.json();

        if (!result.success && !result.data) {
            showAlert('Error loading item data', 'Error');
            return;
        }

        const item = result.data || result;

        // Set edit mode
        const form = document.getElementById('tracking-form');
        form.dataset.editId = itemId;
        form.dataset.editType = type;

        // Open modal with edit title
        const modal = document.getElementById('add-tracking-modal');
        const title = document.getElementById('tracking-modal-title');
        const formFields = document.getElementById('tracking-form-fields');

        title.textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)}`;
        document.querySelector('#add-tracking-modal .btn-primary').textContent = 'Update Item';

        // Generate form fields based on type
        let fieldsHtml = '';

        switch (type) {
            case 'equipment':
                fieldsHtml = `
                    <div class="tracking-form-group">
                        <label for="equipment-name">Name *</label>
                        <input type="text" id="equipment-name" name="name" required value="${escapeHtml(item.name || '')}">
                    </div>
                    <div class="tracking-form-group">
                        <label for="equipment-model">Model</label>
                        <input type="text" id="equipment-model" name="model" value="${escapeHtml(item.model || '')}">
                    </div>
                    <div class="tracking-form-group">
                        <label for="equipment-status">Status *</label>
                        <select id="equipment-status" name="status" required>
                            <option value="available" ${item.status === 'available' ? 'selected' : ''}>Available</option>
                            <option value="in_use" ${item.status === 'in_use' ? 'selected' : ''}>In Use</option>
                            <option value="maintenance" ${item.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
                            <option value="retired" ${item.status === 'retired' ? 'selected' : ''}>Retired</option>
                        </select>
                    </div>
                    <div class="tracking-form-group">
                        <label for="equipment-calibration">Calibration Date</label>
                        <input type="date" id="equipment-calibration" name="calibration_date" value="${item.calibration_date || ''}">
                    </div>
                    <div class="tracking-form-group">
                        <label for="equipment-location">Location</label>
                        <input type="text" id="equipment-location" name="location" value="${escapeHtml(item.location || '')}">
                    </div>
                    <div class="tracking-form-group">
                        <label for="equipment-notes">Notes</label>
                        <textarea id="equipment-notes" name="notes" rows="3">${escapeHtml(item.notes || '')}</textarea>
                    </div>
                `;
                break;
            case 'tools':
                fieldsHtml = `
                    <div class="tracking-form-group">
                        <label for="tool-name">Name *</label>
                        <input type="text" id="tool-name" name="name" required value="${escapeHtml(item.name || '')}">
                    </div>
                    <div class="tracking-form-group">
                        <label for="tool-type">Type *</label>
                        <select id="tool-type" name="tool_type" required>
                            <option value="hand_tool" ${item.tool_type === 'hand_tool' ? 'selected' : ''}>Hand Tool</option>
                            <option value="power_tool" ${item.tool_type === 'power_tool' ? 'selected' : ''}>Power Tool</option>
                            <option value="measuring" ${item.tool_type === 'measuring' ? 'selected' : ''}>Measuring</option>
                            <option value="cutting" ${item.tool_type === 'cutting' ? 'selected' : ''}>Cutting</option>
                            <option value="other" ${item.tool_type === 'other' ? 'selected' : ''}>Other</option>
                        </select>
                    </div>
                    <div class="tracking-form-group">
                        <label for="tool-quantity">Quantity *</label>
                        <input type="number" id="tool-quantity" name="quantity" min="1" required value="${item.quantity || 1}">
                    </div>
                    <div class="tracking-form-group">
                        <label for="tool-status">Status *</label>
                        <select id="tool-status" name="status" required>
                            <option value="available" ${item.status === 'available' ? 'selected' : ''}>Available</option>
                            <option value="in_use" ${item.status === 'in_use' ? 'selected' : ''}>In Use</option>
                            <option value="maintenance" ${item.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
                            <option value="lost" ${item.status === 'lost' ? 'selected' : ''}>Lost</option>
                        </select>
                    </div>
                    <div class="tracking-form-group">
                        <label for="tool-location">Location</label>
                        <input type="text" id="tool-location" name="location" value="${escapeHtml(item.location || '')}">
                    </div>
                    <div class="tracking-form-group">
                        <label for="tool-notes">Notes</label>
                        <textarea id="tool-notes" name="notes" rows="3">${escapeHtml(item.notes || '')}</textarea>
                    </div>
                `;
                break;
            case 'materials':
                fieldsHtml = `
                    <div class="tracking-form-group">
                        <label for="material-name">Name *</label>
                        <input type="text" id="material-name" name="name" required value="${escapeHtml(item.name || '')}">
                    </div>
                    <div class="tracking-form-group">
                        <label for="material-type">Type *</label>
                        <select id="material-type" name="material_type" required>
                            <option value="metal" ${item.material_type === 'metal' ? 'selected' : ''}>Metal</option>
                            <option value="plastic" ${item.material_type === 'plastic' ? 'selected' : ''}>Plastic</option>
                            <option value="wood" ${item.material_type === 'wood' ? 'selected' : ''}>Wood</option>
                            <option value="chemical" ${item.material_type === 'chemical' ? 'selected' : ''}>Chemical</option>
                            <option value="electronic" ${item.material_type === 'electronic' ? 'selected' : ''}>Electronic</option>
                            <option value="other" ${item.material_type === 'other' ? 'selected' : ''}>Other</option>
                        </select>
                    </div>
                    <div class="tracking-form-group">
                        <label for="material-unit-mass">Unit Mass/Size *</label>
                        <input type="number" id="material-unit-mass" name="unit_mass" min="0" step="0.01" required value="${item.unit_mass || 0}">
                    </div>
                    <div class="tracking-form-group">
                        <label for="material-unit-mass-unit">Unit Mass Unit *</label>
                        <select id="material-unit-mass-unit" name="unit_mass_unit" required>
                            <option value="kg" ${item.unit_mass_unit === 'kg' ? 'selected' : ''}>Kilograms (kg)</option>
                            <option value="g" ${item.unit_mass_unit === 'g' ? 'selected' : ''}>Grams (g)</option>
                            <option value="l" ${item.unit_mass_unit === 'l' ? 'selected' : ''}>Liters (l)</option>
                            <option value="ml" ${item.unit_mass_unit === 'ml' ? 'selected' : ''}>Milliliters (ml)</option>
                            <option value="m" ${item.unit_mass_unit === 'm' ? 'selected' : ''}>Meters (m)</option>
                            <option value="cm" ${item.unit_mass_unit === 'cm' ? 'selected' : ''}>Centimeters (cm)</option>
                        </select>
                    </div>
                    <div class="tracking-form-group">
                        <label for="material-quantity">Number of Units *</label>
                        <input type="number" id="material-quantity" name="quantity" min="1" required value="${item.quantity || 1}">
                    </div>
                    <div class="tracking-form-group">
                        <label for="material-supplier">Supplier</label>
                        <input type="text" id="material-supplier" name="supplier" value="${escapeHtml(item.supplier || '')}">
                    </div>
                    <div class="tracking-form-group">
                        <label for="material-storage-location">Storage Location</label>
                        <input type="text" id="material-storage-location" name="storage_location" value="${escapeHtml(item.storage_location || '')}">
                    </div>
                    <div class="tracking-form-group">
                        <label for="material-notes">Notes</label>
                        <textarea id="material-notes" name="notes" rows="3">${escapeHtml(item.notes || '')}</textarea>
                    </div>
                `;
                break;
            case 'components':
                fieldsHtml = `
                    <div class="tracking-form-group">
                        <label for="component-name">Name *</label>
                        <input type="text" id="component-name" name="name" required value="${escapeHtml(item.name || '')}">
                    </div>
                    <div class="tracking-form-group">
                        <label for="component-part-number">Part Number</label>
                        <input type="text" id="component-part-number" name="part_number" value="${escapeHtml(item.part_number || '')}">
                    </div>
                    <div class="tracking-form-group">
                        <label for="component-quantity">Quantity *</label>
                        <input type="number" id="component-quantity" name="quantity" min="0" required value="${item.quantity || 0}">
                    </div>
                    <div class="tracking-form-group">
                        <label for="component-supplier">Supplier</label>
                        <input type="text" id="component-supplier" name="supplier" value="${escapeHtml(item.supplier || '')}">
                    </div>
                    <div class="tracking-form-group">
                        <label for="component-storage-location">Storage Location</label>
                        <input type="text" id="component-storage-location" name="storage_location" value="${escapeHtml(item.storage_location || '')}">
                    </div>
                    <div class="tracking-form-group">
                        <label for="component-notes">Notes</label>
                        <textarea id="component-notes" name="notes" rows="3">${escapeHtml(item.notes || '')}</textarea>
                    </div>
                `;
                break;
        }

        formFields.innerHTML = fieldsHtml;
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Error loading item for edit:', error);
        showAlert('Error loading item data', 'Error');
    }
}

async function submitTrackingForm() {
    const form = document.getElementById('tracking-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Check if we're in edit mode
    const isEditMode = form.dataset.editId && form.dataset.editType;
    const type = isEditMode ? form.dataset.editType : currentTrackingTab;
    const itemId = isEditMode ? form.dataset.editId : null;

    // Validate required fields
    const requiredFields = {
        equipment: ['name', 'status'],
        tools: ['name', 'tool_type', 'quantity', 'status'],
        materials: ['name', 'material_type', 'unit_mass', 'unit_mass_unit', 'quantity'],
        components: ['name', 'quantity'],
        others: ['name']
    };

    for (const field of requiredFields[type] || []) {
        if (!data[field] || data[field].trim() === '') {
            showAlert(`Please fill in all required fields.`, 'Error');
            return;
        }
    }

    // Remove empty optional fields to avoid sending empty strings
    const optionalFields = ['part_number', 'description', 'manufacturer', 'supplier', 'storage_location', 'location', 'notes', 'model', 'calibration_date', 'tool_type', 'material_type', 'unit', 'datasheet', 'supplier_part_number'];
    for (const field of optionalFields) {
        if (data[field] === '' || data[field] === undefined) {
            delete data[field];
        }
    }

    // Convert quantity to number if present
    if (data.quantity) {
        data.quantity = parseInt(data.quantity, 10);
    }

    try {
        let endpoint;
        let method;

        if (isEditMode) {
            endpoint = `/api/${type}/${itemId}`;
            method = 'PUT';
        } else {
            switch (type) {
                case 'equipment':
                    endpoint = '/api/equipment';
                    break;
                case 'tools':
                    endpoint = '/api/tools';
                    break;
                case 'materials':
                    endpoint = '/api/materials';
                    break;
                case 'components':
                    endpoint = '/api/components';
                    break;
            }
            method = 'POST';
        }

        const response = await apiFetch(endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        // Check if the request was successful (either success field or id field present)
        if (result.success || result.id) {
            showAlert(`${type.charAt(0).toUpperCase() + type.slice(1)} ${isEditMode ? 'updated' : 'added'} successfully!`, 'Success');
            closeAddTrackingModal();
            loadTrackingData(type);
        } else {
            showAlert(`Error ${isEditMode ? 'updating' : 'adding'} ${type}: ${result.message || 'Unknown error'}`, 'Error');
        }
    } catch (error) {
        console.error('Error submitting tracking form:', error);
        showAlert(`Error ${isEditMode ? 'updating' : 'adding'} ${type}. Please try again.`, 'Error');
    }
}

// Initialize tracking when page loads — wait for backend to be ready first
document.addEventListener('DOMContentLoaded', async () => {
    await waitForBackend(20000);
    initAssets();
    initFinance();
});


// Finance tracking functionality
let currentFinanceTab = 'overview';

function initFinance() {
    // Setup tab switching
    document.querySelectorAll('.finance-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.finance-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFinanceTab = tab.dataset.tab;
            loadFinanceData(currentFinanceTab);
        });
    });

    // Load initial data
    loadFinanceData('overview');
}

async function loadFinanceData(tab) {
    const content = document.getElementById('finance-content');
    content.innerHTML = '<p>Loading...</p>';

    try {
        if (tab === 'overview') {
            await loadFinanceOverview();
        } else if (tab === 'funding-sources') {
            await loadFundingSources();
        } else if (tab === 'gains') {
            await loadGains();
        } else if (tab === 'purchases') {
            await loadPurchases();
        } else if (tab === 'maintenance') {
            await loadMaintenanceCosts();
        }
    } catch (error) {
        console.error('Error loading finance data:', error);
        content.innerHTML = '<p>Error loading data</p>';
    }
}

async function loadFinanceOverview() {
    const content = document.getElementById('finance-content');

    try {
        // Fetch all finance data
        const [sourcesRes, gainsRes, purchasesRes, maintenanceRes] = await Promise.all([
            apiFetch('/api/funding-sources'),
            apiFetch('/api/gains'),
            apiFetch('/api/purchases'),
            apiFetch('/api/maintenance-costs')
        ]);

        const sources = (await sourcesRes.json()).data || [];
        const gains = (await gainsRes.json()).data || [];
        const purchases = (await purchasesRes.json()).data || [];
        const maintenance = (await maintenanceRes.json()).data || [];

        // Calculate totals
        const totalBudget = sources.reduce((sum, s) => sum + (s.budget_limit || 0), 0);
        const currentBalance = sources.reduce((sum, s) => sum + (s.current_balance || 0), 0);
        const totalGains = gains.reduce((sum, g) => sum + g.amount, 0);
        const totalPurchases = purchases.reduce((sum, p) => sum + p.cost, 0);
        const totalMaintenance = maintenance.reduce((sum, m) => sum + m.cost, 0);
        const totalSpendings = totalPurchases + totalMaintenance;
        const netBalance = totalGains - totalSpendings;

        // Calculate spending by category
        const spendingByType = {
            'Equipment': purchases.filter(p => p.item_type === 'equipment').reduce((sum, p) => sum + p.cost, 0),
            'Tools': purchases.filter(p => p.item_type === 'tool').reduce((sum, p) => sum + p.cost, 0),
            'Materials': purchases.filter(p => p.item_type === 'material').reduce((sum, p) => sum + p.cost, 0),
            'Components': purchases.filter(p => p.item_type === 'component').reduce((sum, p) => sum + p.cost, 0),
            'Maintenance': totalMaintenance
        };

        // Calculate gains by category
        const gainsByCategory = {};
        gains.forEach(g => {
            const category = g.category || 'Other';
            gainsByCategory[category] = (gainsByCategory[category] || 0) + g.amount;
        });

        let html = '<div class="finance-overview">';
        html += `<div class="finance-card">
            <div class="finance-card-title">Total Budget</div>
            <div class="finance-card-value">$${totalBudget.toFixed(2)}</div>
        </div>`;
        html += `<div class="finance-card">
            <div class="finance-card-title">Current Balance</div>
            <div class="finance-card-value ${currentBalance >= 0 ? 'positive' : 'negative'}">$${currentBalance.toFixed(2)}</div>
        </div>`;
        html += `<div class="finance-card">
            <div class="finance-card-title">Total Gains</div>
            <div class="finance-card-value positive">$${totalGains.toFixed(2)}</div>
        </div>`;
        html += `<div class="finance-card">
            <div class="finance-card-title">Total Spendings</div>
            <div class="finance-card-value negative">$${totalSpendings.toFixed(2)}</div>
        </div>`;
        html += `<div class="finance-card">
            <div class="finance-card-title">Net Balance</div>
            <div class="finance-card-value ${netBalance >= 0 ? 'positive' : 'negative'}">$${netBalance.toFixed(2)}</div>
        </div>`;
        html += '</div>';

        // Spending Analysis Section
        html += '<div class="finance-analysis-section">';
        html += '<h3>💰 Spending Analysis</h3>';
        html += '<div class="finance-analysis-grid">';

        Object.entries(spendingByType).forEach(([type, amount]) => {
            const percentage = totalSpendings > 0 ? (amount / totalSpendings * 100).toFixed(1) : 0;
            html += `<div class="finance-analysis-item">
                <div class="finance-analysis-label">${type}</div>
                <div class="finance-analysis-bar">
                    <div class="finance-analysis-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="finance-analysis-value">$${amount.toFixed(2)} (${percentage}%)</div>
            </div>`;
        });

        html += '</div></div>';

        // Gains Analysis Section
        html += '<div class="finance-analysis-section">';
        html += '<h3>📈 Earnings Analysis</h3>';
        html += '<div class="finance-analysis-grid">';

        Object.entries(gainsByCategory).forEach(([category, amount]) => {
            const percentage = totalGains > 0 ? (amount / totalGains * 100).toFixed(1) : 0;
            html += `<div class="finance-analysis-item">
                <div class="finance-analysis-label">${category}</div>
                <div class="finance-analysis-bar">
                    <div class="finance-analysis-fill gains-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="finance-analysis-value">$${amount.toFixed(2)} (${percentage}%)</div>
            </div>`;
        });

        html += '</div></div>';

        // Lab Impact Analysis
        html += '<div class="finance-impact-section">';
        html += '<h3>🔬 Lab Impact Analysis</h3>';
        html += '<div class="finance-impact-grid">';

        // Calculate impact metrics
        const equipmentSpending = spendingByType['Equipment'] + spendingByType['Tools'];
        const researchSpending = spendingByType['Materials'] + spendingByType['Components'];
        const researchFunding = gainsByCategory['research'] || 0;
        const operationalSpending = spendingByType['Maintenance'];

        html += `<div class="finance-impact-card">
            <div class="finance-impact-title">Research Investment</div>
            <div class="finance-impact-value">$${researchSpending.toFixed(2)}</div>
            <div class="finance-impact-desc">Materials & Components</div>
        </div>`;

        html += `<div class="finance-impact-card">
            <div class="finance-impact-title">Equipment Investment</div>
            <div class="finance-impact-value">$${equipmentSpending.toFixed(2)}</div>
            <div class="finance-impact-desc">Equipment & Tools</div>
        </div>`;

        html += `<div class="finance-impact-card">
            <div class="finance-impact-title">Research Funding</div>
            <div class="finance-impact-value">$${researchFunding.toFixed(2)}</div>
            <div class="finance-impact-desc">Grants & Research Income</div>
        </div>`;

        html += `<div class="finance-impact-card">
            <div class="finance-impact-title">Operational Costs</div>
            <div class="finance-impact-value">$${operationalSpending.toFixed(2)}</div>
            <div class="finance-impact-desc">Maintenance & Repairs</div>
        </div>`;

        html += '</div>';

        // Impact summary
        const investmentRatio = researchSpending > 0 ? ((researchFunding / researchSpending) * 100).toFixed(1) : 0;
        html += `<div class="finance-impact-summary">
            <strong>Research Funding Ratio:</strong> ${investmentRatio}% of research spending covered by research funding
        </div>`;

        html += '</div>';

        html += '<h3>Recent Gains</h3>';
        html += '<table class="finance-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Source</th></tr></thead><tbody>';
        gains.slice(0, 5).forEach(g => {
            html += `<tr>
                <td>${g.gain_date}</td>
                <td>${g.gain_type}</td>
                <td>$${g.amount.toFixed(2)} <span class="currency-badge">${g.currency}</span></td>
                <td>${g.source || '-'}</td>
            </tr>`;
        });
        html += '</tbody></table>';

        html += '<h3>Recent Purchases</h3>';
        html += '<table class="finance-table"><thead><tr><th>Date</th><th>Item Type</th><th>Cost</th><th>Funding Source</th></tr></thead><tbody>';
        purchases.slice(0, 5).forEach(p => {
            html += `<tr>
                <td>${p.purchase_date}</td>
                <td>${p.item_type}</td>
                <td>$${p.cost.toFixed(2)} <span class="currency-badge">${p.currency}</span></td>
                <td>${p.funding_source_id || '-'}</td>
            </tr>`;
        });
        html += '</tbody></table>';

        content.innerHTML = html;
    } catch (error) {
        console.error('Error loading finance overview:', error);
        content.innerHTML = '<p>Error loading data</p>';
    }
}

async function loadFundingSources() {
    const content = document.getElementById('finance-content');

    try {
        const response = await apiFetch('/api/funding-sources');
        const data = await response.json();

        if (data.success) {
            let html = '<table class="finance-table"><thead><tr><th>Name</th><th>Type</th><th>Budget Limit</th><th>Current Balance</th><th>Contact</th><th>Actions</th></tr></thead><tbody>';

            data.data.forEach(source => {
                html += `<tr>
                    <td>${source.name}</td>
                    <td>${source.source_type}</td>
                    <td>$${(source.budget_limit || 0).toFixed(2)}</td>
                    <td class="${source.current_balance >= 0 ? 'positive' : 'negative'}">$${source.current_balance.toFixed(2)}</td>
                    <td>${source.contact_person || '-'}</td>
                    <td class="finance-actions">
                        <button class="btn btn-secondary" onclick="editFundingSource(${source.id})">Edit</button>
                        <button class="btn btn-secondary" onclick="deleteFundingSource(${source.id})">Delete</button>
                    </td>
                </tr>`;
            });

            html += '</tbody></table>';
            content.innerHTML = html;
        } else {
            content.innerHTML = '<p>Error loading funding sources</p>';
        }
    } catch (error) {
        console.error('Error loading funding sources:', error);
        content.innerHTML = '<p>Error loading funding sources</p>';
    }
}

async function loadGains() {
    const content = document.getElementById('finance-content');

    try {
        const response = await apiFetch('/api/gains');
        const data = await response.json();

        if (data.success) {
            let html = '<table class="finance-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Currency</th><th>Source</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead><tbody>';

            data.data.forEach(gain => {
                html += `<tr>
                    <td>${gain.gain_date}</td>
                    <td>${gain.gain_type}</td>
                    <td>$${gain.amount.toFixed(2)}</td>
                    <td>${gain.currency}</td>
                    <td>${gain.source || '-'}</td>
                    <td>${gain.category || '-'}</td>
                    <td>${gain.status}</td>
                    <td class="finance-actions">
                        <button class="btn btn-secondary" onclick="deleteGain(${gain.id})">Delete</button>
                    </td>
                </tr>`;
            });

            html += '</tbody></table>';
            content.innerHTML = html;
        } else {
            content.innerHTML = '<p>Error loading gains</p>';
        }
    } catch (error) {
        console.error('Error loading gains:', error);
        content.innerHTML = '<p>Error loading gains</p>';
    }
}

async function loadPurchases() {
    const content = document.getElementById('finance-content');

    try {
        const response = await apiFetch('/api/purchases');
        const data = await response.json();

        if (data.success) {
            let html = '<table class="finance-table"><thead><tr><th>Date</th><th>Item Type</th><th>Item ID</th><th>Cost</th><th>Vendor</th><th>Invoice</th><th>Actions</th></tr></thead><tbody>';

            data.data.forEach(purchase => {
                html += `<tr>
                    <td>${purchase.purchase_date}</td>
                    <td>${purchase.item_type}</td>
                    <td>${purchase.item_id}</td>
                    <td>$${purchase.cost.toFixed(2)} <span class="currency-badge">${purchase.currency}</span></td>
                    <td>${purchase.vendor || '-'}</td>
                    <td>${purchase.invoice_number || '-'}</td>
                    <td class="finance-actions">
                        <button class="btn btn-secondary" onclick="deletePurchase(${purchase.id})">Delete</button>
                    </td>
                </tr>`;
            });

            html += '</tbody></table>';
            content.innerHTML = html;
        } else {
            content.innerHTML = '<p>Error loading purchases</p>';
        }
    } catch (error) {
        console.error('Error loading purchases:', error);
        content.innerHTML = '<p>Error loading purchases</p>';
    }
}

async function loadMaintenanceCosts() {
    const content = document.getElementById('finance-content');

    try {
        const response = await apiFetch('/api/maintenance-costs');
        const data = await response.json();

        if (data.success) {
            let html = '<table class="finance-table"><thead><tr><th>Date</th><th>Item Type</th><th>Item ID</th><th>Cost</th><th>Service Provider</th><th>Description</th><th>Actions</th></tr></thead><tbody>';

            data.data.forEach(cost => {
                html += `<tr>
                    <td>${cost.maintenance_date}</td>
                    <td>${cost.item_type}</td>
                    <td>${cost.item_id}</td>
                    <td>$${cost.cost.toFixed(2)} <span class="currency-badge">${cost.currency}</span></td>
                    <td>${cost.service_provider || '-'}</td>
                    <td>${cost.description || '-'}</td>
                    <td class="finance-actions">
                        <button class="btn btn-secondary" onclick="deleteMaintenanceCost(${cost.id})">Delete</button>
                    </td>
                </tr>`;
            });

            html += '</tbody></table>';
            content.innerHTML = html;
        } else {
            content.innerHTML = '<p>Error loading maintenance costs</p>';
        }
    } catch (error) {
        console.error('Error loading maintenance costs:', error);
        content.innerHTML = '<p>Error loading maintenance costs</p>';
    }
}

async function openAddFundingSourceModal() {
    const result = await showMultiField([
        { name: 'name', label: 'Funding Source Name *', type: 'text', placeholder: 'e.g. Research Grant 2026' },
        { name: 'type', label: 'Source Type *', type: 'select', options: ['grant', 'budget', 'donation', 'investment', 'revenue', 'other'] },
        { name: 'budget', label: 'Budget Limit (optional)', type: 'text', placeholder: 'e.g. 50000' },
        { name: 'balance', label: 'Initial Balance (optional)', type: 'text', placeholder: 'e.g. 50000' },
        { name: 'contact', label: 'Contact Person (optional)', type: 'text', placeholder: 'e.g. Dr. Smith' }
    ], 'Add Funding Source', 'Enter the funding source details:');

    if (!result) return;
    const { name, type, budget, balance, contact } = result;

    if (!name || !type) {
        showAlert('Name and type are required');
        return;
    }

    apiFetch('/api/funding-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            source_type: type,
            budget_limit: budget ? parseFloat(budget) : null,
            current_balance: balance ? parseFloat(balance) : 0,
            contact_person: contact
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showAlert('Funding source added successfully');
                loadFinanceData(currentFinanceTab);
            } else {
                showAlert('Error adding funding source');
            }
        })
        .catch(error => {
            console.error('Error adding funding source:', error);
            showAlert('Error adding funding source');
        });
}

function openAddGainModal() {
    const modal = document.getElementById('gain-modal-overlay');
    if (modal) {
        modal.style.display = 'flex';
        // Set default date to today
        const dateInput = document.getElementById('gain-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }
}

function closeGainModal() {
    const modal = document.getElementById('gain-modal-overlay');
    if (modal) {
        modal.style.display = 'none';
    }
    // Clear form
    const typeInput = document.getElementById('gain-type');
    const amountInput = document.getElementById('gain-amount');
    const currencyInput = document.getElementById('gain-currency');
    const dateInput = document.getElementById('gain-date');
    const sourceInput = document.getElementById('gain-source');
    const categoryInput = document.getElementById('gain-category');
    const descInput = document.getElementById('gain-description');

    if (typeInput) typeInput.value = '';
    if (amountInput) amountInput.value = '';
    if (currencyInput) currencyInput.value = 'USD';
    if (dateInput) dateInput.value = '';
    if (sourceInput) sourceInput.value = '';
    if (categoryInput) categoryInput.value = '';
    if (descInput) descInput.value = '';
}

function saveGain() {
    const gainType = document.getElementById('gain-type').value;
    const amount = parseFloat(document.getElementById('gain-amount').value);
    const currency = document.getElementById('gain-currency').value;
    const date = document.getElementById('gain-date').value;
    const source = document.getElementById('gain-source').value;
    const category = document.getElementById('gain-category').value;
    const description = document.getElementById('gain-description').value;

    if (!gainType || !amount || !date) {
        showAlert('Gain type, amount, and date are required');
        return;
    }

    apiFetch('/api/gains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            gain_type: gainType,
            amount: amount,
            gain_date: date,
            currency: currency,
            source: source,
            category: category,
            description: description
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showAlert('Gain recorded successfully');
                closeGainModal();
                loadFinanceData(currentFinanceTab);
            } else {
                showAlert('Error recording gain');
            }
        })
        .catch(error => {
            console.error('Error recording gain:', error);
            showAlert('Error recording gain');
        });
}

function openAddPurchaseModal() {
    const modal = document.getElementById('purchase-modal-overlay');
    if (modal) {
        modal.style.display = 'flex';
        // Set default date to today
        const dateInput = document.getElementById('purchase-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }
}

function closePurchaseModal() {
    const modal = document.getElementById('purchase-modal-overlay');
    if (modal) {
        modal.style.display = 'none';
    }
    // Clear form
    const itemType = document.getElementById('purchase-item-type');
    const itemId = document.getElementById('purchase-item-id');
    const cost = document.getElementById('purchase-cost');
    const currency = document.getElementById('purchase-currency');
    const date = document.getElementById('purchase-date');
    const vendor = document.getElementById('purchase-vendor');
    const invoice = document.getElementById('purchase-invoice');
    const payment = document.getElementById('purchase-payment');
    const funding = document.getElementById('purchase-funding');
    const notes = document.getElementById('purchase-notes');

    if (itemType) itemType.value = '';
    if (itemId) itemId.value = '';
    if (cost) cost.value = '';
    if (currency) currency.value = 'USD';
    if (date) date.value = '';
    if (vendor) vendor.value = '';
    if (invoice) invoice.value = '';
    if (payment) payment.value = '';
    if (funding) funding.value = '';
    if (notes) notes.value = '';
}

function savePurchase() {
    const itemType = document.getElementById('purchase-item-type').value;
    const itemId = parseInt(document.getElementById('purchase-item-id').value);
    const cost = parseFloat(document.getElementById('purchase-cost').value);
    const currency = document.getElementById('purchase-currency').value;
    const date = document.getElementById('purchase-date').value;
    const vendor = document.getElementById('purchase-vendor').value;
    const invoice = document.getElementById('purchase-invoice').value;
    const payment = document.getElementById('purchase-payment').value;
    const fundingSource = document.getElementById('purchase-funding').value;
    const notes = document.getElementById('purchase-notes').value;

    if (!itemType || !itemId || !cost || !date) {
        showAlert('Item type, ID, cost, and date are required');
        return;
    }

    apiFetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            item_type: itemType,
            item_id: itemId,
            cost: cost,
            currency: currency,
            purchase_date: date,
            vendor: vendor,
            invoice_number: invoice,
            payment_method: payment,
            funding_source_id: fundingSource ? parseInt(fundingSource) : null,
            notes: notes
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showAlert('Purchase recorded successfully');
                closePurchaseModal();
                loadFinanceData(currentFinanceTab);
            } else {
                showAlert('Error recording purchase');
            }
        })
        .catch(error => {
            console.error('Error recording purchase:', error);
            showAlert('Error recording purchase');
        });
}

function openAddMaintenanceCostModal() {
    const modal = document.getElementById('maintenance-modal-overlay');
    if (modal) {
        modal.style.display = 'flex';
        // Set default date to today
        const dateInput = document.getElementById('maintenance-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }
}

function closeMaintenanceModal() {
    const modal = document.getElementById('maintenance-modal-overlay');
    if (modal) {
        modal.style.display = 'none';
    }
    // Clear form
    const itemType = document.getElementById('maintenance-item-type');
    const itemId = document.getElementById('maintenance-item-id');
    const cost = document.getElementById('maintenance-cost');
    const currency = document.getElementById('maintenance-currency');
    const date = document.getElementById('maintenance-date');
    const provider = document.getElementById('maintenance-provider');
    const description = document.getElementById('maintenance-description');
    const invoice = document.getElementById('maintenance-invoice');
    const funding = document.getElementById('maintenance-funding');
    const notes = document.getElementById('maintenance-notes');

    if (itemType) itemType.value = '';
    if (itemId) itemId.value = '';
    if (cost) cost.value = '';
    if (currency) currency.value = 'USD';
    if (date) date.value = '';
    if (provider) provider.value = '';
    if (description) description.value = '';
    if (invoice) invoice.value = '';
    if (funding) funding.value = '';
    if (notes) notes.value = '';
}

function saveMaintenance() {
    const itemType = document.getElementById('maintenance-item-type').value;
    const itemId = parseInt(document.getElementById('maintenance-item-id').value);
    const cost = parseFloat(document.getElementById('maintenance-cost').value);
    const currency = document.getElementById('maintenance-currency').value;
    const date = document.getElementById('maintenance-date').value;
    const provider = document.getElementById('maintenance-provider').value;
    const description = document.getElementById('maintenance-description').value;
    const invoice = document.getElementById('maintenance-invoice').value;
    const fundingSource = document.getElementById('maintenance-funding').value;
    const notes = document.getElementById('maintenance-notes').value;

    if (!itemType || !itemId || !cost || !date) {
        showAlert('Item type, ID, cost, and date are required');
        return;
    }

    apiFetch('/api/maintenance-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            item_type: itemType,
            item_id: itemId,
            cost: cost,
            currency: currency,
            maintenance_date: date,
            service_provider: provider,
            description: description,
            invoice_number: invoice,
            funding_source_id: fundingSource ? parseInt(fundingSource) : null,
            notes: notes
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showAlert('Maintenance cost recorded successfully');
                closeMaintenanceModal();
                loadFinanceData(currentFinanceTab);
            } else {
                showAlert('Error recording maintenance cost');
            }
        })
        .catch(error => {
            console.error('Error recording maintenance cost:', error);
            showAlert('Error recording maintenance cost');
        });
}

function loadFundingSourcesIntoSelect(selectId) {
    apiFetch('/api/funding-sources')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const select = document.getElementById(selectId);
                select.innerHTML = '<option value="">Select funding source...</option>';
                data.data.forEach(source => {
                    select.innerHTML += `<option value="${source.id}">${source.name}</option>`;
                });
            }
        })
        .catch(error => {
            console.error('Error loading funding sources:', error);
        });
}

async function deleteFundingSource(id) {
    if (!(await showConfirm('Are you sure you want to delete this funding source?', 'Delete Funding Source'))) return;

    apiFetch(`/api/funding-sources/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showAlert('Funding source deleted successfully');
                loadFinanceData(currentFinanceTab);
            } else {
                showAlert('Error deleting funding source');
            }
        })
        .catch(error => {
            console.error('Error deleting funding source:', error);
            showAlert('Error deleting funding source');
        });
}

async function deletePurchase(id) {
    if (!(await showConfirm('Are you sure you want to delete this purchase?', 'Delete Purchase'))) return;

    apiFetch(`/api/purchases/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showAlert('Purchase deleted successfully');
                loadFinanceData(currentFinanceTab);
            } else {
                showAlert('Error deleting purchase');
            }
        })
        .catch(error => {
            console.error('Error deleting purchase:', error);
            showAlert('Error deleting purchase');
        });
}

async function deleteMaintenanceCost(id) {
    if (!(await showConfirm('Are you sure you want to delete this maintenance cost?', 'Delete Maintenance Cost'))) return;

    apiFetch(`/api/maintenance-costs/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showAlert('Maintenance cost deleted successfully');
                loadFinanceData(currentFinanceTab);
            } else {
                showAlert('Error deleting maintenance cost');
            }
        })
        .catch(error => {
            console.error('Error deleting maintenance cost:', error);
            showAlert('Error deleting maintenance cost');
        });
}

async function deleteGain(id) {
    if (!(await showConfirm('Are you sure you want to delete this gain?', 'Delete Gain'))) return;

    apiFetch(`/api/gains/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showAlert('Gain deleted successfully');
                loadFinanceData(currentFinanceTab);
            } else {
                showAlert('Error deleting gain');
            }
        })
        .catch(error => {
            console.error('Error deleting gain:', error);
            showAlert('Error deleting gain');
        });
}

async function editFundingSource(id) {
    showAlert('Edit functionality coming soon. Delete and re-add the funding source to update it.', 'Edit Funding Source');
}


// Global Search (Ctrl+K)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search-input').focus();
    }
});

// Global search input handler
document.getElementById('global-search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query) {
            // TODO: Navigate to search page
            document.getElementById('search-input').value = query;
            performSearch();
        }
    }
});

// Initialize dashboard on load — wait for backend to be ready first
document.addEventListener('DOMContentLoaded', async () => {
    await waitForBackend(20000);
    loadDashboard();
    loadChatHistory();
});

