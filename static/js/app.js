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
const messageInput = document.getElementById('message');
const liveResult = document.getElementById('live-result');

// Live detection state - always enabled but hidden
let liveDetectionEnabled = true;
let liveDetectionTimeout = null;
let isAnalyzing = false;

// Live detection with debouncing
messageInput.addEventListener('input', () => {
  if (!liveDetectionEnabled) return;
  
  // Clear previous timeout
  if (liveDetectionTimeout) {
    clearTimeout(liveDetectionTimeout);
  }
  
  const text = messageInput.value.trim();
  
  if (text.length === 0) {
    liveResult.classList.add('hidden');
    return;
  }
  
  // Show analyzing state
  liveResult.className = 'live-result analyzing';
  liveResult.textContent = 'Analyzing...';
  liveResult.classList.remove('hidden');
  
  // Debounce the analysis (wait 800ms after user stops typing)
  liveDetectionTimeout = setTimeout(() => {
    performLiveAnalysis(text);
  }, 800);
});

// Perform live analysis
async function performLiveAnalysis(text) {
  if (isAnalyzing) return;
  
  isAnalyzing = true;
  
  try {
    const data = await postJSON('/predict-text', { message: text });
    
    if (data.ok) {
      const isSpam = data.label === 'SPAM';
      const confidence = typeof data.proba === 'number' ? Math.round(data.proba * 100) : null;
      
      liveResult.className = `live-result ${isSpam ? 'spam' : 'clean'}`;
      liveResult.textContent = isSpam 
        ? `Spam${confidence ? ` (${confidence}%)` : ''}`
        : `Clean${confidence ? ` (${100 - confidence}%)` : ''}`;
      liveResult.classList.remove('hidden');
    } else {
      liveResult.className = 'live-result analyzing';
      liveResult.textContent = 'Error';
      liveResult.classList.remove('hidden');
    }
  } catch (err) {
    liveResult.className = 'live-result analyzing';
    liveResult.textContent = 'Error';
    liveResult.classList.remove('hidden');
  } finally {
    isAnalyzing = false;
  }
}

textForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
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

// Audio recording functionality
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let recordingTimer = null;
let audioContext = null;
let analyser = null;
let microphone = null;
let animationId = null;

const startRecordingBtn = document.getElementById('start-recording');
const stopRecordingBtn = document.getElementById('stop-recording');
const recordingStatus = document.getElementById('recording-status');
const recordingVisualizer = document.getElementById('recording-visualizer');
const recordingTimerDisplay = document.getElementById('recording-timer');
const recordedAudioSection = document.getElementById('recorded-audio');
const recordedPlayer = document.getElementById('recorded-player');
const recordedDuration = document.getElementById('recorded-duration');
const analyzeRecordedBtn = document.getElementById('analyze-recorded');
const waveformCanvas = document.getElementById('waveform-canvas');
const canvasCtx = waveformCanvas.getContext('2d');

// Start recording
startRecordingBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      } 
    });
    
    // Setup MediaRecorder
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };
    
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);
      recordedPlayer.src = audioUrl;
      
      // Show recorded audio section
      recordedAudioSection.classList.remove('hidden');
      
      // Store blob for analysis
      recordedPlayer.audioBlob = audioBlob;
      
      // Calculate duration
      recordedPlayer.addEventListener('loadedmetadata', () => {
        const duration = recordedPlayer.duration;
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        recordedDuration.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      });
      
      // Cleanup
      stream.getTracks().forEach(track => track.stop());
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
    };
    
    // Setup audio visualization
    setupAudioVisualization(stream);
    
    // Start recording
    mediaRecorder.start();
    recordingStartTime = Date.now();
    
    // Update UI
    startRecordingBtn.classList.add('hidden');
    stopRecordingBtn.classList.remove('hidden');
    startRecordingBtn.classList.add('recording');
    recordingStatus.textContent = 'Recording...';
    recordingStatus.classList.add('active');
    recordingVisualizer.classList.remove('hidden');
    recordedAudioSection.classList.add('hidden');
    
    // Start timer
    updateRecordingTimer();
    recordingTimer = setInterval(updateRecordingTimer, 1000);
    
  } catch (err) {
    console.error('Error accessing microphone:', err);
    recordingStatus.textContent = 'Microphone access denied';
    recordingStatus.classList.add('active');
  }
});

// Stop recording
stopRecordingBtn.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  
  // Update UI
  startRecordingBtn.classList.remove('hidden', 'recording');
  stopRecordingBtn.classList.add('hidden');
  recordingStatus.textContent = '';
  recordingStatus.classList.remove('active');
  recordingVisualizer.classList.add('hidden');
  
  // Stop timer and animation
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
});

// Setup audio visualization
function setupAudioVisualization(stream) {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  microphone = audioContext.createMediaStreamSource(stream);
  
  analyser.fftSize = 256;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  microphone.connect(analyser);
  
  function draw() {
    animationId = requestAnimationFrame(draw);
    
    analyser.getByteFrequencyData(dataArray);
    
    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    
    const barWidth = (waveformCanvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * waveformCanvas.height * 0.8;
      
      const gradient = canvasCtx.createLinearGradient(0, waveformCanvas.height - barHeight, 0, waveformCanvas.height);
      gradient.addColorStop(0, '#2563eb');
      gradient.addColorStop(1, '#1d4ed8');
      
      canvasCtx.fillStyle = gradient;
      canvasCtx.fillRect(x, waveformCanvas.height - barHeight, barWidth, barHeight);
      
      x += barWidth + 1;
    }
  }
  
  draw();
}

// Update recording timer
function updateRecordingTimer() {
  if (recordingStartTime) {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    recordingTimerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

// Analyze recorded audio
analyzeRecordedBtn.addEventListener('click', async () => {
  const audioBlob = recordedPlayer.audioBlob;
  if (!audioBlob) {
    setResult(audioResult, 'err', 'No recorded audio to analyze.');
    return;
  }
  
  toggleLoader(analyzeRecordedBtn, true);
  updateStatusIndicator('processing');
  recordingStatus.textContent = 'Transcribing and analyzing recorded audio...';
  recordingStatus.classList.add('active');
  audioResult.classList.add('hidden');
  transcriptBox.classList.add('hidden');

  const formData = new FormData();
  formData.append('audio', audioBlob, 'recorded-audio.webm');

  try {
    const res = await fetch('/predict-audio', { method: 'POST', body: formData });
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
    toggleLoader(analyzeRecordedBtn, false);
    updateStatusIndicator('ready');
    recordingStatus.textContent = '';
    recordingStatus.classList.remove('active');
  }
});
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
