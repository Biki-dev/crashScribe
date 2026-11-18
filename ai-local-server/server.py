"""Local CrashScribe model adapter.

This server performs real inference only. It never returns placeholder text.
Install the model artifacts into MODEL_DIRS before starting it.
"""

import os
import subprocess
import tempfile
from pathlib import Path

import torch
import torchaudio
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoModel, AutoModelForSeq2SeqLM, AutoProcessor, AutoTokenizer, WhisperForConditionalGeneration, WhisperProcessor

MODEL_ROOT = Path(os.getenv("CRASHSCRIBE_MODEL_DIR", "./models")).resolve()
INDIC_CONFORMER = os.getenv("INDIC_CONFORMER_MODEL", "ai4bharat/indic-conformer-600m-multilingual")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "openai/whisper-tiny.en")
INDICTRANS_MODEL = os.getenv("INDICTRANS_MODEL", "ai4bharat/indictrans2-indic-en-dist-200M")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

app = FastAPI(title="CrashScribe Local AI Adapter")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CRASHSCRIBE_ALLOWED_ORIGIN", "http://localhost:3000").split(","),
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

_asr_model = None
_asr_processor = None
_whisper_model = None
_whisper_processor = None
_translation_model = None
_translation_tokenizer = None
_translation_processor = None


class TranslationRequest(BaseModel):
    text: str
    sourceLanguage: str
    targetLanguage: str = "eng_Latn"


def model_path_or_id(model_id: str) -> str:
    """Use a pasted local directory when present, otherwise a Hub ID for first download."""
    candidate = MODEL_ROOT / model_id.replace("/", "--")
    return str(candidate) if candidate.exists() else model_id


def convert_to_wav(audio_path: str) -> str:
    wav_path = f"{audio_path}.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-i", audio_path, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav_path],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    return wav_path


def get_indic_model():
    global _asr_model, _asr_processor
    if _asr_model is None:
        source = model_path_or_id(INDIC_CONFORMER)
        _asr_model = AutoModel.from_pretrained(source, trust_remote_code=True).to(DEVICE).eval()
        _asr_processor = AutoProcessor.from_pretrained(source, trust_remote_code=True)
    return _asr_model, _asr_processor


def get_whisper_model():
    global _whisper_model, _whisper_processor
    if _whisper_model is None:
        source = model_path_or_id(WHISPER_MODEL)
        _whisper_processor = WhisperProcessor.from_pretrained(source)
        _whisper_model = WhisperForConditionalGeneration.from_pretrained(source).to(DEVICE).eval()
    return _whisper_model, _whisper_processor


def get_translation_model():
    global _translation_model, _translation_tokenizer, _translation_processor
    if _translation_model is None:
        source = model_path_or_id(INDICTRANS_MODEL)
        _translation_tokenizer = AutoTokenizer.from_pretrained(source, trust_remote_code=True)
        _translation_model = AutoModelForSeq2SeqLM.from_pretrained(source, trust_remote_code=True).to(DEVICE).eval()
        from IndicTransToolkit.processor import IndicProcessor
        _translation_processor = IndicProcessor(inference=True)
    return _translation_model, _translation_tokenizer, _translation_processor


def load_audio(path: str):
    waveform, sample_rate = torchaudio.load(path)
    waveform = waveform.mean(dim=0, keepdim=True)
    if sample_rate != 16000:
        waveform = torchaudio.transforms.Resample(sample_rate, 16000)(waveform)
    return waveform


@app.get("/health")
def health():
    return {"status": "UP", "device": DEVICE, "model_dir": str(MODEL_ROOT)}


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...), language: str = Form("en"), model: str = Form("")):
    if language not in {"as", "bn", "brx", "en"}:
        raise HTTPException(status_code=400, detail="language must be as, bn, brx, or en")
    with tempfile.TemporaryDirectory() as tmp:
        source = Path(tmp) / (audio.filename or "recording.webm")
        source.write_bytes(await audio.read())
        try:
            wav_path = convert_to_wav(str(source))
            waveform = load_audio(wav_path)
            with torch.inference_mode():
                if language == "en":
                    whisper, processor = get_whisper_model()
                    inputs = processor(waveform.squeeze(0).numpy(), sampling_rate=16000, return_tensors="pt")
                    predicted = whisper.generate(inputs.input_features.to(DEVICE))
                    text = processor.batch_decode(predicted, skip_special_tokens=True)[0].strip()
                else:
                    indic, _processor = get_indic_model()
                    text = indic(waveform, language, "ctc").strip()
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"ASR inference failed: {exc}") from exc
    if not text:
        raise HTTPException(status_code=422, detail="Model returned no transcript")
    return {"text": text, "language": language}


@app.post("/translate")
def translate(request: TranslationRequest):
    if request.sourceLanguage not in {"asm_Beng", "ben_Beng", "brx_Deva"} or request.targetLanguage != "eng_Latn":
        raise HTTPException(status_code=400, detail="Unsupported IndicTrans2 language mapping")
    try:
        model, tokenizer, processor = get_translation_model()
        batch = processor.preprocess_batch([request.text], src_lang=request.sourceLanguage, tgt_lang=request.targetLanguage)
        inputs = tokenizer(batch, truncation=True, padding="longest", return_tensors="pt", return_attention_mask=True).to(DEVICE)
        with torch.inference_mode():
            generated = model.generate(**inputs, use_cache=True, min_length=0, max_length=256, num_beams=5)
        decoded = tokenizer.batch_decode(generated, skip_special_tokens=True, clean_up_tokenization_spaces=True)
        text = processor.postprocess_batch(decoded, lang=request.targetLanguage)[0].strip()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Translation inference failed: {exc}") from exc
    if not text:
        raise HTTPException(status_code=422, detail="Model returned no translation")
    return {"text": text, "sourceLanguage": request.sourceLanguage, "targetLanguage": request.targetLanguage}
