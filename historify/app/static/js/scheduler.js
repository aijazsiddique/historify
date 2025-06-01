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
    const modal = document.getElementById('add-job-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.querySelector('.modal-backdrop').classList.add('show');
        modal.querySelector('.modal-content').classList.add('show');
    }, 10);
}

function closeAddJobModal() {
    const modal = document.getElementById('add-job-modal');
    modal.querySelector('.modal-backdrop').classList.remove('show');
    modal.querySelector('.modal-content').classList.remove('show');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('add-job-form').reset();
    }, 300);
}

function updateJobTypeUI() {
    const jobType = document.querySelector('input[name="job_type"]:checked').value;
    const dailySettings = document.getElementById('daily-settings');
    const intervalSettings = document.getElementById('interval-settings');
    
    if (jobType === 'daily') {
        dailySettings.classList.remove('hidden');
        intervalSettings.classList.add('hidden');
        document.getElementById('job-time').required = true;
        document.getElementById('job-interval').required = false;
    } else {
        dailySettings.classList.add('hidden');
        intervalSettings.classList.remove('hidden');
        document.getElementById('job-time').required = false;
        document.getElementById('job-interval').required = true;
    }
}

function updateSymbolSelectionUI() {
    const selection = document.querySelector('input[name="symbol_selection"]:checked').value;
    const customSymbols = document.getElementById('custom-symbols');
    
    if (selection === 'custom') {
        customSymbols.classList.remove('hidden');
    } else {
        customSymbols.classList.add('hidden');
    }
}

async function handleAddJob(e) {
    e.preventDefault();
    
    const jobType = document.querySelector('input[name="job_type"]:checked').value;
    const symbolSelection = document.querySelector('input[name="symbol_selection"]:checked').value;
    
    const jobData = {
        type: jobType,
        interval: document.getElementById('data-interval').value
    };
    
    if (jobType === 'daily') {
        jobData.time = document.getElementById('job-time').value;
    } else {
        jobData.minutes = parseInt(document.getElementById('job-interval').value);
    }
    
    if (symbolSelection === 'custom') {
        const symbolsText = document.getElementById('symbols-list').value.trim();
        if (symbolsText) {
            const symbols = symbolsText.split(',').map(s => s.trim());
            jobData.symbols = symbols.map(symbol => ({ symbol: symbol, exchange: 'NSE' }));
            jobData.exchanges = symbols.map(() => 'NSE');
        }
    }
    
    const jobName = document.getElementById('job-name').value.trim();
    if (jobName) {
        jobData.job_id = jobName.toLowerCase().replace(/\s+/g, '_');
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