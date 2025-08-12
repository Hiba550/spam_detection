import os
import pickle
from datetime import datetime
from tempfile import NamedTemporaryFile

from flask import Flask, render_template, request, jsonify

from text_cleaner import TextCleaner  # noqa: F401 (used by the pipeline)


ALLOWED_AUDIO_EXT = {'.wav', '.mp3', '.m4a', '.ogg', '.flac', '.webm'}
LFS_MAGIC = b'version https://git-lfs.github.com/spec/v1'


def _load_pipeline(model_path: str):
    try:
        with open(model_path, 'rb') as f:
            head = f.read(64)
        if head.startswith(LFS_MAGIC):
            raise RuntimeError(
                'Model file looks like a Git LFS pointer. Please fetch the real binary model file.'
            )
    except FileNotFoundError:
        pass
    # Try normal pickle
    try:
        with open(model_path, 'rb') as f:
            return pickle.load(f)
    except Exception:
        pass
    # Try joblib (some exports use joblib even with .pkl extension)
    try:
        import joblib  # type: ignore

        return joblib.load(model_path)
    except Exception as e:
        raise RuntimeError(f"Failed to load model at {model_path}: {e}")


def create_app():
    app = Flask(__name__)
    # 25 MB upload cap to avoid huge files
    app.config['MAX_CONTENT_LENGTH'] = 25 * 1024 * 1024

    # Load model once at startup
    model_path = os.path.join(os.path.dirname(__file__), 'model', 'spam_model.pkl')
    pipeline = _load_pipeline(model_path)

    # Optional: lazy import heavy libs only when needed
    def transcribe_audio(file_path: str) -> str:
        """
        Transcribe audio to text using available backends.
        - Primary: OpenAI Whisper via faster-whisper (no API), if installed
        - Fallback: SpeechRecognition + Sphinx (offline) if installed
        - Last resort: raise a clear error
        """
        # Try faster-whisper
        try:
            from faster_whisper import WhisperModel  # type: ignore

            model = WhisperModel('base', device='cpu')
            segments, info = model.transcribe(file_path, beam_size=5)
            text = ' '.join([seg.text for seg in segments]).strip()
            if text:
                return text
        except Exception:
            pass

        # Try SpeechRecognition + Sphinx (offline)
        try:
            import speech_recognition as sr  # type: ignore

            r = sr.Recognizer()
            with sr.AudioFile(file_path) as source:
                audio = r.record(source)
            try:
                text = r.recognize_sphinx(audio)
                return text
            except Exception:
                pass
        except Exception:
            pass

        raise RuntimeError(
            'No audio transcription backend available. Install faster-whisper or speechrecognition+pocketsphinx.'
        )

    @app.route('/')
    def home():
        return render_template('index.html')

    @app.route('/health')
    def health():
        audio_backend = 'none'
        try:
            from faster_whisper import WhisperModel  # type: ignore
            audio_backend = 'faster-whisper'
        except Exception:
            try:
                import speech_recognition  # type: ignore
                audio_backend = 'sphinx-possible'
            except Exception:
                pass

        return jsonify({'ok': True, 'model': 'ready', 'audio': audio_backend})

    @app.route('/predict-text', methods=['POST'])
    def predict_text():
        data = request.form if request.form else request.get_json(silent=True) or {}
        text = (data.get('message') or '').strip()
        if not text:
            return jsonify({'ok': False, 'error': 'Empty message'}), 400
        pred = int(pipeline.predict([text])[0])
        proba = None
        try:
            proba = float(pipeline.predict_proba([text])[0][1])
        except Exception:
            pass
        return jsonify({'ok': True, 'label': 'SPAM' if pred == 1 else 'NOT_SPAM', 'pred': pred, 'proba': proba})

    @app.route('/predict-audio', methods=['POST'])
    def predict_audio():
        if 'audio' not in request.files:
            return jsonify({'ok': False, 'error': 'No audio file uploaded (field name: audio).'}), 400
        file = request.files['audio']
        if file.filename == '':
            return jsonify({'ok': False, 'error': 'Empty filename.'}), 400

        # Persist to a temp file with the same extension
        suffix = os.path.splitext(file.filename)[1].lower() or '.wav'
        if suffix not in ALLOWED_AUDIO_EXT:
            return jsonify({'ok': False, 'error': f'Unsupported audio type {suffix}. Allowed: {sorted(ALLOWED_AUDIO_EXT)}'}), 415
        with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        try:
            text = transcribe_audio(tmp_path)
        except Exception as e:
            os.unlink(tmp_path)
            return jsonify({'ok': False, 'error': str(e)}), 500

        os.unlink(tmp_path)
        if not text.strip():
            return jsonify({'ok': False, 'error': 'Transcription was empty.'}), 422

        pred = int(pipeline.predict([text])[0])
        proba = None
        try:
            proba = float(pipeline.predict_proba([text])[0][1])
        except Exception:
            pass

        return jsonify({
            'ok': True,
            'transcript': text,
            'label': 'SPAM' if pred == 1 else 'NOT_SPAM',
            'pred': pred,
            'proba': proba,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
        })

    return app


app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
