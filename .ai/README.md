# AI Tool Configuration (fintr project)

This directory is the canonical source for AI assistant configurations shared across tools in this project.

## Structure

```
~/Programming/fintr/
├── .ai/                          ← THE ONE SOURCE OF TRUTH
│   ├── skills/                   # All project-specific skills (shared by all tools)
│   ├── rules/                    # AI rules & conventions (shared by all tools)
│   ├── questions/                # Discussion notes (shared by all tools)
│   └── mcp.json                  # MCP server configurations (shared by all tools)
│
├── .cursor/                      # symlinks to .ai/
│   ├── mcp.json -> ../.ai/mcp.json
│   ├── questions -> ../.ai/questions
│   ├── rules -> ../.ai/rules
│   └── skills -> ../.ai/skills
│
├── .opencode/                    # symlinks to .ai/
│   ├── mcp.json -> ../.ai/mcp.json
│   ├── questions -> ../.ai/questions
│   ├── rules -> ../.ai/rules
│   └── skills -> ../.ai/skills
│
├── .windsurf/                    # symlinks to .ai/
│   ├── mcp.json -> ../.ai/mcp.json
│   ├── questions -> ../.ai/questions
│   ├── rules -> ../.ai/rules
│   └── skills -> ../.ai/skills
│
└── .claude/                      # symlinks to .ai/
    ├── mcp.json -> ../.ai/mcp.json
    ├── questions -> ../.ai/questions
    ├── rules -> ../.ai/rules
    └── skills -> ../.ai/skills
```

## Global Skills

Tools also read global skills from `~/.config/ai/skills/` (merged from both Cursor and OpenCode global skills).

## Adding a New Tool

When adding a new AI tool, create symlinks from its config directory to `.ai/`:

```bash
cd ~/Programming/fintr
mkdir .newtool
ln -s ../.ai/mcp.json .newtool/mcp.json
ln -s ../.ai/questions .newtool/questions
ln -s ../.ai/rules .newtool/rules
ln -s ../.ai/skills .newtool/skills
```

## Notes

- **Do not** commit tool-specific state (IDE state, extensions, caches).
- Only symlink configuration files (skills, rules, mcp.json, questions).
- `.cursor/`, `.opencode/`, `.windsurf/`, and `.claude/` directories may still contain tool-specific files that are not symlinked.
