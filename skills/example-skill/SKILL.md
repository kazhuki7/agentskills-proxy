---
name: example-skill
description: "An example skill demonstrating the framework capabilities. Use when testing skill execution with JavaScript, Python, or Shell scripts."
version: "1.0.0"
author: "Framework Team"
license: "MIT"
tags:
  - example
  - demo
  - testing
allowed-tools:
  - Bash
  - Read
  - Write
parameters:
  message:
    type: string
    required: false
    default: "Hello from skill!"
    description: "A custom message to include in the output"
  count:
    type: number
    required: false
    default: "3"
    description: "Number of times to repeat the message"
---

# Example Skill

This is an example skill that demonstrates the capabilities of the Skill Aggregation Framework.

## Overview

This skill includes example scripts in three languages:
- JavaScript (executed in VM2 sandbox)
- Python (executed as subprocess)
- Shell (executed as subprocess with command validation)

## Usage

Trigger this skill to test the execution engine. You can specify parameters to customize the output.

## Workflow

1. Call the desired script with parameters
2. The script will process the input
3. Output will be streamed back to the caller
4. Any generated files will be available as artifacts

## Scripts

### JavaScript (`scripts/hello.js`)
A simple JavaScript script that demonstrates sandbox execution and artifact creation.

### Python (`scripts/analyze.py`)
A Python script that performs text analysis and generates a JSON report.

### Shell (`scripts/process.sh`)
A shell script that demonstrates basic text processing.

## Examples

**JavaScript execution:**
```json
{
  "skill_id": "example-skill",
  "script_path": "scripts/hello.js",
  "script_type": "JAVASCRIPT",
  "parameters": {
    "message": "Hello World",
    "count": "5"
  }
}
```

**Python execution:**
```json
{
  "skill_id": "example-skill",
  "script_path": "scripts/analyze.py",
  "script_type": "PYTHON",
  "parameters": {
    "text": "This is sample text for analysis"
  }
}
```
