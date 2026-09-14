#!/usr/bin/env bash
# train-lora.sh
# Trains a LoRA on Ubuntu + NVIDIA for anatomy detail using kohya_ss.
#
# Usage:
#   bash scripts/train-lora.sh [OPTIONS]
#
# Options:
#   --name NAME          LoRA name (default: anatomy-detail)
#   --images DIR         Directory of training images (default: ~/lora-training/images)
#   --base-model PATH    Base .safetensors model (default: auto-detected from A1111)
#   --steps N            Training steps (default: 1500)
#   --dim N              Network dimension (default: 32; higher = more capacity, more VRAM)
#   --trigger WORD       Trigger word to associate with the concept (default: intact_anatomy)
#   --help               Show this help
#
# Workflow:
#   1. Collect 15-30 reference images showing the anatomy detail correctly
#   2. Run this script — it installs kohya_ss, sets up captions, trains, and
#      copies the finished LoRA into A1111 automatically
#   3. In canon-forge prompts add: <lora:anatomy-detail:0.7>, intact_anatomy
set -euo pipefail

# ── colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[lora]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
error() { echo -e "${RED}[error]${NC} $*"; exit 1; }
step()  { echo -e "\n${CYAN}━━ $* ━━${NC}"; }

# ── defaults ─────────────────────────────────────────────────────────────────
LORA_NAME="anatomy-detail"
IMAGES_DIR="$HOME/lora-training/images"
BASE_MODEL=""
TRAIN_STEPS=1500
NETWORK_DIM=32
TRIGGER_WORD="intact_anatomy"

SD_DIR="$HOME/stable-diffusion-webui"
KOHYA_DIR="$HOME/kohya_ss"
WORK_DIR="$HOME/lora-training"

# ── args ─────────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --name)        LORA_NAME="$2";    shift 2 ;;
    --images)      IMAGES_DIR="$2";   shift 2 ;;
    --base-model)  BASE_MODEL="$2";   shift 2 ;;
    --steps)       TRAIN_STEPS="$2";  shift 2 ;;
    --dim)         NETWORK_DIM="$2";  shift 2 ;;
    --trigger)     TRIGGER_WORD="$2"; shift 2 ;;
    --help)
      head -25 "$0" | grep "^#" | sed 's/^# \?//'
      exit 0 ;;
    *) warn "Unknown arg: $1"; shift ;;
  esac
done

NETWORK_ALPHA=$(( NETWORK_DIM / 2 ))

# ── preflight ─────────────────────────────────────────────────────────────────
step "Checking system"

if ! command -v nvidia-smi &>/dev/null; then
  error "NVIDIA drivers not found. Run setup-local-sd.sh first."
fi

GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
VRAM_MB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader | head -1 | tr -d ' MiB')
info "GPU : $GPU_NAME"
info "VRAM: ${VRAM_MB}MB"

if [[ "$VRAM_MB" -lt 6000 ]]; then
  error "Need at least 6GB VRAM for LoRA training. You have ${VRAM_MB}MB."
fi
if [[ "$VRAM_MB" -lt 8000 ]]; then
  warn "Low VRAM (${VRAM_MB}MB). Forcing --dim 16 and batch size 1 to fit."
  NETWORK_DIM=16
  NETWORK_ALPHA=8
fi

# ── auto-detect base model ────────────────────────────────────────────────────
if [[ -z "$BASE_MODEL" ]]; then
  step "Auto-detecting base model"
  MODELS_DIR="$SD_DIR/models/Stable-diffusion"
  # Prefer epiCRealism, then Realistic Vision, then any .safetensors
  for candidate in \
    "$MODELS_DIR/epicrealism_v5.safetensors" \
    "$MODELS_DIR/realisticVision_v6.safetensors" \
    "$MODELS_DIR"/*.safetensors
  do
    if [[ -f "$candidate" ]]; then
      BASE_MODEL="$candidate"
      info "Using: $BASE_MODEL"
      break
    fi
  done
  if [[ -z "$BASE_MODEL" ]]; then
    error "No .safetensors model found in $MODELS_DIR. Run setup-local-sd.sh first or pass --base-model."
  fi
fi

# ── images check ─────────────────────────────────────────────────────────────
step "Checking training images"

if [[ ! -d "$IMAGES_DIR" ]]; then
  mkdir -p "$IMAGES_DIR"
  echo ""
  echo -e "${YELLOW}  No images found at $IMAGES_DIR${NC}"
  echo ""
  echo "  Add 15–30 reference images there, then re-run this script."
  echo ""
  echo "  Image tips for anatomy detail LoRAs:"
  echo "    • Consistent subject, varied angles (front, 3/4, close-up)"
  echo "    • Clear, well-lit — avoid blurry or low-contrast shots"
  echo "    • JPG or PNG, any resolution (will be auto-cropped to 512px)"
  echo "    • Anatomy references, medical illustrations, or figure drawings all work"
  echo ""
  exit 0
fi

IMG_COUNT=$(find "$IMAGES_DIR" -maxdepth 1 -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) | wc -l)
if [[ "$IMG_COUNT" -lt 5 ]]; then
  error "Only $IMG_COUNT image(s) found in $IMAGES_DIR. Need at least 15 for a good LoRA."
fi
info "$IMG_COUNT training images found."

if [[ "$IMG_COUNT" -lt 15 ]]; then
  warn "Fewer than 15 images — LoRA may be weak. More images = better results."
fi

# Recommend step count based on image count
RECOMMENDED_STEPS=$(( IMG_COUNT * 10 * 15 ))
if [[ "$TRAIN_STEPS" -lt "$RECOMMENDED_STEPS" ]]; then
  warn "Recommended steps for $IMG_COUNT images: $RECOMMENDED_STEPS (you set $TRAIN_STEPS)."
  warn "  Override: --steps $RECOMMENDED_STEPS"
fi

# ── install kohya_ss ──────────────────────────────────────────────────────────
step "Setting up kohya_ss"

if [[ ! -d "$KOHYA_DIR/.git" ]]; then
  info "Cloning kohya_ss..."
  git clone --recurse-submodules https://github.com/bmaltais/kohya_ss.git "$KOHYA_DIR"
else
  info "kohya_ss already cloned — pulling latest..."
  git -C "$KOHYA_DIR" pull --ff-only
fi

VENV="$KOHYA_DIR/venv"
if [[ ! -d "$VENV" ]]; then
  info "Creating Python venv..."
  python3 -m venv "$VENV"
fi

source "$VENV/bin/activate"

info "Installing/updating kohya_ss dependencies..."
# Detect CUDA version for the right torch wheel
CUDA_VER=$(nvidia-smi | grep -oP "CUDA Version: \K[\d.]+" | cut -d. -f1,2 | tr -d '.')
case "$CUDA_VER" in
  121|122|123|124|125|126) TORCH_CUDA="cu121" ;;
  118|119|120)              TORCH_CUDA="cu118" ;;
  *)                        TORCH_CUDA="cu121" ;;
esac

pip install --quiet --upgrade pip
pip install --quiet torch torchvision --index-url "https://download.pytorch.org/whl/${TORCH_CUDA}"
pip install --quiet -r "$KOHYA_DIR/requirements.txt"
pip install --quiet bitsandbytes  # for 8-bit AdamW optimizer

info "kohya_ss ready."

# ── prepare dataset ───────────────────────────────────────────────────────────
step "Preparing dataset"

# kohya_ss expects: dataset/<repeats>_<concept>/<images + captions>
REPEATS=10
CONCEPT_DIR="$WORK_DIR/dataset/${REPEATS}_${TRIGGER_WORD}"
OUTPUT_DIR="$WORK_DIR/output/$LORA_NAME"
LOG_DIR="$WORK_DIR/logs/$LORA_NAME"

mkdir -p "$CONCEPT_DIR" "$OUTPUT_DIR" "$LOG_DIR"

# Copy images and write captions
info "Copying images and writing captions..."
COPIED=0
while IFS= read -r -d '' img; do
  filename=$(basename "$img")
  ext="${filename##*.}"
  stem="${filename%.*}"
  dest="$CONCEPT_DIR/$filename"
  caption_file="$CONCEPT_DIR/${stem}.txt"

  cp -n "$img" "$dest" 2>/dev/null || true

  # Write caption if it doesn't exist
  # Keep existing captions if user wrote their own
  if [[ ! -f "$caption_file" ]]; then
    echo "${TRIGGER_WORD}, realistic anatomy, figure reference, detailed, photorealistic" > "$caption_file"
    (( COPIED++ )) || true
  fi
done < <(find "$IMAGES_DIR" -maxdepth 1 -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) -print0)

info "Dataset prepared: $CONCEPT_DIR"
info "Auto-captioned $COPIED image(s)."
echo ""
echo -e "  ${YELLOW}Tip: Edit .txt files in $CONCEPT_DIR to refine captions.${NC}"
echo -e "  ${YELLOW}Each line is one image's training caption.${NC}"
echo ""

# ── write training config ─────────────────────────────────────────────────────
step "Writing training config"

CONFIG_DIR="$WORK_DIR/config"
mkdir -p "$CONFIG_DIR"

DATASET_CONFIG="$CONFIG_DIR/dataset.toml"
cat > "$DATASET_CONFIG" << TOML
[general]
shuffle_caption    = true
caption_extension  = ".txt"
keep_tokens        = 1

[[datasets]]
resolution         = 512
batch_size         = 1
enable_bucket      = true
bucket_no_upscale  = true

  [[datasets.subsets]]
  image_dir        = "$CONCEPT_DIR"
  class_tokens     = "$TRIGGER_WORD"
  num_repeats      = $REPEATS
TOML

info "Dataset config: $DATASET_CONFIG"

# ── run training ──────────────────────────────────────────────────────────────
step "Training LoRA: $LORA_NAME (steps=$TRAIN_STEPS, dim=$NETWORK_DIM, alpha=$NETWORK_ALPHA)"
echo ""
echo -e "  Base model : $BASE_MODEL"
echo -e "  Trigger    : $TRIGGER_WORD"
echo -e "  Output     : $OUTPUT_DIR"
echo -e "  Steps      : $TRAIN_STEPS"
echo ""
echo "  This will take 20–60 minutes depending on your GPU."
echo "  Checkpoints saved every 250 steps."
echo ""

python "$KOHYA_DIR/train_network.py" \
  --pretrained_model_name_or_path="$BASE_MODEL" \
  --dataset_config="$DATASET_CONFIG" \
  --output_dir="$OUTPUT_DIR" \
  --output_name="$LORA_NAME" \
  --logging_dir="$LOG_DIR" \
  --network_module=networks.lora \
  --network_dim="$NETWORK_DIM" \
  --network_alpha="$NETWORK_ALPHA" \
  --max_train_steps="$TRAIN_STEPS" \
  --save_every_n_steps=250 \
  --learning_rate=1e-4 \
  --unet_lr=1e-4 \
  --text_encoder_lr=5e-5 \
  --lr_scheduler=cosine_with_restarts \
  --lr_warmup_steps=100 \
  --optimizer_type=AdamW8bit \
  --train_batch_size=1 \
  --mixed_precision=fp16 \
  --save_precision=fp16 \
  --gradient_checkpointing \
  --xformers \
  --cache_latents \
  --seed=42

# ── copy to A1111 ─────────────────────────────────────────────────────────────
step "Installing LoRA into A1111"

LORA_OUT="$OUTPUT_DIR/${LORA_NAME}.safetensors"
A1111_LORA_DIR="$SD_DIR/models/Lora"
mkdir -p "$A1111_LORA_DIR"

if [[ -f "$LORA_OUT" ]]; then
  cp "$LORA_OUT" "$A1111_LORA_DIR/"
  info "Copied to: $A1111_LORA_DIR/${LORA_NAME}.safetensors"
else
  # Last checkpoint if final save didn't land
  LAST=$(ls -t "$OUTPUT_DIR"/*.safetensors 2>/dev/null | head -1 || true)
  if [[ -n "$LAST" ]]; then
    cp "$LAST" "$A1111_LORA_DIR/${LORA_NAME}.safetensors"
    info "Copied last checkpoint: $LAST → $A1111_LORA_DIR/${LORA_NAME}.safetensors"
  else
    warn "No .safetensors found in $OUTPUT_DIR. Training may have failed — check logs in $LOG_DIR."
    exit 1
  fi
fi

deactivate

# ── done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━ LoRA training complete ━━${NC}"
echo ""
echo "  LoRA installed: $A1111_LORA_DIR/${LORA_NAME}.safetensors"
echo ""
echo "  To use in canon-forge, add to your character prompts:"
echo ""
echo -e "    ${CYAN}<lora:${LORA_NAME}:0.7>, ${TRIGGER_WORD}${NC}"
echo ""
echo "  Weight guide:"
echo "    0.5  — subtle influence"
echo "    0.7  — balanced (recommended starting point)"
echo "    1.0  — strong / can overpower the base model"
echo ""
echo "  To retrain with more images or more steps:"
echo "    bash scripts/train-lora.sh --steps $(( TRAIN_STEPS + 500 ))"
echo ""
