"""Local CrashScribe model adapter.

This server performs real inference only. It never returns placeholder text.
Install the model artifacts into MODEL_DIRS before starting it.
"""

import os
import shutil
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


def prepare_indicconformer_local_code(source: str) -> None:
    """Repair the upstream custom loader when IndicConformer was pasted locally.

    Some released model_onnx.py files call snapshot_download() even when the
    argument is a local directory. That makes huggingface_hub validate the
    filesystem path as a repo ID. This idempotent repair keeps local setup
    offline and avoids asking users to edit files inside their model folder.
    """
    model_dir = Path(source)
    if not model_dir.is_dir():
        return
    loader = model_dir / "model_onnx.py"
    if not loader.exists():
        return

    text = loader.read_text()
    if "os.path.isdir(pretrained_model_name_or_path)" in text:
        return
    lines = text.splitlines()
    target = next((i for i, line in enumerate(lines) if "loc = snapshot_download" in line), None)
    if target is None:
        return
    end = target
    while end + 1 < len(lines) and "return cls(" not in lines[end + 1]:
        end += 1
    indent = lines[target][: len(lines[target]) - len(lines[target].lstrip())]
    replacement = [
        f"{indent}if os.path.isdir(pretrained_model_name_or_path):",
        f"{indent}    loc = pretrained_model_name_or_path",
        f"{indent}else:",
        f"{indent}    loc = snapshot_download(",
        f"{indent}        repo_id=pretrained_model_name_or_path,",
        f"{indent}        token=token,",
        f"{indent}    )",
    ]
    if "import os" not in lines[:30]:
        lines.insert(0, "import os")
        target += 1
        end += 1
    lines[target : end + 1] = replacement
    loader.write_text("\n".join(lines) + "\n")

    cache_root = Path.home() / ".cache/huggingface/modules/transformers_modules"
    if cache_root.exists():
        for cached in cache_root.glob("ai4bharat*"):
            if cached.is_dir():
                shutil.rmtree(cached, ignore_errors=True)


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
        prepare_indicconformer_local_code(source)
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
