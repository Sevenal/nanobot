"""
Build script for nanobot web dashboard
Compiles the React frontend and copies assets to the static directory
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path


def build_dashboard():
    """Build the React dashboard and copy assets to static directory"""

    # Paths
    repo_root = Path(__file__).parent.parent.parent.parent
    dashboard_dir = repo_root / "nanobot" / "web" / "dashboard"
    static_dir = repo_root / "nanobot" / "web" / "static"

    print(f"Repository root: {repo_root}")
    print(f"Dashboard directory: {dashboard_dir}")
    print(f"Static directory: {static_dir}")

    if not dashboard_dir.exists():
        print("Error: Dashboard directory not found!")
        print(f"Expected: {dashboard_dir}")
        sys.exit(1)

    # Check if npm/node is available
    try:
        subprocess.run(["npm", "--version"], check=True, capture_output=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Error: npm not found. Please install Node.js from https://nodejs.org/")
        sys.exit(1)

    # Install dependencies if needed
    node_modules = dashboard_dir / "node_modules"
    if not node_modules.exists():
        print("Installing npm dependencies...")
        subprocess.run(
            ["npm", "install"],
            cwd=dashboard_dir,
            check=True
        )

    # Build the frontend
    print("Building dashboard...")
    subprocess.run(
        ["npm", "run", "build"],
        cwd=dashboard_dir,
        check=True
    )

    # Create static directory if it doesn't exist
    static_dir.mkdir(parents=True, exist_ok=True)

    # Copy built assets to static directory
    dist_dir = dashboard_dir / "dist"
    if dist_dir.exists():
        # Remove old dashboard assets
        for item in (static_dir / "dashboard").glob("*") if (static_dir / "dashboard").exists() else []:
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()

        # Copy new assets
        target_dir = static_dir / "dashboard"
        target_dir.mkdir(exist_ok=True)

        for item in dist_dir.iterdir():
            dest = target_dir / item.name
            if item.is_dir():
                shutil.copytree(item, dest, dirs_exist_ok=True)
            else:
                shutil.copy2(item, dest)

        print(f"✓ Dashboard assets copied to {target_dir}")
    else:
        print("Error: Build failed - dist directory not found")
        sys.exit(1)

    print("\n✓ Dashboard built successfully!")
    print(f"Access it at: http://localhost:8080/dashboard")


if __name__ == "__main__":
    build_dashboard()
