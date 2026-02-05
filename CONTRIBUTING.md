# Contributing to AgentSkills-Proxy

We welcome contributions to AgentSkills-Proxy! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Style Guides](#style-guides)

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to keep our community approachable and respectable.

## How Can I Contribute?

### Reporting Bugs

- Ensure the bug was not already reported by searching on GitHub under [Issues](https://github.com/yourusername/agentskills-proxy/issues)
- If you're unable to find an open issue addressing the problem, [open a new one](https://github.com/yourusername/agentskills-proxy/issues/new). Be sure to include:
  - A descriptive title and clear description
  - As much relevant information as possible
  - A code sample or an executable test case demonstrating the expected behavior that is not occurring

### Suggesting Enhancements

- Use a clear and descriptive title for the issue
- Provide a step-by-step description of the suggested enhancement in as many details as possible
- Describe the current behavior and explain which behavior you expected to see instead and why
- Explain why this enhancement would be useful to most AgentSkills-Proxy users

### Pull Requests

- Fill in the provided PR template
- Do not include issue numbers in the PR title
- Include screenshots and animated GIFs in your pull request when it makes sense
- Follow the [Style Guides](#style-guides)
- End all files with a newline

## Development Setup

1. Fork the repository
2. Clone your fork
3. Create a new branch for your feature or bug fix
4. Install dependencies: `npm install`
5. Build the project: `npm run build`
6. Run tests: `npm test` (if available)

## Pull Request Process

1. Update the README.md with details of changes to the interface
2. Increase the version numbers in any examples files and the README.md to the new version that this Pull Request would represent
3. Ensure all tests pass
4. Squash your commits (optional but preferred)

## Style Guides

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

### TypeScript Style Guide

- Follow the existing code style
- Use clear, descriptive variable and function names
- Include JSDoc comments for public methods
- Write unit tests for new code

### Documentation Style Guide

- Use Markdown for documentation
- Keep example code simple and clear
- Use the present tense ("this module returns" not "this module returned")

## Questions?

If you have any questions, feel free to reach out by opening an issue with the "question" tag.