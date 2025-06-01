/**
 * Scheduler Manager functionality
 */

let scheduledJobs = [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadScheduledJobs();
    
    // Set up form submission
    document.getElementById('add-job-form').addEventListener('submit', handleAddJob);
    
    // Auto-refresh jobs every 30 seconds
    setInterval(loadScheduledJobs, 30000);
});

async function loadScheduledJobs() {
    try {
        console.log('Loading scheduled jobs...');
        const response = await fetch('/api/scheduler/jobs');
        console.log('Response status:', response.status);
        
        if (response.ok) {
            scheduledJobs = await response.json();
            console.log('Loaded jobs:', scheduledJobs);
            displayScheduledJobs();
        } else {
            const errorText = await response.text();
            console.error('Failed to load jobs:', errorText);
            showToast('Failed to load scheduled jobs', 'error');
        }
    } catch (error) {
        console.error('Error loading scheduled jobs:', error);
        showToast('Error loading scheduled jobs', 'error');
    }
}

function displayScheduledJobs() {
    const container = document.getElementById('jobs-list');
    
    if (scheduledJobs.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-calendar-times text-3xl mb-2"></i>
                <p>No scheduled jobs</p>
                <p class="text-sm mt-1">Click "Add New Job" to create one</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    scheduledJobs.forEach(job => {
        const jobElement = document.createElement('div');
        jobElement.className = 'flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg';
        
        const typeIcon = job.type === 'daily' ? 'fa-calendar-day' : 'fa-sync';
        const statusClass = job.paused ? 'text-warning' : 'text-success';
        const statusIcon = job.paused ? 'fa-pause-circle' : 'fa-play-circle';
        
        let scheduleText = '';
        if (job.type === 'daily') {
            scheduleText = `Daily at ${job.time} IST`;
        } else if (job.type === 'interval') {
            scheduleText = `Every ${job.minutes} minutes`;
        }
        
        jobElement.innerHTML = `
            <div class="flex items-center gap-4">
                <i class="fas ${typeIcon} text-xl text-primary"></i>
                <div>
                    <p class="font-medium text-gray-900 dark:text-white">
                        ${job.name || job.id}
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                        ${scheduleText} • ${job.interval} data
                    </p>
                    ${job.next_run ? `
                        <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            Next run: ${formatDateTime(job.next_run)}
                        </p>
                    ` : ''}
                </div>
            </div>
            <div class="flex items-center gap-2">
                <i class="fas ${statusIcon} ${statusClass}"></i>
                <button onclick="runJobNow('${job.id}')" class="btn-icon" title="Run now">
                    <i class="fas fa-play"></i>
                </button>
                ${job.paused ? `
                    <button onclick="resumeJob('${job.id}')" class="btn-icon" title="Resume">
                        <i class="fas fa-play-circle"></i>
                    </button>
                ` : `
                    <button onclick="pauseJob('${job.id}')" class="btn-icon" title="Pause">
                        <i class="fas fa-pause-circle"></i>
                    </button>
                `}
                <button onclick="deleteJob('${job.id}')" class="btn-icon text-error" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        container.appendChild(jobElement);
    });
}

function showAddJobModal() {
    console.log("New showAddJobModal called");
    
    // Check if emergency modal already exists (prevent duplicates)
    if (document.getElementById('emergency-modal')) {
        document.getElementById('emergency-modal').style.display = 'flex';
        return;
    }
    
    // Create a direct, emergency modal that bypasses the existing modal system
    const emergencyModal = document.createElement('div');
    emergencyModal.id = 'emergency-modal';
    
    // Apply direct inline styles for maximum override
    emergencyModal.style.position = 'fixed';
    emergencyModal.style.top = '0';
    emergencyModal.style.left = '0';
    emergencyModal.style.right = '0';
    emergencyModal.style.bottom = '0';
    emergencyModal.style.display = 'flex';
    emergencyModal.style.alignItems = 'center';
    emergencyModal.style.justifyContent = 'center';
    emergencyModal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    emergencyModal.style.zIndex = '99999';
    
    // Create modal content
    const form = document.getElementById('add-job-form');
    const originalModal = document.getElementById('add-job-modal');
    
    if (originalModal && form) {
        // Copy the form from the original modal
        const modalHTML = `
            <div style="background-color: white; padding: 20px; border-radius: 8px; max-width: 500px; width: 100%; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                    <h3 style="margin: 0; font-size: 20px;">Add Scheduled Job</h3>
                    <button onclick="closeAddJobModal()" style="background: none; border: none; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div id="emergency-form-container"></div>
                <div style="display: flex; justify-content: flex-end; margin-top: 20px; gap: 10px;">
                    <button type="button" onclick="closeAddJobModal()" class="btn-modern btn-secondary">Cancel</button>
                    <button type="button" onclick="handleEmergencyFormSubmit()" class="btn-modern btn-primary">Add Job</button>
                </div>
            </div>
        `;
        
        emergencyModal.innerHTML = modalHTML;
        document.body.appendChild(emergencyModal);
        
        // Clone the form and insert it into our emergency modal
        const formClone = form.cloneNode(true);
        formClone.id = "emergency-form";
        document.getElementById('emergency-form-container').appendChild(formClone);
        
        // Set up event listeners for the form
        formClone.addEventListener('submit', function(e) {
            e.preventDefault();
            handleAddJob(e, true);
        });
        
        // Set up radio button handlers
        formClone.querySelectorAll('input[name="job_type"]').forEach(radio => {
            radio.addEventListener('change', () => updateJobTypeUI(true));
        });
        
        formClone.querySelectorAll('input[name="symbol_selection"]').forEach(radio => {
            radio.addEventListener('change', () => updateSymbolSelectionUI(true));
        });
    } else {
        emergencyModal.innerHTML = `
            <div style="background-color: white; padding: 20px; border-radius: 8px; max-width: 500px; width: 100%; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                <h3>Error: Could not find form elements</h3>
                <p>There was an error loading the form. Please refresh the page and try again.</p>
                <button onclick="closeAddJobModal()" style="background-color: #f44336; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 15px;">Close</button>
            </div>
        `;
        document.body.appendChild(emergencyModal);
    }
}

function closeAddJobModal() {
    console.log("New closeAddJobModal called");
    
    // Handle the emergency modal
    const emergencyModal = document.getElementById('emergency-modal');
    if (emergencyModal) {
        emergencyModal.style.display = 'none';
        const emergencyForm = document.getElementById('emergency-form');
        if (emergencyForm) {
            emergencyForm.reset();
        }
    }
    
    // Also handle the original modal just in case
    const originalModal = document.getElementById('add-job-modal');
    if (originalModal) {
        originalModal.classList.add('hidden');
        const originalForm = document.getElementById('add-job-form');
        if (originalForm) {
            originalForm.reset();
        }
    }
}

function updateJobTypeUI(isEmergencyModal = false) {
    const prefix = isEmergencyModal ? 'emergency-form-container' : '';
    const form = isEmergencyModal ? document.getElementById('emergency-form') : document;
    
    if (!form) return;
    
    const jobType = form.querySelector('input[name="job_type"]:checked')?.value;
    if (!jobType) return;
    
    const dailySettings = form.querySelectorAll('.daily-settings');
    const intervalSettings = form.querySelectorAll('.interval-settings');
    
    if (jobType === 'daily') {
        dailySettings.forEach(el => el.classList.remove('hidden'));
        intervalSettings.forEach(el => el.classList.add('hidden'));
        
        // Make time input required for daily jobs
        const timeInput = form.querySelector('#job-time');
        if (timeInput) timeInput.required = true;
        
        const intervalInput = form.querySelector('#job-interval');
        if (intervalInput) intervalInput.required = false;
    } else {
        dailySettings.forEach(el => el.classList.add('hidden'));
        intervalSettings.forEach(el => el.classList.remove('hidden'));
        
        // Make interval input required for interval jobs
        const timeInput = form.querySelector('#job-time');
        if (timeInput) timeInput.required = false;
        
        const intervalInput = form.querySelector('#job-interval');
        if (intervalInput) intervalInput.required = true;
    }
}

function updateSymbolSelectionUI(isEmergencyModal = false) {
    const form = isEmergencyModal ? document.getElementById('emergency-form') : document;
    
    if (!form) return;
    
    const selection = form.querySelector('input[name="symbol_selection"]:checked')?.value;
    if (!selection) return;
    
    const customSymbols = form.querySelectorAll('.custom-symbols');
    
    if (selection === 'custom') {
        customSymbols.forEach(el => el.classList.remove('hidden'));
    } else {
        customSymbols.forEach(el => el.classList.add('hidden'));
    }
}

// Handle submission from the emergency form
function handleEmergencyFormSubmit() {
    console.log("Emergency form submit handler");
    const emergencyForm = document.getElementById('emergency-form');
    if (!emergencyForm) return;
    
    // Validate form manually
    const jobType = emergencyForm.querySelector('input[name="job_type"]:checked')?.value;
    
    if (jobType === 'daily') {
        const timeInput = emergencyForm.querySelector('#job-time');
        if (!timeInput || !timeInput.value) {
            showToast('Time is required for daily jobs', 'error');
            return;
        }
    } else if (jobType === 'interval') {
        const intervalInput = emergencyForm.querySelector('#job-interval');
        if (!intervalInput || !intervalInput.value) {
            showToast('Interval is required for interval jobs', 'error');
            return;
        }
    }
    
    // Create a synthetic event and pass it to handleAddJob
    const event = { preventDefault: () => {} };
    handleAddJob(event, true);
}

async function handleAddJob(e, isEmergencyModal = false) {
    e.preventDefault();
    
    const form = isEmergencyModal ? document.getElementById('emergency-form') : document;
    if (!form) return;
    
    const jobType = form.querySelector('input[name="job_type"]:checked')?.value;
    const symbolSelection = form.querySelector('input[name="symbol_selection"]:checked')?.value;
    const dataIntervalEl = form.querySelector('#data-interval');
    
    if (!jobType || !symbolSelection || !dataIntervalEl) {
        console.error('Required form elements not found');
        showToast('Form error: missing elements', 'error');
        return;
    }
    
    const jobData = {
        type: jobType,
        interval: dataIntervalEl.value
    };
    
    if (jobType === 'daily') {
        const jobTimeEl = form.querySelector('#job-time');
        if (jobTimeEl && jobTimeEl.value) {
            jobData.time = jobTimeEl.value;
        } else {
            showToast('Time is required for daily jobs', 'error');
            return;
        }
    } else {
        const jobIntervalEl = form.querySelector('#job-interval');
        if (jobIntervalEl && jobIntervalEl.value) {
            jobData.minutes = parseInt(jobIntervalEl.value);
        } else {
            showToast('Interval value is required', 'error');
            return;
        }
    }
    
    if (symbolSelection === 'custom') {
        const symbolsListEl = form.querySelector('#symbols-list');
        if (symbolsListEl) {
            const symbolsText = symbolsListEl.value.trim();
            if (symbolsText) {
                const symbols = symbolsText.split(',').map(s => s.trim());
                jobData.symbols = symbols.map(symbol => ({ symbol: symbol, exchange: 'NSE' }));
                jobData.exchanges = symbols.map(() => 'NSE');
            }
        }
    }
    
    const jobNameEl = form.querySelector('#job-name');
    if (jobNameEl) {
        const jobName = jobNameEl.value.trim();
        if (jobName) {
            jobData.job_id = jobName.toLowerCase().replace(/\s+/g, '_');
        }
    }
    
    try {
        console.log('Submitting job data:', jobData);
        const response = await fetch('/api/scheduler/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jobData)
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('Job creation result:', result);
            showToast('Job created successfully', 'success');
            closeAddJobModal();
            loadScheduledJobs();
        } else {
            const error = await response.json();
            console.error('Job creation error:', error);
            showToast(error.error || 'Failed to create job', 'error');
        }
    } catch (error) {
        console.error('Error creating job:', error);
        showToast('Failed to create job', 'error');
    }
}

async function addPresetJob(preset) {
    const jobData = {
        type: preset,
        interval: 'D'
    };
    
    try {
        console.log('Adding preset job:', preset, jobData);
        const response = await fetch('/api/scheduler/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jobData)
        });
        
        console.log('Preset job response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('Preset job result:', result);
            showToast('Preset job added successfully', 'success');
            loadScheduledJobs();
        } else {
            const error = await response.json();
            console.error('Preset job error:', error);
            showToast(error.error || 'Failed to add preset job', 'error');
        }
    } catch (error) {
        console.error('Error adding preset job:', error);
        showToast('Failed to add preset job', 'error');
    }
}

async function runJobNow(jobId) {
    try {
        const response = await fetch(`/api/scheduler/jobs/${jobId}/run`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showToast('Job started successfully', 'success');
        } else {
            showToast('Failed to run job', 'error');
        }
    } catch (error) {
        console.error('Error running job:', error);
        showToast('Failed to run job', 'error');
    }
}

async function pauseJob(jobId) {
    try {
        const response = await fetch(`/api/scheduler/jobs/${jobId}/pause`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showToast('Job paused', 'success');
            loadScheduledJobs();
        } else {
            showToast('Failed to pause job', 'error');
        }
    } catch (error) {
        console.error('Error pausing job:', error);
        showToast('Failed to pause job', 'error');
    }
}

async function resumeJob(jobId) {
    try {
        const response = await fetch(`/api/scheduler/jobs/${jobId}/resume`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showToast('Job resumed', 'success');
            loadScheduledJobs();
        } else {
            showToast('Failed to resume job', 'error');
        }
    } catch (error) {
        console.error('Error resuming job:', error);
        showToast('Failed to resume job', 'error');
    }
}

async function deleteJob(jobId) {
    if (!confirm('Are you sure you want to delete this job?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/scheduler/jobs/${jobId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('Job deleted', 'success');
            loadScheduledJobs();
        } else {
            showToast('Failed to delete job', 'error');
        }
    } catch (error) {
        console.error('Error deleting job:', error);
        showToast('Failed to delete job', 'error');
    }
}

async function testScheduler() {
    try {
        const response = await fetch('/api/scheduler/test', {
            method: 'POST'
        });
        
        if (response.ok) {
            const result = await response.json();
            showToast(result.message, 'success');
            loadScheduledJobs();
        } else {
            showToast('Failed to create test job', 'error');
        }
    } catch (error) {
        console.error('Error testing scheduler:', error);
        showToast('Failed to create test job', 'error');
    }
}

// Utility functions
function formatDateTime(dateTimeStr) {
    const date = new Date(dateTimeStr);
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    return date.toLocaleString('en-IN', options);
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type]} text-${type}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}