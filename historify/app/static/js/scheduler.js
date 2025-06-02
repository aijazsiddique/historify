/**
 * Scheduler Manager functionality
 */

let scheduledJobs = [];

// Initialize
let autoRefreshInterval = null;
let nextRunUpdateInterval = null;

document.addEventListener('DOMContentLoaded', function() {
    loadScheduledJobs();
    
    // Set up form submission
    document.getElementById('add-job-form').addEventListener('submit', handleAddJob);
    
    // Set up dynamic auto-refresh
    setupAutoRefresh();
    
    // Update next run times every second for real-time display
    startNextRunUpdater();
});

async function loadScheduledJobs() {
    try {
        // Loading scheduled jobs
        const response = await fetch('/api/scheduler/jobs');
        // Processed response
        
        if (response.ok) {
            scheduledJobs = await response.json();
            // Jobs loaded
            displayScheduledJobs();
            // Update auto-refresh based on job intervals
            setupAutoRefresh();
        } else {
            const errorText = await response.text();
            // Failed to load jobs
            showToast('Failed to load scheduled jobs', 'error');
        }
    } catch (error) {
        showToast('Error loading scheduled jobs', 'error');
    }
}

function setupAutoRefresh() {
    // Clear existing interval
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // Find the shortest interval among active jobs
    let shortestInterval = 30000; // Default to 30 seconds
    
    scheduledJobs.forEach(job => {
        if (!job.paused && job.type === 'interval' && job.minutes) {
            // Convert minutes to milliseconds, but cap at minimum 10 seconds for performance
            const intervalMs = Math.max(job.minutes * 60 * 1000 / 2, 10000);
            shortestInterval = Math.min(shortestInterval, intervalMs);
        }
    });
    
    // For 1-minute jobs, refresh every 10 seconds to ensure accurate next run display
    if (scheduledJobs.some(job => !job.paused && job.type === 'interval' && job.minutes === 1)) {
        shortestInterval = 10000; // 10 seconds
    }
    
    // Set up the new interval
    autoRefreshInterval = setInterval(loadScheduledJobs, shortestInterval);
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
        jobElement.setAttribute('data-job-id', job.id);
        jobElement.setAttribute('data-job-type', job.type);
        jobElement.setAttribute('data-job-minutes', job.minutes || '');
        jobElement.setAttribute('data-job-time', job.time || '');
        jobElement.setAttribute('data-job-paused', job.paused ? 'true' : 'false');
        jobElement.setAttribute('data-next-run', job.next_run || '');
        
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
                    ${job.next_run && !job.paused ? `
                        <p class="text-xs text-gray-500 dark:text-gray-500 mt-1 next-run-time">
                            Next run: <span class="next-run-value">${formatDateTime(job.next_run)}</span>
                        </p>
                    ` : ''}
                </div>
            </div>
            <div class="flex items-center gap-3">
                <span class="px-3 py-1 text-sm font-medium rounded-full ${job.paused ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}">
                    ${job.paused ? 'Paused' : 'Active'}
                </span>
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
    
    // Restart the next run updater after displaying jobs
    startNextRunUpdater();
}

function showAddJobModal() {
    // Show modal
    
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
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full shadow-xl">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Add Scheduled Job</h3>
                    <button onclick="closeAddJobModal()" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div id="emergency-form-container"></div>
                <div class="flex justify-end gap-3 mt-6">
                    <button type="button" onclick="closeAddJobModal()" class="btn-modern btn-secondary">Cancel</button>
                    <button type="button" onclick="handleEmergencyFormSubmit()" class="btn-modern btn-primary">
                        <i class="fas fa-plus mr-2"></i>
                        Create Job
                    </button>
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
    // Close modal
    
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


// Handle submission from the emergency form
function handleEmergencyFormSubmit() {
    // Handle emergency form submit
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
    const dataIntervalEl = form.querySelector('#data-interval');
    
    if (!jobType || !dataIntervalEl) {
        // Required form elements not found
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
    
    const jobNameEl = form.querySelector('#job-name');
    if (jobNameEl) {
        const jobName = jobNameEl.value.trim();
        if (jobName) {
            jobData.job_id = jobName.toLowerCase().replace(/\s+/g, '_');
        }
    }
    
    try {
        // Submitting job data
        const response = await fetch('/api/scheduler/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jobData)
        });
        
        // Processed response
        
        if (response.ok) {
            const result = await response.json();
            // Job created
            showToast('Job created successfully', 'success');
            closeAddJobModal();
            loadScheduledJobs();
        } else {
            const error = await response.json();
            // Job creation error
            showToast(error.error || 'Failed to create job', 'error');
        }
    } catch (error) {
        showToast('Failed to create job', 'error');
    }
}

async function addPresetJob(preset) {
    const jobData = {
        type: preset,
        interval: 'D'
    };
    
    try {
        // Adding preset job
        const response = await fetch('/api/scheduler/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jobData)
        });
        
        // Process preset job response
        
        if (response.ok) {
            const result = await response.json();
            // Preset job created
            showToast('Preset job added successfully', 'success');
            loadScheduledJobs();
        } else {
            const error = await response.json();
            // Preset job error
            showToast(error.error || 'Failed to add preset job', 'error');
        }
    } catch (error) {
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
        showToast('Failed to resume job', 'error');
    }
}

// Display confirm modal when deleting a job
async function deleteJob(jobId) {
    // Show the confirmation modal instead of using confirm()
    showDeleteConfirmModal(jobId);
    return;
}

// Show confirm delete modal
function showDeleteConfirmModal(jobId) {
    // Check if confirm modal already exists
    if (document.getElementById('confirm-delete-modal')) {
        document.getElementById('confirm-delete-modal').remove();
    }
    
    // Create a modal for delete confirmation
    const confirmModal = document.createElement('div');
    confirmModal.id = 'confirm-delete-modal';
    
    // Apply styles
    confirmModal.style.position = 'fixed';
    confirmModal.style.top = '0';
    confirmModal.style.left = '0';
    confirmModal.style.right = '0';
    confirmModal.style.bottom = '0';
    confirmModal.style.display = 'flex';
    confirmModal.style.alignItems = 'center';
    confirmModal.style.justifyContent = 'center';
    confirmModal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    confirmModal.style.zIndex = '99999';
    
    const modalHTML = `
        <div style="background-color: white; padding: 20px; border-radius: 8px; max-width: 400px; width: 100%; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
            <div style="margin-bottom: 15px;">
                <h3 style="margin: 0; font-size: 20px;">Confirm Delete</h3>
            </div>
            <p>Are you sure you want to delete this job? This action cannot be undone.</p>
            <div style="display: flex; justify-content: flex-end; margin-top: 20px; gap: 10px;">
                <button type="button" onclick="closeDeleteConfirmModal()" class="btn-modern btn-secondary">Cancel</button>
                <button type="button" onclick="confirmDeleteJob('${jobId}')" class="btn-modern btn-primary btn-error">Delete</button>
            </div>
        </div>
    `;
    
    confirmModal.innerHTML = modalHTML;
    document.body.appendChild(confirmModal);
}

// Close delete confirmation modal
function closeDeleteConfirmModal() {
    const confirmModal = document.getElementById('confirm-delete-modal');
    if (confirmModal) {
        confirmModal.remove();
    }
}

// Handle confirmed job deletion
async function confirmDeleteJob(jobId) {
    closeDeleteConfirmModal();
    
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
        // Error already handled by toast
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

// Start the next run time updater
function startNextRunUpdater() {
    if (nextRunUpdateInterval) {
        clearInterval(nextRunUpdateInterval);
    }
    
    // Update every second
    nextRunUpdateInterval = setInterval(updateNextRunTimes, 1000);
}

// Update all next run times on the page
function updateNextRunTimes() {
    const jobElements = document.querySelectorAll('[data-job-id]');
    
    jobElements.forEach(element => {
        const jobType = element.getAttribute('data-job-type');
        const isPaused = element.getAttribute('data-job-paused') === 'true';
        const nextRunElement = element.querySelector('.next-run-value');
        
        if (!nextRunElement || isPaused) return;
        
        if (jobType === 'interval') {
            const minutes = parseInt(element.getAttribute('data-job-minutes'));
            const lastRun = element.getAttribute('data-next-run');
            
            if (minutes && lastRun) {
                // Calculate next run based on current time
                const nextRun = calculateNextIntervalRun(lastRun, minutes);
                nextRunElement.textContent = formatDateTime(nextRun);
            }
        } else if (jobType === 'daily') {
            const time = element.getAttribute('data-job-time');
            const originalNextRun = element.getAttribute('data-next-run');
            
            if (time && originalNextRun) {
                // For daily jobs, the next run time doesn't change until it runs
                // Just update the relative time display if needed
                nextRunElement.textContent = formatDateTime(originalNextRun);
            }
        }
    });
}

// Calculate next run time for interval jobs
function calculateNextIntervalRun(lastRunStr, intervalMinutes) {
    const lastRun = new Date(lastRunStr);
    const now = new Date();
    
    // Calculate how many intervals have passed
    const timeDiff = now - lastRun;
    const intervalMs = intervalMinutes * 60 * 1000;
    const intervalsPassed = Math.floor(timeDiff / intervalMs);
    
    // Calculate next run time
    const nextRun = new Date(lastRun.getTime() + (intervalsPassed + 1) * intervalMs);
    
    return nextRun.toISOString();
}