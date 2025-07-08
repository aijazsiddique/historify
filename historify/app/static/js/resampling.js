// app/static/js/resampling.js

const ResamplingManager = {
  isResampling: false,
  progress: 0,
  lastRequest: null,
  taskId: null,
  pollIntervalId: null,
  
  startResampling(requestDetails, taskId, pollIntervalId) {
    this.isResampling = true;
    this.progress = 0;
    this.lastRequest = requestDetails;
    this.taskId = taskId;
    this.pollIntervalId = pollIntervalId;
    // Trigger UI updates to show loading state
    console.log('Resampling started:', requestDetails);
    document.dispatchEvent(new CustomEvent('resampling:start', { detail: requestDetails }));
  },

  updateProgress(progress) {
    this.progress = progress;
    // Trigger UI updates for progress bar
    console.log('Resampling progress:', progress);
    document.dispatchEvent(new CustomEvent('resampling:progress', { detail: { progress } }));
  },

  finishResampling(result) {
    this.isResampling = false;
    this.progress = 100;
    // Trigger UI updates to show final result
    console.log('Resampling finished:', result);
    document.dispatchEvent(new CustomEvent('resampling:finish', { detail: result }));
  },

  async cancelResampling() {
    if (!this.isResampling || !this.taskId) return;

    this.isResampling = false;
    this.progress = 0;
    
    // Stop polling
    if (this.pollIntervalId) {
        clearInterval(this.pollIntervalId);
    }

    try {
        // Notify backend to cancel the task
        await fetch(`/api/resample/cancel/${this.taskId}`, { method: 'POST' });
        console.log(`Cancellation request sent for task ${this.taskId}`);
    } catch (error) {
        console.error('Error sending cancellation request:', error);
    }

    this.taskId = null;
    this.pollIntervalId = null;

    document.dispatchEvent(new CustomEvent('resampling:cancel'));
  },

  handleError(error) {
    this.isResampling = false;
    // Trigger UI updates to show error message
    console.error('Resampling error:', error);
    document.dispatchEvent(new CustomEvent('resampling:error', { detail: error }));
  },

  getState() {
    return {
      isResampling: this.isResampling,
      progress: this.progress,
      lastRequest: this.lastRequest,
    };
  }
};

// Make it globally accessible or export it if using modules
window.ResamplingManager = ResamplingManager;
