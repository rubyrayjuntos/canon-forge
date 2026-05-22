#!/usr/bin/env bash
# setup-local-sd.sh
# Sets up AUTOMATIC1111 on Ubuntu + NVIDIA for canon-forge local image generation.
# Usage: bash scripts/setup-local-sd.sh [--civitai-key YOUR_KEY] [--model epic|realistic|both]
set -euo pipefail

# ── colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[setup]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
error() { echo -e "${RED}[error]${NC} $*"; exit 1; }
step()  { echo -e "\n${GREEN}━━ $* ━━${NC}"; }

# ── args ─────────────────────────────────────────────────────────────────────
CIVITAI_KEY=""
MODEL_CHOICE="epic"   # epic | realistic | both | none

while [[ $# -gt 0 ]]; do
  case $1 in
    --civitai-key) CIVITAI_KEY="$2"; shift 2 ;;
    --model)       MODEL_CHOICE="$2"; shift 2 ;;
    *) warn "Unknown arg: $1"; shift ;;
  esac
done

SD_DIR="$HOME/stable-diffusion-webui"
MODELS_DIR="$SD_DIR/models/Stable-diffusion"

# ── preflight ─────────────────────────────────────────────────────────────────
step "Checking system"

if ! command -v nvidia-smi &>/dev/null; then
  error "nvidia-smi not found. Install NVIDIA drivers first: https://ubuntu.com/server/docs/nvidia-drivers-installation"
fi

CUDA_VER=$(nvidia-smi | grep -oP "CUDA Version: \K[\d.]+")
GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
info "GPU : $GPU_NAME"
info "CUDA: $CUDA_VER"

python_bin=$(command -v python3 || true)
if [[ -z "$python_bin" ]]; then
  error "python3 not found."
fi
PY_VER=$("$python_bin" --version 2>&1 | awk '{print $2}')
info "Python: $PY_VER"

# Python 3.10 or 3.11 recommended for A1111
MAJOR=${PY_VER%%.*}
MINOR=${PY_VER#*.}; MINOR=${MINOR%%.*}
if [[ "$MAJOR" -lt 3 ]] || [[ "$MAJOR" -eq 3 && "$MINOR" -lt 10 ]]; then
  warn "Python $PY_VER detected. A1111 works best with 3.10 or 3.11."
fi

# ── system deps ───────────────────────────────────────────────────────────────
step "Installing system dependencies"

sudo apt-get update -q
PY_MINOR_PKG="python3.${MINOR}-venv"
sudo apt-get install -y \
  wget git curl \
  "$PY_MINOR_PKG" python3-pip \
  libgl1 libglib2.0-0 \
  libsm6 libxrender1 libxext6 \
  build-essential

info "System deps installed."

# ── clone / update A1111 ──────────────────────────────────────────────────────
step "Setting up AUTOMATIC1111"

if [[ -d "$SD_DIR/.git" ]]; then
  info "Found existing install at $SD_DIR — pulling latest..."
  git -C "$SD_DIR" pull --ff-only
else
  info "Cloning into $SD_DIR ..."
  git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git "$SD_DIR"
fi

mkdir -p "$MODELS_DIR"

# ── model download ────────────────────────────────────────────────────────────
step "Models"

download_civitai() {
  local name="$1" version_id="$2" filename="$3"
  local dest="$MODELS_DIR/$filename"
  if [[ -f "$dest" ]]; then
    info "Model already exists: $filename — skipping."
    return
  fi
  if [[ -z "$CIVITAI_KEY" ]]; then
    warn "No --civitai-key provided. Skipping $name."
    warn "  → Download manually from https://civitai.com/models and place in:"
    warn "    $MODELS_DIR/"
    return
  fi
  info "Downloading $name ..."
  wget --progress=bar:force:noscroll \
    --header="Authorization: Bearer $CIVITAI_KEY" \
    -O "$dest" \
    "https://civitai.com/api/download/models/$version_id"
  info "$name saved."
}

case "$MODEL_CHOICE" in
  epic)
    # epiCRealism v5 — photorealistic, uncensored figure references
    download_civitai "epiCRealism v5" "134065" "epicrealism_v5.safetensors"
    ;;
  realistic)
    # Realistic Vision V6 — clean photorealism, strong anatomy
    download_civitai "Realistic Vision V6" "245598" "realisticVision_v6.safetensors"
    ;;
  both)
    download_civitai "epiCRealism v5"     "134065" "epicrealism_v5.safetensors"
    download_civitai "Realistic Vision V6" "245598" "realisticVision_v6.safetensors"
    ;;
  none)
    warn "Skipping model download. A1111 will use its default SD 1.5 on first launch."
    ;;
  *)
    warn "Unknown --model value '$MODEL_CHOICE'. Skipping download."
    ;;
esac

# ── launch script ─────────────────────────────────────────────────────────────
step "Creating launch script"

LAUNCH="$SD_DIR/launch-canon-forge.sh"
cat > "$LAUNCH" << 'LAUNCHER'
#!/usr/bin/env bash
# Launch AUTOMATIC1111 configured for canon-forge.
# Flags:
#   --api              enables the REST API on port 7860
#   --cors-allow-origins "*"  lets the Vite dev server call the API
#   --xformers         memory-efficient attention (faster, less VRAM)
#   --no-gradio-queue  simpler request handling for API-only use
set -euo pipefail
cd "$(dirname "$0")"

# Python 3.13 compat: override torch pin (A1111 default of 2.1.2 has no py313 build)
export TORCH_COMMAND="pip install torch==2.7.0 torchvision==0.22.0 --index-url https://download.pytorch.org/whl/cu128"
# Stability-AI removed the original public repo; use a mirror pinned to the
# same commit expected by AUTOMATIC1111.
export STABLE_DIFFUSION_REPO="https://github.com/joypaul162/Stability-AI-stablediffusion.git"
export STABLE_DIFFUSION_COMMIT_HASH="f16630a927e00098b524d687640719e4eb469b76"

MODELS_DIR="$HOME/stable-diffusion-webui/models/Stable-diffusion"
FALLBACK_MODEL_NAME="${CANON_FORGE_FALLBACK_MODEL_NAME:-v1-5-pruned-emaonly.safetensors}"
FALLBACK_MODEL_URL="${CANON_FORGE_FALLBACK_MODEL_URL:-https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors}"
FALLBACK_MODEL_SHA256="${CANON_FORGE_FALLBACK_MODEL_SHA256:-6ce0161689b3853acaa03779ec93eafe75a02f4ced659bee03f50797806fa2fa}"
DOWNLOAD_ENABLED="${CANON_FORGE_AUTO_DOWNLOAD_MODEL:-true}"
MIN_CKPT_BYTES=$((250 * 1024 * 1024))

is_truthy() {
  case "${1,,}" in
    1|true|yes|y|on) return 0 ;;
    *) return 1 ;;
  esac
}

is_valid_safetensors() {
  local file="$1"
  python3 - "$file" <<'PY'
import json
import os
import struct
import sys

path = sys.argv[1]

try:
    size = os.path.getsize(path)
    if size < 16:
        raise ValueError("file too small")

    with open(path, "rb") as f:
        raw = f.read(8)
        if len(raw) != 8:
            raise ValueError("failed to read header length")
        header_len = struct.unpack("<Q", raw)[0]
        if header_len <= 2 or header_len > size - 8:
            raise ValueError("invalid header length")
        header = json.loads(f.read(header_len))

    data_size = size - 8 - header_len
    tensor_count = 0
    for key, value in header.items():
        if key == "__metadata__":
            continue
        if not isinstance(value, dict):
            raise ValueError("tensor metadata is not an object")
        offsets = value.get("data_offsets")
        if not isinstance(offsets, list) or len(offsets) != 2:
            raise ValueError("missing data_offsets")
        begin, end = offsets
        if not isinstance(begin, int) or not isinstance(end, int):
            raise ValueError("non-integer data_offsets")
        if begin < 0 or end < 0 or begin > end or end > data_size:
            raise ValueError("data_offsets outside file bounds")
        tensor_count += 1

    if tensor_count == 0:
        raise ValueError("no tensors found")
except Exception:
    sys.exit(1)
PY
}

quarantine_bad_model() {
  local file="$1"
  local bad="${file}.corrupt-$(date +%Y%m%d-%H%M%S)"
  echo "[model] Invalid checkpoint: $(basename "$file")"
  echo "[model] Moving to: $bad"
  mv -f "$file" "$bad"
}

ensure_valid_model() {
  mkdir -p "$MODELS_DIR"

  local valid_found=0
  shopt -s nullglob
  local checkpoints=("$MODELS_DIR"/*.safetensors "$MODELS_DIR"/*.ckpt)
  shopt -u nullglob

  for model in "${checkpoints[@]}"; do
    if [[ "$model" == *.safetensors ]]; then
      if is_valid_safetensors "$model"; then
        valid_found=1
      else
        quarantine_bad_model "$model"
      fi
    else
      local size
      size=$(stat -c%s "$model" 2>/dev/null || echo 0)
      if (( size >= MIN_CKPT_BYTES )); then
        valid_found=1
      else
        quarantine_bad_model "$model"
      fi
    fi
  done

  if (( valid_found == 1 )); then
    return 0
  fi

  if ! is_truthy "$DOWNLOAD_ENABLED"; then
    echo "[model] No valid checkpoint found and auto-download is disabled."
    echo "[model] Set CANON_FORGE_AUTO_DOWNLOAD_MODEL=true to enable fallback download."
    return 1
  fi

  local target="$MODELS_DIR/$FALLBACK_MODEL_NAME"
  local tmp="${target}.part"

  echo "[model] No valid checkpoint found. Downloading fallback model:"
  echo "        $FALLBACK_MODEL_NAME"
  curl -fL --retry 8 --retry-delay 3 --retry-all-errors -C - -o "$tmp" "$FALLBACK_MODEL_URL"
  mv -f "$tmp" "$target"

  if [[ -n "$FALLBACK_MODEL_SHA256" ]]; then
    local actual_sha
    actual_sha=$(sha256sum "$target" | awk '{print $1}')
    if [[ "$actual_sha" != "$FALLBACK_MODEL_SHA256" ]]; then
      echo "[model] SHA256 mismatch for $target"
      echo "[model] expected: $FALLBACK_MODEL_SHA256"
      echo "[model] actual  : $actual_sha"
      return 1
    fi
  fi

  if ! is_valid_safetensors "$target"; then
    echo "[model] Downloaded file did not pass safetensors validation: $target"
    return 1
  fi

  echo "[model] Fallback model ready: $target"
}

ensure_valid_model

# Keep install checks enabled so missing runtime deps are installed.
export COMMANDLINE_ARGS="--api --cors-allow-origins * --xformers --no-gradio-queue --skip-python-version-check --medvram --disable-nan-check"
bash webui.sh
LAUNCHER

chmod +x "$LAUNCH"
info "Launch script: $LAUNCH"

# ── .env hint ────────────────────────────────────────────────────────────────
step "canon-forge .env"

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_DIR/.env"

if grep -q "VITE_USE_LOCAL_SD" "$ENV_FILE" 2>/dev/null; then
  info ".env already has VITE_USE_LOCAL_SD — not touching."
else
  info "Adding local SD config to $ENV_FILE ..."
  printf '\n# Local Stable Diffusion\nVITE_USE_LOCAL_SD=true\nLOCAL_SD_URL=http://localhost:7860\n' >> "$ENV_FILE"
  info "Written to .env."
fi

# ── done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━ Setup complete ━━${NC}"
echo ""
echo "  1. Start A1111:"
echo "       $LAUNCH"
echo ""
echo "  2. Wait for 'Running on local URL: http://127.0.0.1:7860' in the terminal."
echo "     (First launch downloads torch + dependencies — takes a few minutes.)"
echo ""
echo "  3. Start canon-forge:"
echo "       npm run dev"
echo ""
echo "  All character/set generation will now route through your local A1111."
echo "  No content filters. Whatever model you load in A1111 is what you get."
echo ""
if [[ -z "$CIVITAI_KEY" ]]; then
  echo -e "${YELLOW}  Tip: Re-run with --civitai-key YOUR_KEY to auto-download models:${NC}"
  echo "       bash scripts/setup-local-sd.sh --civitai-key YOUR_KEY --model epic"
  echo "  Get your key at: https://civitai.com/user/account (API Keys section)"
  echo ""
fi
