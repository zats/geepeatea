# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 starter application for the OpenAI Responses API. It provides a chat interface with multi-turn conversation handling, tool integration (web search, file search, function calling, code interpreter), and streaming responses.

## Development Commands

- **Development server**: `npm run dev` (runs on http://localhost:3000)
- **Build**: `npm run build`
- **Production server**: `npm start`
- **Linting**: `npm run lint`

Note: This project uses npm/npm-lock.json (not pnpm despite user preference).

## Architecture Overview

### Core Components
- **Chat Interface**: `components/chat.tsx` - Main chat UI with message rendering and input handling
- **Assistant Logic**: `lib/assistant.ts` - Core conversation processing with streaming support
- **State Management**: `stores/useConversationStore.ts` (Zustand) - Conversation state and message versioning
- **API Route**: `app/api/turn_response/route.ts` - OpenAI Responses API integration with SSE streaming

### Tools System
- **Tools Configuration**: `config/tools-list.ts` and `lib/tools/tools.ts`
- **Supported Tools**: Web search, file search, code interpreter, function calling, MCP (Model Context Protocol)
- **Tool State**: `stores/useToolsStore.ts` - Tool configuration and settings

### Key Features
- **Message Versioning**: Support for annotations and message editing with version history
- **Streaming**: Real-time response streaming with SSE (Server-Sent Events)
- **Tool Integration**: Multiple built-in tools with dynamic configuration
- **Responsive UI**: Mobile-friendly with collapsible tools panel

### File Structure
- `app/` - Next.js app directory with pages and API routes
- `components/` - React components including UI components from shadcn/ui
- `lib/` - Core business logic and utilities
- `stores/` - Zustand state management
- `config/` - Configuration files (constants, tools, functions)

## Configuration

- **Model**: Set in `config/constants.ts` (currently "o3")
- **API Key**: Set `OPENAI_API_KEY` environment variable
- **Developer Prompt**: Customizable assistant behavior in `config/constants.ts`

## Message Flow

1. User input → `chat.tsx` → `processMessages()` in `assistant.ts`
2. API call to `/api/turn_response` → OpenAI Responses API
3. Streaming response via SSE → Update UI components
4. Tool calls executed client-side for functions, server-side for built-in tools

## TypeScript Configuration

- Uses strict TypeScript with Next.js config
- ESLint config disables `@typescript-eslint/no-explicit-any` for flexibility with OpenAI API responses
- Custom types for conversation items, tool calls, and message versioning