System Architecture Overview
Tech stack: 

Programming language: preferabbly Deno.js everywhere where possible (no TypeScript, pure JavaScript), coding guidelines in [](coding_guidelines.md)
executables can be used (ffmpeg, custom pytho scripts )
database: SQLite database for persistence
Client: Vue JavaScript + VueJS (only compositions API) + HTML
communcation: WebSocket for real-time client-server communication
testing: 
client UI smoke tests
server side code: denojs test scripts
server side executables: test directly over CLI

deno task commands:
use 'deno task start' as a general way to start the app. this should also install dependencies like (ffmpeg and other) if they are not yet installed. it should also download testdata if the app needs some data for testing (videos, images, other data)
'deno task rmdb' should clean the database 

Imporant GUI things to consider: 
see also [](UI.md)
The browser is a Pure GUI layer only: All data filtering, calculation, and business logic on server
The browser is not limited by its functionalities, it can access (theoretically everything) with a websocket message
do not rely on browser limitated function like using the html file browser, prefer to create a custom file browser with 'ls' executable on the server. 


CODING GUIDELINES: please adhere to the coding guidelines , they are very important


Communication Standards
Server <-> Client:

WebSocket with custom messages
Standardized message format for all operations
Real-time bidirectional communication


Server <-> Executables:
All external executables (ffmpeg, Python scripts, etc.) MUST be called through a standardized interface
Streams required for ALL process inputs and outputs
No argument list limits (use stdin for large data)
No blocking reads (stream processing only)
JSON for structured data between processes

Executable Call Standard
javascript
// Standardized executable call signature
function runExecutable(executablePath, args, inputStream, outputStream) {
  // All executables follow this pattern:
  // 1. stdin for input (stream)
  // 2. stdout for output (stream)  
  // 3. stderr for debug/logging
  // 4. JSON messages newline-delimited
}
Requirements:

All executable calls use Deno.Command().spawn() (streaming)
Never use .output() (blocks, limited buffers)
Always stream stdin/stdout/stderr
Use newline-delimited JSON for structured messages
Support bidirectional streaming where needed
Message Format Standards
WebSocket messages:

json
{
  "s_type": "message_type",
  "v_data": { /* payload */ },
  "n_ts_ms": 1782736076770
}
Process-to-Process messages:

One JSON object per line

Newline delimited (\n)

UTF-8 encoding

stderr reserved for human-readable logs

Data Flow Principles
Client sends request → Server processes

Server calls executables via streams

Stream processing for large data

No blocking operations anywhere

Functional composition over inheritance

Example Flow
text
Client WebSocket → Deno Server → Python Script (stdin stream)
                                      ↓
Client ← WebSocket ← Deno Server ← Python Script (stdout stream)



# licensing 
see [](licensind.md)



CODING RULES: please adhere to the coding guidelines , they are very important