#!/usr/bin/env node
import { createEngine, VERSION } from '../src/engine.mjs';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { assertUntrackedVault, ignoreDiagnostics } from '../src/inventory.mjs';
import { checkedPath, ensureIgnore, readBytes, rootDirectory, validateVaultName } from '../src/security.mjs';
import { installIntegration, removeIntegration, integrationStatus } from '../src/integration.mjs';
import { ownsVault } from '../src/identity.mjs';

function migrateOwnedVault(rootInput, from, to) {
  const root=rootDirectory(rootInput);
  validateVaultName(from); validateVaultName(to);
  if(from===to)throw new Error('Migration source and destination must differ.');
  const source=checkedPath(root,from,{write:true});
  const destination=checkedPath(root,to,{allowMissing:true,write:true});
  if(fs.existsSync(destination))throw new Error('Migration destination already exists. Nothing was overwritten.');
  if(!fs.lstatSync(source).isDirectory())throw new Error('Migration source must be an owned vault directory.');
  const marker=JSON.parse(readBytes(source,'.system/owner.json',8192).toString('utf8'));
  if(!ownsVault(marker)||!Number.isInteger(marker.schema_version))throw new Error('Migration source has no recognized EDW Doc ownership marker.');
  for(const reserved of ['.system/write-lock.json','.system/pending.json']) {
    if(fs.existsSync(checkedPath(source,reserved,{allowMissing:true,write:true})))throw new Error('Migration refuses a vault with a writer lock or pending publication. Complete/recover it first.');
  }
  // The move preserves all bytes, including annotations. Refuse links and
  // special files anywhere so the migrated write boundary is still ordinary.
  let entries=0;
  const inspect=relative=>{
    const directory=relative?checkedPath(source,relative,{write:true}):source;
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
      if(++entries>100000)throw new Error('Vault exceeds the migration inspection limit.');
      const local=relative?`${relative}/${entry.name}`:entry.name;
      const absolute=checkedPath(source,local,{write:true});
      const stat=fs.lstatSync(absolute);
      if(stat.isDirectory())inspect(local);
      else if(!stat.isFile())throw new Error('Migration only permits ordinary directories and files.');
    }
  };
  inspect('');
  assertUntrackedVault(root,from); assertUntrackedVault(root,to);
  checkedPath(root,'.gitignore',{allowMissing:true,write:true});
  const lockRelative='.system/write-lock.json';
  const lockPath=checkedPath(source,lockRelative,{allowMissing:true,write:true});
  const token=crypto.randomBytes(16).toString('hex');
  const lock={host:os.hostname(),pid:process.pid,token,purpose:'vault-folder-migration'};
  fs.writeFileSync(lockPath,JSON.stringify(lock)+'\n',{flag:'wx',mode:0o600});
  let moved=false;
  try {
    // Ignore before moving: an interruption cannot leave generated output exposed.
    ensureIgnore(root,to);
    checkedPath(root,from,{write:true});
    if(fs.existsSync(checkedPath(root,to,{allowMissing:true,write:true})))throw new Error('Migration destination appeared while preparing the move.');
    fs.renameSync(source,destination);
    moved=true;
  } finally {
    const lockRoot=moved?destination:source;
    const current=JSON.parse(readBytes(lockRoot,lockRelative,8192).toString('utf8'));
    if(current.token===token)fs.unlinkSync(checkedPath(lockRoot,lockRelative,{write:true}));
  }
  return {migrated:true,root,from,to,preserved:'Vault files, annotations, source references, and wiki links are unchanged. Both folders have the same repository-root depth.',
    next_step:'Run /edw-doc:sync to refresh the version, source inventory, and assessments.',ignore:ignoreDiagnostics(root,to)};
}

const args=process.argv.slice(2);
const command=args.shift()||'help';
const options={};
try {
  while(args.length) {
    const key=args.shift();
    if(!['--root','--vault-name','--path','--topic','--query','--interval','--limit','--kind','--from','--to'].includes(key)||!args.length)throw new Error(`Unknown or incomplete option: ${key}`);
    options[key.slice(2)]=args.shift();
  }
  if(command==='help'||command==='--help'||command==='-h') {
    process.stdout.write(`EDW Doc ${VERSION}\n\nUsage: node scripts/cli.mjs <command> --root <repository>\n\nCommands:\n  setup       Install local instruction integration (--root required)\n  setup-status Inspect local integration without writing (--root required)\n  uninstall   Remove unchanged integration additions (--root required)\n  scan, sync  Create/refresh a source-grounded structural vault\n  status      Report freshness without writing\n  lint        Check managed notes, links, evidence and coverage\n  list        List sources (--kind category, --limit 1..500)\n  read        Inspect approved source (--path relative/source)\n  packet      Get one source analysis packet (--path relative/source)\n  context     Read bundled guidance (--topic index or asset path)\n  watch       Poll and refresh (--interval seconds, minimum 2)\n  migrate     Move an owned vault (--from doc-vault --to edw-doc)\n\nOptional: --vault-name edw-doc\nScan/sync/watch write only the vault and append its root ignore rule plus /.claude/.\nMigration additionally moves the explicitly named owned vault; it never overwrites a destination.\nThey never run project code or install Git hooks. AI enrichment runs through the Claude Code plugin.\nSetup additionally owns narrow local instruction references and .claude/edw-doc files.\nUninstall preserves user edits, the vault, ignore rules, and directories.\n`);
  } else if(['setup','setup-status','uninstall'].includes(command)) {
    if(!options.root)throw new Error('Local integration commands require an explicit --root repository.');
    if(Object.keys(options).some(key=>!['root','vault-name'].includes(key)))throw new Error('Integration commands accept only --root and setup --vault-name.');
    if(command!=='setup'&&options['vault-name'])throw new Error('--vault-name is only accepted for setup.');
    const result=command==='setup'?installIntegration(options.root,{vaultName:options['vault-name']}):command==='uninstall'?removeIntegration(options.root):integrationStatus(options.root);
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
  } else if(command==='migrate') {
    if(!options.root||!options.from||!options.to)throw new Error('Migration requires explicit --root, --from, and --to.');
    if(options['vault-name'])throw new Error('Use --from and --to for migration, not --vault-name.');
    process.stdout.write(JSON.stringify(migrateOwnedVault(options.root,options.from,options.to),null,2)+'\n');
  } else {
    if(options.from||options.to)throw new Error('--from and --to are only accepted for migration.');
    const root=options.root||process.cwd();
    const setup=integrationStatus(root);
    const engine=await createEngine(root,{vaultName:options['vault-name']||(setup.installed?setup.vaultName:'edw-doc')});
    const output=value=>process.stdout.write(JSON.stringify(value,null,2)+'\n');
    if(command==='watch') {
      const interval=Number(options.interval||10);
      if(!Number.isFinite(interval)||interval<2||interval>3600)throw new Error('Watch interval must be 2–3600 seconds.');
      let running=true;
      process.on('SIGINT',()=>{running=false;});
      process.on('SIGTERM',()=>{running=false;});
      output({watching:engine.root,interval_seconds:interval,note:'Static refresh only; use the plugin to enrich invalidated agent notes.'});
      while(running) {
        try {const result=await engine.scan();if(!result.unchanged)output(result);}
        catch(error){process.stderr.write(`Refresh failed: ${error.message}\n`);}
        if(running)await sleep(interval*1000);
      }
    } else {
      let result;
      if(['scan','sync','status','lint'].includes(command))result=await engine[command==='sync'?'refresh':command]();
      else if(command==='list')result=await engine.list({kind:options.kind,limit:Number(options.limit||100)});
      else if(command==='read'||command==='packet')result=await engine[command]({path:options.path});
      else if(command==='context')result=await engine.context({topic:options.topic||'index'});
      else throw new Error(`Unknown command: ${command}`);
      output(result);
      if(command==='lint'&&!result.ok)process.exitCode=1;
    }
  }
} catch(error) {process.stderr.write(`EDW Doc: ${error.message}\n`);process.exitCode=1;}
