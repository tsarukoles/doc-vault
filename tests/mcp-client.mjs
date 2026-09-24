import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export async function mcpClient(t, root, { cwd = fileURLToPath(new URL('../', import.meta.url)), vaultName = 'edw-doc', clientInfo = { name: 'claude-code', version: '2.1.199' } } = {}) {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/mcp.mjs', import.meta.url))], {
    cwd, env: { ...process.env, DOC_VAULT_ROOT: root, DOC_VAULT_NAME: vaultName }, windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let sequence = 0, buffer = '', stderr = '';
  const pending = new Map();
  child.stderr.on('data', chunk => { stderr += chunk; });
  const fail = error => { for (const { reject, timeout } of pending.values()) { clearTimeout(timeout); reject(error); } pending.clear(); };
  child.on('error', fail);
  child.on('exit', code => fail(new Error(`MCP exited ${code}: ${stderr}`)));
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      try {
        const message = JSON.parse(line);
        const waiter = pending.get(message.id);
        if (!waiter) continue;
        clearTimeout(waiter.timeout); pending.delete(message.id); waiter.resolve(message);
      } catch (error) { fail(error); }
    }
  });
  t.after(() => { child.stdin.end(); child.kill(); });
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`MCP timeout: ${method}: ${stderr}`)); }, 15000);
    pending.set(id, { resolve, reject, timeout });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  const initialized = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo });
  return { initialized, request,
    call: async (name, args = {}) => (await request('tools/call', { name, arguments: args })).result,
    notify: (method, params) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'),
  };
}
