#!/bin/bash
set -e
uv sync --frozen --no-dev --no-install-project
echo "Dependencies installed successfully"
#!/bin/bash
set -e
uv sync --frozen --no-dev --no-install-project
#!/bin/bash
set -e

# Install dependencies using uv
/usr/local/bin/uv sync --frozen --no-dev --no-install-project || uv sync --frozen --no-dev --no-install-project

# Make script echo what it's doing for debugging
echo "Dependencies installed successfully"