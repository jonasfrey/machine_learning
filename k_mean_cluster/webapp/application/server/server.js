// Copyright (C) 2026 Jonas Immanuel Frey - Licensed under MIT. See LICENSE file for details

import { f_o_db, f_init_schema } from './db.js';
import { f_handle_message, f_o_state, f_o_msg } from './handlers.js';

let n_port = Number(Deno.env.get('PORT') || 8000);
let s_dir__client = new URL('../client', import.meta.url).pathname;

let o_db = f_o_db();
f_init_schema(o_db);

// every connected browser tab; broadcasts fan out to all of them.
let a_socket = new Set();

let o_mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

let f_response__static = async function (s_pathname) {
  let s_rel = s_pathname == '/' ? '/index.html' : s_pathname;
  let s_path = s_dir__client + s_rel;
  try {
    let a_nu8 = await Deno.readFile(s_path);
    let s_ext = s_rel.slice(s_rel.lastIndexOf('.'));
    return new Response(a_nu8, {
      headers: { 'content-type': o_mime[s_ext] || 'application/octet-stream' },
    });
  } catch {
    return new Response('not found', { status: 404 });
  }
};

let f_handle_request = function (o_request) {
  let o_url = new URL(o_request.url);

  if (o_url.pathname == '/ws') {
    let { socket, response } = Deno.upgradeWebSocket(o_request);
    socket.addEventListener('open', () => {
      a_socket.add(socket);
      socket.send(JSON.stringify(f_o_msg('state', f_o_state(o_db))));
    });
    socket.addEventListener('message', (o_evt) => {
      f_handle_message(o_db, a_socket, socket, o_evt.data);
    });
    socket.addEventListener('close', () => a_socket.delete(socket));
    socket.addEventListener('error', () => a_socket.delete(socket));
    return response;
  }

  return f_response__static(o_url.pathname);
};

console.log(`[server] listening on http://localhost:${n_port}`);
Deno.serve({ port: n_port }, f_handle_request);
