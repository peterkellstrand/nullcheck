#!/bin/bash
# Install nullcheck screen skill for Claude Code
#
# Usage:
#   ./install.sh            # Install to ~/.claude/skills/nullcheck/
#   ./install.sh --project  # Install to current project's .claude/skills/nullcheck/

set -e

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "$1" = "--project" ]; then
  TARGET_DIR=".claude/skills/nullcheck"
else
  TARGET_DIR="$HOME/.claude/skills/nullcheck"
fi

echo "Installing nullcheck screen skill to $TARGET_DIR..."

mkdir -p "$TARGET_DIR/references"
mkdir -p "$TARGET_DIR/prompts"

cp "$SKILL_DIR/SKILL.md" "$TARGET_DIR/SKILL.md"
cp "$SKILL_DIR/references/risk-analysis.md" "$TARGET_DIR/references/risk-analysis.md"
cp "$SKILL_DIR/references/api-guide.md" "$TARGET_DIR/references/api-guide.md"
cp "$SKILL_DIR/prompts/claude.system.md" "$TARGET_DIR/prompts/claude.system.md"
cp "$SKILL_DIR/prompts/openai.developer.md" "$TARGET_DIR/prompts/openai.developer.md"
cp "$SKILL_DIR/prompts/full.md" "$TARGET_DIR/prompts/full.md"

echo "Done! nullcheck screen skill installed to $TARGET_DIR"
echo ""
echo "Next steps:"
echo "  1. Make sure the nullcheck MCP server is configured:"
echo "     claude mcp add nullcheck npx @nullcheck/mcp-server@latest"
echo "  2. Set your API key:"
echo "     export NULLCHECK_API_KEY=nk_your_key_here"
echo "  3. Start Claude Code — the skill will be available automatically."
