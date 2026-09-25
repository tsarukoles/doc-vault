import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkedPath, ignorePlan, readBytes, sha256 } from './security.mjs';

const OMIT_DIRECTORIES = new Set(['.git', '.claude', '.hg', '.svn', 'node_modules', '.venv', 'venv', '__pycache__', '.pytest_cache', '.mypy_cache', '.next', '.nuxt', 'coverage', '.turbo', '.cache', 'dist', 'build', 'vendor', '.idea']);
const TEXT_EXTENSIONS = new Set(['.js','.jsx','.ts','.tsx','.mjs','.cjs','.py','.java','.kt','.go','.rs','.c','.h','.cpp','.cs','.rb','.php','.sh','.ps1','.bat','.cmd','.sql','.r','.scala','.swift','.vue','.svelte','.html','.css','.scss','.json','.jsonc','.yaml','.yml','.toml','.ini','.cfg','.conf','.xml','.tf','.tfvars','.hcl','.csv','.tsv','.txt','.md','.mdx','.rst','.properties','.graphql','.gql','.proto','.feature','.lock','.gitignore','.editorconfig']);
const SECRET_FILE = /(^|\/)(?:\.env(?:\..*)?|credentials(?:\.[^/]*)?|secrets?(?:\.[^/]*)?|id_(?:rsa|ed25519)|[^/]*\.(?:pem|key|p12|pfx)|[^/]*\.tfstate(?:\..*)?)$/i;
const SECRET_CONTENT = /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\b(?:password|api[_-]?key|client[_-]?secret|access[_-]?token|secret[_-]?access[_-]?key)\s*[:=]\s*["']([^"'\r\n]{12,})["']/i;

export function gitRead(root, args, input) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  env.GIT_OPTIONAL_LOCKS = '0';
  env.GIT_TERMINAL_PROMPT = '0';
  try {
    return execFileSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '-C', root, ...args], {
      env, input, encoding: 'utf8', timeout: 10000, maxBuffer: 8 * 1024 * 1024, windowsHide: true, stdio: ['pipe','pipe','pipe']
    });
  } catch (error) {
    if (args[0] === 'check-ignore' && error.status === 1) return typeof error.stdout === 'string' ? error.stdout : '';
    return null;
  }
}

export function gitState(root) {
  return { head: gitRead(root, ['rev-parse', '--verify', 'HEAD'])?.trim() || null,
    branch: gitRead(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'])?.trim() || null };
}

export function assertUntrackedVault(root, vaultName) {
  const tracked = gitRead(root, ['ls-files', '-z', '--', vaultName]);
  if(tracked===null&&hasGitMetadata(root))throw new Error('Git metadata is present but cannot be inspected. Restore Git access before generating a vault.');
  if (tracked?.length) throw new Error('The vault contains tracked files. Choose an untracked vault directory before generating.');
}

export function ignoreDiagnostics(root, vaultName) {
  const plan = ignorePlan(root, vaultName);
  const repositoryRoot = path.resolve(root);
  const gitRoot = gitRead(root, ['rev-parse', '--show-toplevel'])?.trim() || null;
  const targets = [`${vaultName}/`, '.claude/'];
  const outputPaths = Object.fromEntries(targets.map(target => [target, path.join(repositoryRoot, target)]));
  const trackedClaude = gitRoot ? gitRead(root, ['ls-files', '-z', '--', '.claude']) : null;
  const trackedVault = gitRoot ? gitRead(root, ['ls-files', '-z', '--', vaultName]) : null;
  const trackedClaudeFiles = trackedClaude?.split('\0').filter(Boolean) || [];
  const trackedVaultFiles = trackedVault?.split('\0').filter(Boolean) || [];
  // --no-index separates effective ignore rules from tracking: a tracked file
  // can match a rule while remaining tracked, which is reported independently.
  const matches = gitRoot ? gitRead(root, ['check-ignore', '--no-index', '--verbose', '--non-matching', '-z', '--stdin'], `${targets.join('\0')}\0`) : null;
  const effectiveRules = targets.map(target => ({ path: target, absolute_path: outputPaths[target], ignored: null, source: null, line: null, pattern: null }));
  if (matches !== null) {
    const fields = matches.split('\0');
    for (let index = 0; index + 3 < fields.length; index += 4) {
      const [source, line, pattern, target] = fields.slice(index, index + 4);
      const result = effectiveRules.find(item => item.path === target);
      if (result) Object.assign(result, { ignored: Boolean(pattern) && !pattern.startsWith('!'), source: source || null, line: line ? Number(line) : null, pattern: pattern || null });
    }
  }
  const inspected = Boolean(gitRoot && trackedClaude !== null && trackedVault !== null && effectiveRules.every(item => item.ignored !== null));
  const warnings = [];
  if (plan.missingRules.length) warnings.push(`Required root ignore rules need repair: ${plan.missingRules.join(', ')}. Run build or sync.`);
  if (!gitRoot && !hasGitMetadata(root)) warnings.push('This folder is not in an inspectable Git worktree. Ignore rules can be maintained, but Git ignore verification is unavailable.');
  else if (!inspected) warnings.push('Git metadata could not be fully inspected; generated output ignore protection is unverified. Restore Git access before generating a vault.');
  for (const item of effectiveRules) if (item.ignored === false) warnings.push(`Git does not ignore ${item.absolute_path}. Check the project root and effective ignore rules; a matching line in a different .gitignore is not sufficient.`);
  if (trackedVaultFiles.length) warnings.push(`${trackedVaultFiles.length} vault files are already tracked. Ignore rules do not untrack them; choose an untracked vault directory or review tracking manually.`);
  if (trackedClaudeFiles.length) warnings.push(`${trackedClaudeFiles.length} .claude files are already tracked. Ignore rules do not untrack them; review this manually.`);
  return { gitignore_exists:plan.exists, required_rules:plan.requiredRules, missing_rules:plan.missingRules,
    repository_root:repositoryRoot, git_root:gitRoot, output_paths:outputPaths, effective_rules:effectiveRules,
    tracked_vault_files:trackedVaultFiles, tracked_claude_files:trackedClaudeFiles,
    git_available:Boolean(gitRoot), git_verified:inspected && effectiveRules.every(item => item.ignored) && !trackedVaultFiles.length,
    warnings };
}

export function assertIgnoredOutputs(root, vaultName) {
  const diagnostics = ignoreDiagnostics(root, vaultName);
  if (!diagnostics.git_available && !hasGitMetadata(root)) return diagnostics;
  if (diagnostics.tracked_vault_files.length) {
    throw new Error(`The vault contains tracked files at ${diagnostics.output_paths[`${vaultName}/`]}. Ignore rules do not untrack files. Choose an untracked vault directory before generating.`);
  }
  if (!diagnostics.git_verified) {
    throw new Error(`Git ignore protection could not be verified for generated outputs in ${diagnostics.repository_root}. ${diagnostics.warnings.join(' ')}`);
  }
  return diagnostics;
}

function hasGitMetadata(root) {
  let current=root;
  while(true) {
    if(fs.existsSync(path.join(current,'.git')))return true;
    const parent=path.dirname(current);
    if(parent===current)return false;
    current=parent;
  }
}

function classify(file) {
  const ext = path.posix.extname(file).toLowerCase();
  const name = path.posix.basename(file).toLowerCase();
  if (/^readme(?:\.|$)/i.test(name) || ['.md','.mdx','.rst'].includes(ext)) return { kind:'document', language:'markdown', status:'reference' };
  if (ext === '.xlsx') return { kind:'spreadsheet', language:'xlsx', status:'included' };
  if (['.csv','.tsv'].includes(ext)) return { kind:'data', language:ext.slice(1), status:'included' };
  if (/^\.github\/workflows\//.test(file) || /(?:^|\/)(?:jenkinsfile|\.gitlab-ci.yml)$/i.test(file)) return {kind:'ci',language:ext.slice(1) || 'text',status:'included'};
  if (['.tf','.tfvars','.hcl'].includes(ext) || /(?:^|\/)(?:dockerfile|compose\.ya?ml)$/i.test(file)) return {kind:'infra',language:ext.slice(1) || 'docker',status:'included'};
  if (/(?:^|\/)(?:test[s]?|specs?)(?:\/|\.)|(?:\.test\.|\.spec\.|^test_)/i.test(file)) return {kind:'test',language:ext.slice(1) || 'text',status:'included'};
  if (['.yaml','.yml','.json','.jsonc','.toml','.ini','.cfg','.conf','.properties','.xml','.lock'].includes(ext) || name.startsWith('.')) return {kind:'config',language:ext.slice(1) || 'text',status:'included'};
  if (TEXT_EXTENSIONS.has(ext) || /^(?:dockerfile|jenkinsfile|makefile|justfile|procfile|license|notice)$/i.test(name)) return {kind:'source',language:ext.slice(1) || 'text',status:'included'};
  return { kind:'unknown',language:ext.slice(1) || 'unknown',status:'unsupported' };
}

export function inventory(root, vaultName, {maxFiles=20000, maxBytes=2*1024*1024}={}) {
  const records = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir ? checkedPath(root,dir) : root, {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const file = dir ? `${dir}/${entry.name}` : entry.name;
      if (file === vaultName) continue;
      if (records.length >= maxFiles) throw new Error(`Repository exceeds the ${maxFiles}-entry inventory limit. No partial scan was published.`);
      const base = {id:`f_${sha256(file).slice(0,16)}`,path:file,sha256:null,size:0,kind:'unknown',language:'unknown',status:'excluded'};
      let absolute;
      try { absolute=checkedPath(root,file); }
      catch { records.push({...base,reason:'Link, junction, or unsupported path; not followed.'}); continue; }
      if (entry.isDirectory()) {
        if (OMIT_DIRECTORIES.has(entry.name) || entry.name === '.aws' || entry.name === '.ssh') records.push({...base,kind:'directory',reason:'Dependency, generated, private, or metadata subtree; not enumerated.'});
        else walk(file);
        continue;
      }
      if (!entry.isFile()) { records.push({...base,reason:'Non-regular file; not inspected.'}); continue; }
      if(entry.name==='.git'||entry.name==='.claude') {records.push({...base,kind:'metadata',reason:'Git or agent metadata; not a documentation source.'});continue;}
      const stat = fs.lstatSync(absolute);
      const record = {...base,...classify(file),size:stat.size};
      if (SECRET_FILE.test(file) && !/\.env\.(?:example|sample|template)$/i.test(file)) { records.push({...record,status:'excluded',reason:'Sensitive filename policy.'}); continue; }
      if (stat.size > maxBytes) { records.push({...record,modified_at:stat.mtimeMs,status:'unsupported',reason:`Above ${maxBytes} bytes; contents not inspected. Size and modification time only.`}); continue; }
      if (record.status==='unsupported') {
        try { record.sha256=sha256(readBytes(root,file,maxBytes)); } catch { record.modified_at=stat.mtimeMs; }
        records.push({...record,reason:'No registered reader for this file format; bounded content fingerprint only.'}); continue;
      }
      try {
        const bytes=readBytes(root,file,maxBytes);
        record.sha256=sha256(bytes);
        if (record.language==='xlsx') record.bytes=bytes;
        else {
          if (bytes.includes(0)) {records.push({...record,status:'unsupported',reason:'Binary content in a textual file.'}); continue;}
          record.text=bytes.toString('utf8');
          if (SECRET_CONTENT.test(record.text)) { delete record.text; record.status='excluded'; record.reason='Potential credential material detected; content withheld.'; }
        }
        records.push(record);
      } catch { records.push({...record,status:'error',reason:'Reader could not inspect this file.'}); }
    }
  };
  walk('');
  const candidates=records.filter(r=>['included','reference'].includes(r.status));
  const ignored=gitRead(root,['check-ignore','--stdin','-z'],candidates.map(r=>r.path).join('\0')+(candidates.length?'\0':''));
  if(ignored===null&&hasGitMetadata(root))throw new Error('Git ignore rules could not be inspected; no source snapshot was published.');
  if (ignored) {
    const names=new Set(ignored.split('\0').filter(Boolean));
    for(const record of records) if(names.has(record.path)) {
      record.status='excluded';record.reason='Ignored by Git.';delete record.text;delete record.bytes;
    }
  }
  return records;
}

export function identityAndChanges(records, previous=[]) {
  const old=new Map(previous.map(r=>[r.path,r]));
  const now=new Map(records.map(r=>[r.path,r]));
  const deleted=previous.filter(r=>!now.has(r.path));
  const added=records.filter(r=>!old.has(r.path));
  const changes={added:[],modified:[],deleted:[],renamed:[]};
  const consumed=new Set();
  for (const record of records) {
    const before=old.get(record.path);
    if(before) {
      record.id=before.id;
      if(record.sha256!==before.sha256 || record.status!==before.status || record.size!==before.size || record.reason!==before.reason || record.modified_at!==before.modified_at) changes.modified.push(record.path);
    }
  }
  for(const record of added) {
    const matches=deleted.filter(r=>r.sha256 && r.sha256===record.sha256 && r.status===record.status && !consumed.has(r.path));
    const newMatches=added.filter(r=>r.sha256 && r.sha256===record.sha256);
    if(matches.length===1 && newMatches.length===1) {
      record.id=matches[0].id;consumed.add(matches[0].path);changes.renamed.push({from:matches[0].path,to:record.path});
    } else changes.added.push(record.path);
  }
  changes.deleted=deleted.filter(r=>!consumed.has(r.path)).map(r=>r.path);
  return changes;
}

export const stripContent = records => records.map(({text,bytes,...record})=>record);
export const inventoryDigest = records => sha256(JSON.stringify(stripContent(records)));
