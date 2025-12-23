#!/bin/bash

# ============================================================================
# Mini-Redis Startup Script
# ============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
C_ENGINE_DIR="$PROJECT_DIR/engine"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                     Mini-Redis Startup                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    
    if [ ! -z "$ENGINE_PID" ]; then
        kill $ENGINE_PID 2>/dev/null || true
        echo "  - C Engine stopped"
    fi
    
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
        echo "  - Node.js Backend stopped"
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
        echo "  - Frontend Server stopped"
    fi
    
    echo -e "${GREEN}Goodbye!${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Build C Engine
echo -e "${YELLOW}Building C Engine...${NC}"
cd "$C_ENGINE_DIR"
make clean > /dev/null 2>&1 || true
make
echo -e "${GREEN}✓ C Engine built successfully${NC}\n"

# Start C Engine
echo -e "${YELLOW}Starting C Engine on port 6379...${NC}"
./mini-redis 6379 &
ENGINE_PID=$!
sleep 1

if ps -p $ENGINE_PID > /dev/null; then
    echo -e "${GREEN}✓ C Engine running (PID: $ENGINE_PID)${NC}\n"
else
    echo -e "${RED}✗ Failed to start C Engine${NC}"
    exit 1
fi

# Start Node.js Backend
echo -e "${YELLOW}Starting Node.js Backend on port 3001...${NC}"
cd "$BACKEND_DIR"
node server.js &
BACKEND_PID=$!
sleep 1

if ps -p $BACKEND_PID > /dev/null; then
    echo -e "${GREEN}✓ Node.js Backend running (PID: $BACKEND_PID)${NC}\n"
else
    echo -e "${RED}✗ Failed to start Node.js Backend${NC}"
    cleanup
fi

# Start Frontend Server (optional)
echo -e "${YELLOW}Starting Frontend Server on port 8080...${NC}"
cd "$FRONTEND_DIR"
python3 -m http.server 8080 &
FRONTEND_PID=$!
sleep 1

if ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}✓ Frontend Server running (PID: $FRONTEND_PID)${NC}\n"
else
    echo -e "${YELLOW}⚠ Frontend server failed (you can still open dashboard.html directly)${NC}\n"
    FRONTEND_PID=""
fi

# Display status
echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    Services Running                           ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║  C Engine:        localhost:6379 (TCP)                        ║"
echo "║  Node.js API:     http://localhost:3001                       ║"
echo "║  Dashboard:       http://localhost:8080/dashboard.html        ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║  Press Ctrl+C to stop all services                            ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Quick test
echo -e "${YELLOW}Running quick test...${NC}"
sleep 1
PING_RESULT=$(echo "PING" | nc -q 1 localhost 6379 2>/dev/null || echo "FAILED")
if [ "$PING_RESULT" = "PONG" ]; then
    echo -e "${GREEN}✓ C Engine responding: PONG${NC}"
else
    echo -e "${RED}✗ C Engine not responding${NC}"
fi

HEALTH_RESULT=$(curl -s http://localhost:3001/api/health 2>/dev/null | grep -o '"redis":"connected"' || echo "FAILED")
if [ "$HEALTH_RESULT" = '"redis":"connected"' ]; then
    echo -e "${GREEN}✓ Node.js API connected to C Engine${NC}"
else
    echo -e "${RED}✗ Node.js API not connected${NC}"
fi

echo -e "\n${GREEN}All systems ready!${NC}\n"

# Wait for processes
wait
