// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('fileInput');
const uploadCard = document.getElementById('upload-card');
const progressContainer = document.getElementById('progress-container');
const resultContainer = document.getElementById('result-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const uploadStatus = document.getElementById('upload-status');
const resultCode = document.getElementById('resultCode');
const copyCodeBtn = document.getElementById('copy-code-btn');
const resetUploadBtn = document.getElementById('reset-upload-btn');
const cancelUploadBtn = document.getElementById('cancel-upload-btn');
const codeInput = document.getElementById('codeInput');
const downloadBtn = document.getElementById('download-btn');
const downloadStatusContainer = document.getElementById('download-status-container');
const downloadStatusText = document.getElementById('download-status-text');
const errorContainer = document.getElementById('error-container');
const errorText = document.getElementById('error-text');
const uploadingFileName = document.getElementById('uploading-file-name');
const expiryHoursText = document.getElementById('expiry-hours-text');
const copyTooltip = document.getElementById('copy-tooltip');

let uploadXhr = null;

// Helper: Format code display (add space in the middle)
function formatCodeDisplay(code) {
  if (!code || code.length < 6) return code;
  return code.slice(0, 3) + ' ' + code.slice(3, 6);
}

// Helper: Format code input (remove spaces)
function formatCodeInput(text) {
  return text.replace(/\s/g, '').replace(/[^\d]/g, '').slice(0, 6);
}

// Helper: Show element
function show(element) {
  element.style.display = element.classList.contains('status-container') || element.classList.contains('error-container') ? 'flex' : 'block';
}

// Helper: Hide element
function hide(element) {
  element.style.display = 'none';
}

// Upload functionality
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    uploadFile(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    uploadFile(e.target.files[0]);
  }
});

function uploadFile(file) {
  // Hide previous states
  hide(dropZone);
  hide(resultContainer);
  show(progressContainer);

  const formData = new FormData();
  formData.append('file', file);

  uploadingFileName.textContent = file.name;
  uploadStatus.textContent = 'Starting upload...';
  progressBar.style.width = '0%';
  progressText.textContent = '0%';

  uploadXhr = new XMLHttpRequest();

  // Track upload progress
  uploadXhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const percentComplete = Math.round((e.loaded / e.total) * 100);
      progressBar.style.width = percentComplete + '%';
      progressText.textContent = percentComplete + '%';
      uploadStatus.textContent = `Uploading... ${formatFileSize(e.loaded)} / ${formatFileSize(e.total)}`;
    }
  });

  uploadXhr.addEventListener('load', () => {
    if (uploadXhr.status === 200) {
      try {
        const response = JSON.parse(uploadXhr.responseText);
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        uploadStatus.textContent = 'Upload complete!';

        setTimeout(() => {
          hide(progressContainer);
          show(resultContainer);
          resultCode.textContent = formatCodeDisplay(response.code);
          expiryHoursText.textContent = response.expiresInHours;
          fileInput.value = '';
        }, 500);
      } catch (error) {
        showError('Failed to parse response from server');
        resetUpload();
      }
    } else {
      try {
        const error = JSON.parse(uploadXhr.responseText);
        showError(error.error || 'Upload failed');
      } catch {
        showError('Upload failed with status ' + uploadXhr.status);
      }
      resetUpload();
    }
  });

  uploadXhr.addEventListener('error', () => {
    showError('Network error during upload');
    resetUpload();
  });

  uploadXhr.addEventListener('abort', () => {
    showError('Upload cancelled');
    resetUpload();
  });

  uploadXhr.open('POST', '/api/upload');
  uploadXhr.send(formData);
}

// Cancel upload
cancelUploadBtn.addEventListener('click', () => {
  if (uploadXhr) {
    uploadXhr.abort();
  }
});

// Reset upload UI
function resetUpload() {
  hide(progressContainer);
  show(dropZone);
  uploadXhr = null;
}

// Copy code to clipboard
copyCodeBtn.addEventListener('click', async () => {
  const code = resultCode.textContent.replace(/\s/g, '');
  try {
    await navigator.clipboard.writeText(code);
    copyTooltip.textContent = 'Copied!';
    copyCodeBtn.classList.add('copied');
    setTimeout(() => {
      copyTooltip.textContent = 'Copy code';
      copyCodeBtn.classList.remove('copied');
    }, 2000);
  } catch (err) {
    copyTooltip.textContent = 'Failed to copy';
  }
});

// Send another file
resetUploadBtn.addEventListener('click', () => {
  hide(resultContainer);
  show(dropZone);
  progressBar.style.width = '0%';
  progressText.textContent = '0%';
  uploadStatus.textContent = 'Preparing upload...';
});

// Download functionality
codeInput.addEventListener('input', (e) => {
  const formatted = formatCodeInput(e.target.value);
  if (formatted.length === 6) {
    codeInput.value = formatCodeDisplay(formatted);
  } else if (formatted.length < 6) {
    codeInput.value = formatted.length > 3 ? formatCodeDisplay(formatted) : formatted;
  }
});

codeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    downloadBtn.click();
  }
});

downloadBtn.addEventListener('click', () => {
  const code = formatCodeInput(codeInput.value);

  if (code.length !== 6) {
    errorText.textContent = 'Please enter a valid 6-digit code';
    show(errorContainer);
    hide(downloadStatusContainer);
    codeInput.classList.add('error');
    setTimeout(() => codeInput.classList.remove('error'), 500);
    return;
  }

  hide(errorContainer);
  show(downloadStatusContainer);
  downloadStatusText.textContent = 'Fetching file details...';

  fetch(`/api/download/${code}`)
    .then((response) => {
      if (response.ok) {
        // File exists, trigger download
        return response.blob().then((blob) => {
          const filename = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || `file_${code}`;
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = decodeURIComponent(filename);
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          hide(downloadStatusContainer);
          codeInput.value = '';
        });
      } else if (response.status === 404) {
        throw new Error('Invalid or expired code');
      } else if (response.status === 410) {
        throw new Error('This code has expired');
      } else {
        return response.json().then((data) => {
          throw new Error(data.error || 'Download failed');
        });
      }
    })
    .catch((error) => {
      hide(downloadStatusContainer);
      errorText.textContent = error.message || 'Failed to download file';
      show(errorContainer);
      codeInput.classList.add('error');
      setTimeout(() => codeInput.classList.remove('error'), 500);
    });
});

// Helper: Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Helper: Show error
function showError(message) {
  errorText.textContent = message;
  show(errorContainer);
}

// Auto-hide error after 5 seconds
const observer = new MutationObserver(() => {
  if (errorContainer.style.display !== 'none' && errorContainer.style.display !== '') {
    setTimeout(() => {
      hide(errorContainer);
    }, 5000);
  }
});

observer.observe(errorContainer, { attributes: true });

// Close error on input focus
codeInput.addEventListener('focus', () => {
  hide(errorContainer);
});
