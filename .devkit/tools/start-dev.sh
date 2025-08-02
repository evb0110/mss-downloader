#!/bin/bash

# Start development environment
echo "Starting MSS Downloader development environment..."

# Build workers first
echo "Building workers..."
npm run build:workers
mkdir -p dist/workers
cp workers-dist/pdf-worker.js dist/workers/

# Start Vite dev server in background
echo "Starting Vite dev server..."
npm run dev:renderer:watch &
VITE_PID=$!

# Wait a bit for Vite to start
sleep 3

# Start Electron
echo "Starting Electron..."
npm run dev:main

# When Electron exits, kill Vite
kill $VITE_PID 2>/dev/null