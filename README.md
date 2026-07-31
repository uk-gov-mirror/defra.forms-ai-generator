# forms-creator-mcp

An MCP server for building [Defra Forms](https://github.com/DEFRA/forms-designer) form definitions via a conversational AI agent. Describe the form you want and the agent builds the JSON structure step by step.

## Prerequisites

- Node.js 20+
- Claude Code CLI

## Installation

```bash
git clone <this-repo>
cd forms-creator-mcp
npm install
npm run build
```

## Hooking up to Claude Code

### Working inside this repo

Nothing to configure — this repo ships its own `.mcp.json`:

```json
{
  "mcpServers": {
    "forms-creator": {
      "command": "node",
      "args": ["dist/index.js"]
    }
  }
}
```

Run `npm run build` first (`dist/` isn't committed), then start Claude Code from the
repo root and approve the project server when prompted. The path is relative to the
directory Claude Code is launched in, so the repo root matters.

To use the server from *other* projects, pick one of the options below.

### Option A — project scope (shared with the team)

Add a `.mcp.json` file at the root of the project where you want to use this tool,
pointing at your local checkout:

```json
{
  "mcpServers": {
    "forms-creator": {
      "command": "node",
      "args": ["/absolute/path/to/forms-creator-mcp/dist/index.js"]
    }
  }
}
```

Commit this file so everyone on the project gets the server automatically. The path has
to be absolute here, since the server lives outside that project.

### Option B — user scope (available across all your projects)

```bash
claude mcp add --scope user forms-creator -- node /absolute/path/to/forms-creator-mcp/dist/index.js
```

### Option C — local scope (just you, current project only)

```bash
claude mcp add forms-creator -- node /absolute/path/to/forms-creator-mcp/dist/index.js
```

Local scope is the default when no `--scope` flag is given.

### Verify the server is connected

Start Claude Code and run:

```
/mcp
```

You should see `forms-creator` listed with 12 tools.

## Available tools

| Tool | Description |
|---|---|
| `create_form` | Start a new form — resets any in-progress state |
| `add_page` | Add a question page (becomes the active page) |
| `add_guidance_page` | Add an information page with markdown content |
| `set_current_page` | Switch the active page by path |
| `add_question` | Add an input field to the active page |
| `add_content` | Add a display-only component (callout, markdown block, etc.) |
| `add_page_condition` | Gate a page so it only shows when a previous answer matches |
| `add_composite_condition` | Combine two or more conditions with AND / OR |
| `apply_condition_to_page` | Apply a composite condition to the active page |
| `get_form_status` | Summary of pages, questions, and conditions built so far |
| `get_form_json` | Full raw JSON of the form being built |
| `save_form` | Write `<form-name>.json` to disk |

### Question types for `add_question`

| Type | Description |
|---|---|
| `TextField` | Single-line text |
| `MultilineTextField` | Multi-line textarea |
| `EmailAddressField` | Email with format validation |
| `TelephoneNumberField` | Telephone number |
| `NumberField` | Numeric input (supports `prefix`/`suffix` e.g. `£`, `%`) |
| `YesNoField` | Yes / No radio buttons |
| `DatePartsField` | Day / month / year |
| `MonthYearField` | Month / year only |
| `RadiosField` | Radio buttons from a list (requires `list_items`) |
| `CheckboxesField` | Checkboxes from a list (requires `list_items`) |
| `SelectField` | Dropdown from a list (requires `list_items`) |
| `AutocompleteField` | Autocomplete from a list (requires `list_items`) |
| `UkAddressField` | UK address with postcode lookup |
| `FileUploadField` | File upload |
| `DeclarationField` | Declaration checkbox (requires `content`) |

## Usage

Once Claude Code is connected to the server, describe the form you want in plain English. The agent will call the tools in sequence to build it, then save it to disk.

### Example prompt

```
Using the forms-creator MCP server, build a planning application form with the following pages:

1. "About you" — ask for full name (text), email address, and whether they are the 
   owner of the land (yes/no).

2. "Owner details" — only shown if the previous answer is "No". Ask for the owner's 
   full name and UK address.

3. "Site details" — ask for a description of the proposed works (multiline text, 
   max 500 words) and the date work is due to start (date).

Save the form to /tmp.
```

### How conditions work

Page conditions gate visibility: a page is only shown to the user if its condition is true. To set one up, add the page and its questions first, then call `add_page_condition` referencing the `name` of a question on a *previous* page.

For **list-based questions** (radios, checkboxes, select), pass the item's `value` string as the condition value.

For **YesNoField**, pass `"true"` / `"yes"` or `"false"` / `"no"`.

For **text or number fields**, pass the string or number value to compare.

To combine conditions (e.g. show a page only when A *and* B are true):
1. Create individual conditions with `add_page_condition` on throwaway pages, or note the names you gave them.
2. Call `add_composite_condition` with those names and a `coordinator` of `"and"` or `"or"`.
3. Call `apply_condition_to_page` on the target page.

### Output

The saved JSON is a valid Defra Forms v2 definition that can be imported directly into the forms designer. A `Check your answers` summary page is appended automatically if not already present.

## Skills

The repo ships two agent skills that drive the server for you:

| Skill | What it does |
|---|---|
| `/convert-form` | Converts an existing document form (PDF, Word, ODT, HTML, image scan) into a Defra Forms V2 definition, applying GDS design principles — one thing per page, conditional questions, postcode lookup for UK addresses, repeating pages for repeated answer sets |
| `/update-forms-mcp` | Syncs this server with the latest `forms-designer` schema — diffs the model package against this project's types, state and tools, then adds any new question types, component options, page controllers and condition capabilities |

`/convert-form` takes a filename or path. A bare filename resolves against
`forms_to_convert/`, and the result is saved to `converted_forms/`:

```
/convert-form myForm.docx
```

Both directories are gitignored — create `forms_to_convert/` and drop your source
documents in. `/update-forms-mcp` expects a `forms-designer` checkout at
`../forms-designer`, and will ask for the path if it can't find one.

### Where the skills live

The skills are in `.agents/skills/`, the vendor-neutral [Agent Skills](https://agentskills.io)
convention that Codex, Gemini CLI, Copilot and others read. `.claude/skills` is a
symlink to that directory so the skills also work with Claude Code.

## Development

```bash
# Run directly without building
npm run dev

# Rebuild after changes
npm run build
```
