#!/bin/bash
# Demo: call Claude via inference.sh belt CLI for AI Chef queries
# Usage: ./scripts/ai-chef-test.sh
# Requires: belt CLI installed (curl -fsSL https://cli.inference.sh | sh) + belt login

set -e

echo "🍳 PantrySwipe — AI Chef demo via inference.sh"
echo "================================================"

belt app run openrouter/claude-sonnet-45 \
  --input '{"prompt": "You are a helpful AI Chef. The user has: chicken breast, rice, garlic, olive oil, lemon, soy sauce. They follow a balanced diet. What can I cook tonight in under 30 minutes?"}'
