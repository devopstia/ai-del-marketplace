#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { delimiter } from 'node:path';
import { DelClient } from './client.js';
import { registerTools } from './tools.js';

/**
 * DevOps Easy Learning course MCP server (stdio). Configure with:
 *   DEL_API_URL       e.g. https://ai-devopseasylearning.com/api
 *   DEL_AGENT_TOKEN   a token from Super Admin › AI agents (scoped to one instructor, expires, revocable)
 *   DEL_UPLOAD_ROOTS  folders the instructor shared (separated by ":" on Linux/macOS, ";" on Windows)
 * docs/SUPPORT_SESSIONS_AND_AGENTS.md
 */
const url = process.env.DEL_API_URL ?? '';
const token = process.env.DEL_AGENT_TOKEN ?? '';
const roots = (process.env.DEL_UPLOAD_ROOTS ?? '').split(delimiter).map((s) => s.trim()).filter(Boolean);

const del = new DelClient(url, token, roots);
const server = new McpServer({ name: 'del-courses', version: '1.0.0' });
registerTools(server, del);
await server.connect(new StdioServerTransport());
