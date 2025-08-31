# WorkflowForge Generator

This folder contains a Python-based generator intended to define and emit GitHub Actions workflows.

Note: This generator uses the Python library "workflowforge" to declare pipelines.

## Usage

1. Install Python deps (required; Python 3.11+):

```bash
python3.11 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
```

1. Generate workflows to `.github/workflows/`:

```bash
python3 pipeline.py
```

This outputs:

- `.github/workflows/ci.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/publish.yml`

## Notes

- The script requires `workflowforge` (from PyPI) and fails if it is missing.
- Keep this folder versioned so the pipeline definition lives close to the code.

### Troubleshooting

- Ensure your virtualenv is active and `pip show workflowforge` succeeds before running the generator.
