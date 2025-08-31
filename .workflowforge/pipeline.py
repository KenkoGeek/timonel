#!/usr/bin/env python3
"""
Generate GitHub Actions workflows using the WorkflowForge library.
No fallbacks. Requires `workflowforge` to be installed.
"""

from pathlib import Path
import sys

from workflowforge import github_actions as gha  # type: ignore


def main() -> None:
    if sys.version_info < (3, 11):
        raise SystemExit("workflowforge requires Python >= 3.11. Please run with Python 3.11+.")
    repo_root = Path(__file__).resolve().parents[1]
    out_dir = repo_root / ".github" / "workflows"
    out_dir.mkdir(parents=True, exist_ok=True)

    # CI workflow with pnpm/yarn matrix
    ci = gha.workflow(
        name="CI",
        on=[
            gha.on_push(branches=["main"]),
            gha.on_pull_request(branches=["main"]),
        ],
    )

    build_job = gha.job(
        runs_on="ubuntu-latest",
        strategy=gha.strategy(matrix=gha.matrix(**{"node-version": [22, 20]})),
    )
    build_job.add_step(gha.action("actions/checkout@v4"))
    build_job.add_step(
        gha.action(
            "actions/setup-node@v4",
            with_={"node-version": "${{ matrix.node-version }}"},
        )
    )
    build_job.add_step(
        gha.run(
            """
            corepack enable
            corepack prepare pnpm@latest --activate
            """.strip()
        )
    )
    build_job.add_step(
        gha.run("pnpm install --frozen-lockfile=false")
    )
    for cmd in ["typecheck", "lint", "security:lint", "build", "format:check"]:
        build_job.add_step(gha.run(f"pnpm run {cmd}"))
    ci.add_job("build", build_job)

    audit_job = gha.job(
        runs_on="ubuntu-latest",
    )
    audit_job.add_step(gha.action("actions/checkout@v4"))
    audit_job.add_step(gha.action("actions/setup-node@v4", with_={"node-version": 22}))
    audit_job.add_step(
        gha.run(
            """
            corepack enable
            corepack prepare pnpm@latest --activate
            """.strip()
        )
    )
    audit_job.add_step(gha.run("pnpm install --frozen-lockfile=false"))
    audit_job.add_step(gha.run("pnpm audit --audit-level=moderate || true"))
    ci.add_job("audit", audit_job)

    ci.save(str(out_dir / "ci.yml"), generate_readme=False, generate_diagram=False)

    # CodeQL workflow
    codeql = gha.workflow(
        name="CodeQL",
        on=[
            gha.on_push(branches=["main"]),
            gha.on_pull_request(branches=["main"]),
            gha.on_schedule(cron="17 8 * * 4"),
        ],
    )
    analyze = gha.job(
        runs_on="ubuntu-latest",
        strategy=gha.strategy(matrix=gha.matrix(language=["javascript-typescript"])),
    )
    analyze.add_step(gha.action("actions/checkout@v4", name="Checkout repository"))
    analyze.add_step(
        gha.action(
            "github/codeql-action/init@v3",
            name="Initialize CodeQL",
            with_={"languages": "${{ matrix.language }}"},
        )
    )
    analyze.add_step(gha.action("github/codeql-action/autobuild@v3", name="Autobuild"))
    analyze.add_step(gha.action("github/codeql-action/analyze@v3", name="Perform CodeQL Analysis"))
    codeql.add_job("analyze", analyze)

    codeql.save(str(out_dir / "codeql.yml"), generate_readme=False, generate_diagram=False)

    # Publish to npm on tags v*
    publish = gha.workflow(
        name="Publish npm",
        on=[
            gha.on_push(tags=["v*"]),
        ],
    )

    publish_job = gha.job(
        runs_on="ubuntu-latest",
        permissions={"contents": "read", "id-token": "write"},
    )
    publish_job.add_step(gha.action("actions/checkout@v4", name="Checkout"))
    publish_job.add_step(
        gha.action(
            "actions/setup-node@v4",
            name="Setup Node.js",
            with_={"node-version": 20, "registry-url": "https://registry.npmjs.org"},
        )
    )
    publish_job.add_step(
        gha.run(
            """
            corepack enable
            corepack prepare pnpm@latest --activate
            """.strip(),
            name="Enable Corepack and pnpm",
        )
    )
    publish_job.add_step(gha.run("pnpm install --frozen-lockfile=false", name="Install dependencies"))
    publish_job.add_step(
        gha.run(
            """
            pnpm run typecheck
            pnpm run lint
            """.strip(),
            name="Lint and typecheck",
        )
    )
    publish_job.add_step(gha.run("pnpm run build", name="Build"))
    publish_job.add_step(
        gha.run(
            """
            PKG_VERSION=$(node -p "require('./package.json').version")
            TAG_NAME="${GITHUB_REF_NAME}"
            echo "package.json: v${PKG_VERSION} | tag: ${TAG_NAME}"
            if [ "v${PKG_VERSION}" != "${TAG_NAME}" ]; then
              echo "Tag and package.json version mismatch" >&2
              exit 1
            fi
            """.strip(),
            name="Verify tag matches package.json version",
        )
    )
    publish_job.add_step(
        gha.run(
            """
            echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
            npm publish --access public --provenance
            """.strip(),
            name="Publish to npm (with provenance)",
            env={"NPM_TOKEN": "${{ secrets.NPM_TOKEN }}"},
        )
    )

    publish.add_job("publish", publish_job)
    publish.save(str(out_dir / "publish.yml"), generate_readme=False, generate_diagram=False)


if __name__ == "__main__":
    main()
