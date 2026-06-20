#!/bin/bash
# Demo: generate a recipe image using FLUX via inference.sh belt CLI
# Usage: ./scripts/generate-recipe-image.sh [recipe name]
# Requires: belt CLI installed (curl -fsSL https://cli.inference.sh | sh) + belt login

set -e

RECIPE="${1:-spaghetti carbonara}"

echo "🖼  PantrySwipe — AI recipe image generation via inference.sh"
echo "============================================================="
echo "Recipe: $RECIPE"
echo ""

belt app run falai/flux-dev-lora \
  --input "{\"prompt\": \"professional food photography of ${RECIPE}, overhead shot, natural lighting, appetizing, high resolution, on a beautiful plate\", \"num_images\": 1, \"image_size\": \"square_hd\"}"
