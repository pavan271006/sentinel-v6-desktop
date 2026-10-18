@echo off
title Sentinel Sovereign MCP Server
cd /d "%~dp0"
echo [Sentinel] Starting Sentinel Sovereign MCP Server (stdio)...
npx tsx scripts/sentinel_mcp_server.ts
