#!/bin/sh
set -e

cd backend
uv sync --frozen --no-dev
