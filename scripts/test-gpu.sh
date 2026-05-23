#!/bin/bash

echo "--- Testing GPU Visibility in Canon Forge Containers ---"

echo "1. Checking Stable Diffusion container..."
docker exec canon-forge-sd nvidia-smi | grep "NVIDIA-SMI"
if [ $? -eq 0 ]; then
    echo "✅ Stable Diffusion container has GPU access."
else
    echo "❌ Stable Diffusion container cannot see GPU."
fi

echo "2. Checking Ollama container..."
docker exec canon-forge-ollama nvidia-smi | grep "NVIDIA-SMI"
if [ $? -eq 0 ]; then
    echo "✅ Ollama container has GPU access."
else
    echo "❌ Ollama container cannot see GPU."
fi

echo "--------------------------------------------------------"
echo "If tests failed, ensure 'nvidia-container-toolkit' is installed on Ubuntu"
echo "and you have restarted the docker daemon."
