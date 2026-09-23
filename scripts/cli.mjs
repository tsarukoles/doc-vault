#!/usr/bin/env node
import { createEngine, VERSION } from '../src/engine.mjs';
import { setTimeout as sleep } from 'node:timers/promises';

const args=process.argv.slice(2);
const command=args.shift()||'help';
const options={};
try {
  while(args.length) {
    const key=args.shift();
    if(!['--root','--vault-name','--path','--topic','--query','--interval','--limit','--kind'].includes(key)||!args.length)throw new Error(`Unknown or incomplete option: ${key}`);
    options[key.slice(2)]=args.shift();
  }
  if(command==='help'||command==='--help'||command==='-h') {
    process.stdout.write(`Doc Vault ${VERSION}\n\nUsage: node scripts/cli.mjs <command> --root <repository>\n\nCommands:\n  scan, sync  Create/refresh a source-grounded structural vault\n  status      Report freshness without writing\n  lint        Check managed notes, links, evidence and coverage\n  list        List sources (--kind category, --limit 1..500)\n  read        Inspect approved source (--path relative/source)\n  packet      Get one source analysis packet (--path relative/source)\n  context     Read bundled guidance (--topic index or asset path)\n  watch       Poll and refresh (--interval seconds, minimum 2)\n\nOptional: --vault-name doc-vault\nScan/sync/watch write only the vault and append its exact root .gitignore entry.\nThey never run project code or install Git hooks. AI enrichment runs through the Claude Code plugin.\n`);
  } else {
    const engine=await createEngine(options.root||process.cwd(),{vaultName:options['vault-name']||'doc-vault'});
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
} catch(error) {process.stderr.write(`Doc Vault: ${error.message}\n`);process.exitCode=1;}
