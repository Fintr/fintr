---
name: web-research
description: Spawns a subagent to perform targeted web research for technical problems, API documentation, and platform-specific solutions. Use when encountering unfamiliar errors, needing current documentation, researching Android/iOS/browser behaviors, or when the user says "research this" or "search for solutions".
---

# Web Research Subagent

Spawns a `generalPurpose` subagent to perform targeted web searches and return synthesized findings.

## When to Activate

Spawn the web-research subagent when:
- Encountering unfamiliar error messages or exceptions
- Needing up-to-date API documentation or library information
- Researching platform-specific behaviors (Android, iOS, browser quirks)
- Looking for community solutions to known issues
- Verifying current best practices
- User explicitly requests web research

## How to Use

Spawn a subagent with the Task tool:

```
Task: {
  description: "Research [specific topic]",
  prompt: "Research [detailed research question]. Focus on [specific aspects]. Return findings with code snippets and source URLs.",
  subagent_type: "generalPurpose"
}
```

## Research Prompt Template

Use this structure for research prompts:

```
Research the following technical issue:

**Problem**: [Describe the error or question]
**Context**: [Framework, platform, version]
**Key terms**: [Error messages, API names, technical terms]

**Questions to answer**:
1. [Specific question 1]
2. [Specific question 2]
3. [Specific question 3]

**Focus areas**:
- Official documentation
- GitHub issues/discussions
- Stack Overflow (recent, verified answers)
- Release notes/changelogs

Return a concise summary with:
- Key findings (bullet points)
- Recommended code snippets
- Source URLs for verification
- Any version-specific considerations
```

## Example Activations

**Android navigation detection:**
```
Task: {
  description: "Research Android nav detection",
  prompt: "Research the most reliable way to detect Android 3-button navigation vs gesture navigation.\n\nKey questions:\n1. What is Settings.Secure navigation_mode and its values?\n2. Are there OEM-specific quirks (Samsung, Xiaomi)?\n3. What fallback for Android < 10?\n4. What permissions are needed?\n\nFocus on official Android docs, reliable Stack Overflow, and GitHub issues.\n\nReturn findings with code snippets and URLs."
  subagent_type: "generalPurpose"
}
```

**Library breaking changes:**
```
Task: {
  description: "Research [library] v[version] changes",
  prompt: "Research breaking changes in [library] version [version].\n\nError encountered: [error message]\n\nFind:\n1. Migration guide\n2. Changelog for this version\n3. Common migration issues\n4. Recommended fixes\n\nReturn summary with code examples and source URLs."
  subagent_type: "generalPurpose"
}
```

**Platform-specific bug:**
```
Task: {
  description: "Research [platform] [issue]",
  prompt: "Research [specific issue] on [platform/version].\n\nSymptoms: [describe]\n\nQuestions:\n1. Is this a known issue?\n2. Are there workarounds?\n3. Any official fixes planned?\n\nCheck GitHub issues, official forums, Stack Overflow."
  subagent_type: "generalPurpose"
}
```

## Guidelines for Research Subagents

**Always specify:**
- Exact error messages or API names
- Version numbers if known
- Platform/framework context
- What type of sources to prioritize

**Never ask subagent to:**
- Make code changes (only research)
- Access private/internal resources
- Guess at solutions without sources

**Expected output format:**
```
## Research Summary: [Topic]

### Key Findings
- Finding with [source]
- Finding with [source]

### Recommended Solution
[Code snippet if applicable]

### References
- [Title](URL)
- [Title](URL)
```

## When NOT to Use

Don't spawn web-research subagent when:
- The solution is already known from the codebase
- It's a simple syntax error
- The user is asking for opinion-based advice
- Local file analysis would be faster
