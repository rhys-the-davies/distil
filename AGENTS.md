<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Environment variables
Do not read, reference, or include the contents of `.env.local` in any response. If you need to reference environment variables, use the variable name only (e.g. `ANTHROPIC_API_KEY`) — never the value.
