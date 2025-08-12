async function postJSON(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

function setStatus(el, text) {
  el.textContent = text || '';
}

function setResult(el, type, text) {
  el.classList.remove('hidden', 'ok', 'warn', 'err');
  el.classList.add(type);
  el.textContent = text;
}

function toggleLoader(btn, show) {
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  
  if (show) {
    text.classList.add('hidden');
    loader.classList.remove('hidden');
    btn.disabled = true;
  } else {
    text.classList.remove('hidden');
    loader.classList.add('hidden');
    btn.disabled = false;
  }
}

function updateStatusIndicator(status) {
  const dot = document.querySelector('.status-dot');
  const text = document.querySelector('.status-text');
  
  if (status === 'processing') {
    dot.style.background = 'var(--warning)';
    dot.style.boxShadow = '0 0 8px rgba(217, 119, 6, 0.4)';
    text.textContent = 'Processing';
  } else {
    dot.style.background = 'var(--success)';
    dot.style.boxShadow = '0 0 8px rgba(5, 150, 105, 0.4)';
    text.textContent = 'Ready';
  }
}

// Text form
const textForm = document.getElementById('text-form');
const textStatus = document.getElementById('text-status');
const textResult = document.getElementById('text-result');
const textBtn = textForm.querySelector('.btn');

textForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = document.getElementById('message').value.trim();
  if (!message) {
    setResult(textResult, 'err', 'Please enter a message to analyze.');
    return;
  }
  
  toggleLoader(textBtn, true);
  updateStatusIndicator('processing');
  setStatus(textStatus, 'Analyzing message...');
  textResult.classList.add('hidden');
  
  try {
    const data = await postJSON('/predict-text', { message });
    if (!data.ok) throw new Error(data.error || 'Analysis failed');
    
    const label = data.label;
    const scorePart = (typeof data.proba === 'number') ? ` (${(data.proba * 100).toFixed(1)}% confidence)` : '';
    const resultText = label === 'SPAM' ? `Spam Detected${scorePart}` : `Clean Message${scorePart}`;
    
    setResult(textResult, label === 'SPAM' ? 'err' : 'ok', resultText);
  } catch (err) {
    setResult(textResult, 'err', `Error: ${err.message}`);
  } finally {
    toggleLoader(textBtn, false);
    updateStatusIndicator('ready');
    setStatus(textStatus, '');
  }
});

// Audio form
const audioForm = document.getElementById('audio-form');
const audioInput = document.getElementById('audio');
const audioStatus = document.getElementById('audio-status');
const audioResult = document.getElementById('audio-result');
const transcriptBox = document.getElementById('transcript-box');
const transcript = document.getElementById('transcript');
const audioBtn = audioForm.querySelector('.btn');

// Enhanced file input feedback with audio preview
audioInput.addEventListener('change', function() {
  const wrapper = this.closest('.file-input-wrapper');
  const overlay = wrapper.querySelector('.file-input-text');
  const preview = document.getElementById('audio-preview');
  const audioElement = preview.querySelector('audio');
  const audioName = preview.querySelector('.audio-name');
  const audioSize = preview.querySelector('.audio-size');
  
  if (this.files && this.files[0]) {
    const file = this.files[0];
    const fileName = file.name;
    const fileSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    
    // Update file input display
    overlay.textContent = `Selected: ${fileName}`;
    wrapper.classList.add('file-selected');
    
    // Show audio preview
    const url = URL.createObjectURL(file);
    audioElement.src = url;
    audioName.textContent = fileName;
    audioSize.textContent = fileSize;
    preview.classList.remove('hidden');
    
    // Clean up URL when audio loads
    audioElement.addEventListener('loadedmetadata', () => {
      const duration = Math.round(audioElement.duration);
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      audioSize.textContent = `${fileSize} • ${minutes}:${seconds.toString().padStart(2, '0')}`;
    });
    
    // Clean up URL when component unmounts or file changes
    audioElement.addEventListener('error', () => {
      URL.revokeObjectURL(url);
    });
  } else {
    overlay.textContent = 'Choose file or drag here';
    wrapper.classList.remove('file-selected');
    preview.classList.add('hidden');
    
    // Clean up previous URL
    if (audioElement.src) {
      URL.revokeObjectURL(audioElement.src);
      audioElement.src = '';
    }
  }
});

audioForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = audioInput.files && audioInput.files[0];
  if (!f) {
    setResult(audioResult, 'err', 'Please select an audio file to analyze.');
    return;
  }
  
  toggleLoader(audioBtn, true);
  updateStatusIndicator('processing');
  setStatus(audioStatus, 'Transcribing and analyzing audio... This may take 10-30 seconds.');
  audioResult.classList.add('hidden');
  transcriptBox.classList.add('hidden');

  const form = new FormData();
  form.append('audio', f);

  try {
    const res = await fetch('/predict-audio', { method: 'POST', body: form });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Analysis failed');
    
    const label = data.label;
    const scorePart = (typeof data.proba === 'number') ? ` (${(data.proba * 100).toFixed(1)}% confidence)` : '';
    const resultText = label === 'SPAM' ? `Spam Content Detected${scorePart}` : `Clean Content${scorePart}`;
    
    setResult(audioResult, label === 'SPAM' ? 'err' : 'ok', resultText);

    if (data.transcript) {
      transcript.textContent = data.transcript;
      transcriptBox.classList.remove('hidden');
    }
  } catch (err) {
    setResult(audioResult, 'err', `Error: ${err.message}`);
  } finally {
    toggleLoader(audioBtn, false);
    updateStatusIndicator('ready');
    setStatus(audioStatus, '');
  }
});

// Initialize status
updateStatusIndicator('ready');
