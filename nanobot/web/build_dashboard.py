"""
Build script for nanobot web dashboard
Compiles the React frontend to the dist directory
"""

import subprocess
import sys
from pathlib import Path


def build_dashboard():
    """Build the React dashboard"""

    # Paths
    repo_root = Path(__file__).parent.parent.parent.parent
    dashboard_dir = repo_root / "nanobot" / "web" / "dashboard"

    print(f"Repository root: {repo_root}")
    print(f"Dashboard directory: {dashboard_dir}")

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

    # Verify build output
    dist_dir = dashboard_dir / "dist"
    if dist_dir.exists():
        print("\n✓ Dashboard built successfully!")
        print("Start the gateway to access the dashboard:")
        print("  nanobot gateway")
        print("\nThen open your browser to:")
        print("  http://localhost:8080/")
    else:
        print("Error: Build failed - dist directory not found")
        sys.exit(1)


if __name__ == "__main__":
    build_dashboard()
