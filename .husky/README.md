# Husky Git Hooks

This directory contains Git hooks managed by Husky v9.

## Current Hooks

- `pre-commit`: Runs lint-staged, typecheck, security checks, and markdownlint
- `commit-msg`: Validates conventional commit format with required scopes

## Husky v10 Compatibility

Our hooks are already compatible with Husky v10 format. They do NOT use the deprecated pattern:

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
```

The `_/husky.sh` deprecation warning can be safely ignored as our hooks don't reference it.

When Husky v10 is released, no changes to our hooks will be required.

## Hook Format (v9 & v10 Compatible)

```sh
#!/usr/bin/env sh

# Direct commands without sourcing husky.sh
pnpm exec lint-staged || exit 1
```

This format works in both Husky v9 and v10.
