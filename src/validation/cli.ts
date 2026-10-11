import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildEngineBook, ENGINE_VERSION, exportCharacter } from '../engine';
import type { Book } from '../importer/book';
import { checkGraph, compareSvg } from '../importer/graph';
import { parseBook } from '../importer/parse';
import { readBounded, sha256, MAX_HTML_BYTES } from '../importer/source';
import { stableJson } from '../importer/output';
import { runCampaign, runGame, stateHash, traceSave } from './playthrough';

function options(args: string[]) {
  const out = {book:'content/01fftd/book.json',rules:'data/mechanics/01fftd.json',out:'content/validation/01fftd',
    games:5000,directedAttempts:256,recoveryAttempts:4096,maxSteps:1000,svg:null as string | null,verify:false};
  const seen = new Set<string>();
  for (let i=0;i<args.length;i++) {
    const flag = args[i]!;
    assert.ok(!seen.has(flag), 'duplicate option: ' + flag); seen.add(flag);
    if (flag === '--verify') {out.verify=true;continue;}
    const value = args[++i];
    assert.ok(value && !value.startsWith('--'), 'missing value for ' + flag);
    if (flag === '--book') out.book=value;
    else if (flag === '--rules') out.rules=value;
    else if (flag === '--out') out.out=value;
    else if (flag === '--svg') out.svg=value;
    else {
      const numeric: Record<string,'games'|'directedAttempts'|'recoveryAttempts'|'maxSteps'> = {
        '--games':'games','--directed-attempts':'directedAttempts','--recovery-attempts':'recoveryAttempts','--max-steps':'maxSteps'};
      const key = numeric[flag];
      assert.ok(key, 'unknown option: ' + flag);
      assert.ok(/^\d+$/.test(value), 'expected an integer for ' + flag);
      const n=Number(value); assert.ok(Number.isSafeInteger(n) && n <= 0xffffffff, 'integer out of range for ' + flag);
      out[key]=n;
    }
  }
  assert.ok(out.games>=1000, 'full-book validation requires at least 1000 games');
  assert.ok(out.maxSteps>0, 'max-steps must be positive');
  return out;
}

export async function runValidation(args: string[]): Promise<object> {
  const o=options(args), bookBytes=await readBounded(o.book), rulesBytes=await readBounded(o.rules);
  const imported=JSON.parse(Buffer.from(bookBytes).toString('utf8')) as Book;
  assert.equal(imported.id,'01fftd','this CLI qualifies Book 1');
  const source=await readBounded(resolve(dirname(o.book),'source.htm'),MAX_HTML_BYTES);
  assert.equal(sha256(source),imported.sourceSha256,'source bytes do not match the imported edition');
  // Rebuild from the saved original rather than trusting a manually edited JSON book.
  const regenerated=parseBook({bytes:source,entryPath:imported.source.entryPath,archiveSha256:imported.source.archiveSha256});
  assert.deepEqual(imported,regenerated,'book.json differs from a fresh parse of source.htm');
  const graph=checkGraph(imported); assert.ok(graph.ok,graph.problems.join('\n'));
  const book=buildEngineBook(imported,JSON.parse(Buffer.from(rulesBytes).toString('utf8')));
  const importReceipt=JSON.parse(await readFile(resolve(dirname(o.book),'import-receipt.json'),'utf8'));
  assert.equal(importReceipt.sourceSha256,imported.sourceSha256);
  assert.equal(importReceipt.bookJsonSha256,sha256(bookBytes),'import receipt does not match book.json');
  const recorded=importReceipt.svg;
  // Copy only reference-check fields, never arbitrary data from a local receipt.
  const svg=o.svg ? {mode:'live',...compareSvg(imported,await readBounded(o.svg))} : {
    mode:'import-receipt',status:recorded.status,sourceSha256:recorded.sourceSha256,
    edges:recorded.edges,missing:recorded.missing,extra:recorded.extra};
  assert.match(svg.sourceSha256,/^[a-f0-9]{64}$/,'invalid SVG hash');
  assert.equal(svg.status,'passed','supply --svg with a matching Project Aon graph');
  assert.equal(svg.edges,graph.counts.choices);
  assert.deepEqual(svg.missing,[]); assert.deepEqual(svg.extra,[]);
  const config={games:o.games,directedAttempts:o.directedAttempts,recoveryAttempts:o.recoveryAttempts,maxSteps:o.maxSteps};
  const campaign=runCampaign(book,config);
  assert.deepEqual(campaign.unvisited,[],'complete-game section coverage is incomplete');
  // Independently replay the recorded first visits to every section missed by random play.
  for (const witness of campaign.directed.witnesses) {
    const run=runGame(book,witness.seed,{target:witness.routingTarget,policySeed:witness.policySeed,maxSteps:o.maxSteps,
      ...(witness.disciplinePlan ? {disciplines:witness.disciplinePlan} : {})});
    assert.ok(run.sections.includes(witness.section),'directed witness did not reach section ' + witness.section);
    assert.equal(run.state.phase,witness.terminal);
  }
  const winningSave=JSON.parse(JSON.stringify(campaign.winning.save));
  const replayed=traceSave(book,winningSave);
  assert.equal(replayed.state.phase,'won');
  const trace={formatVersion:1,engine:ENGINE_VERSION,book:book.id,sourceSha256:book.sourceSha256,rulesFingerprint:book.rulesFingerprint,
    seed:winningSave.seed,policySeed:campaign.winning.policySeed,sections:campaign.winning.sections,
    steps:replayed.steps,finalStateSha256:stateHash(replayed.state),character:exportCharacter(book,replayed.state)};
  const validationDir=dirname(fileURLToPath(import.meta.url));
  const hashes=async (dir:string,files:string[]) => {
    const pairs=await Promise.all(files.map(async name=>[name,sha256(await readFile(resolve(dir,name)))]));
    return sha256(stableJson(Object.fromEntries(pairs)));
  };
  const {winning:_,...summary}=campaign;
  const files={save:'01fftd.winning-save.json',trace:'01fftd.winning-trace.json',receipt:'01fftd.playthrough-receipt.json'};
  const receipt={formatVersion:1,engine:ENGINE_VERSION,book:book.id,sourceSha256:book.sourceSha256,
    bookJsonSha256:sha256(bookBytes),rulesJsonSha256:sha256(rulesBytes),rulesFingerprint:book.rulesFingerprint,
    engineCodeSha256:await hashes(resolve(validationDir,'../engine'),['book.ts','crt.ts','engine.ts','index.ts','rng.ts','rules.ts','save.ts','types.ts']),
    harnessCodeSha256:await hashes(validationDir,['cli.ts','playthrough.ts']),config,
    graph:{counts:graph.counts,unreachable:graph.unreachable,finalReachable:graph.finalReachable},svg,
    ...summary,winning:{seed:winningSave.seed,actions:winningSave.actions.length,sections:trace.sections,
      saveSha256:sha256(stableJson(winningSave)),traceSha256:sha256(stableJson(trace)),finalStateSha256:trace.finalStateSha256},
    checks:{completeRules:true,freshSourceParse:true,allGamesTerminal:true,invariantsEveryAction:true,
      serializedSaveReplayEveryGame:true,directedWitnessReplay:true,allSectionsReachedFromNewGame:true,winningCharacterExport:true}};
  const artifacts={[files.save]:winningSave,[files.trace]:trace,[files.receipt]:receipt};
  if (o.verify) {
    for (const [name,value] of Object.entries(artifacts)) {
      const path=resolve(o.out,name), bytes=await readFile(path,'utf8');
      assert.equal(bytes,stableJson(value),'artifact does not reproduce: ' + name);
    }
  } else {
    await mkdir(o.out,{recursive:true});
    for (const [name,value] of Object.entries(artifacts)) await writeFile(resolve(o.out,name),stableJson(value));
  }
  return {status:o.verify?'verified':'written',out:o.out,engine:ENGINE_VERSION,random:{games:summary.random.games,wins:summary.random.wins,
    deaths:summary.random.deaths,winRate:summary.random.winRate,sections:summary.random.sections.length},
    directed:{games:summary.directed.games,wins:summary.directed.wins,deaths:summary.directed.deaths,witnesses:summary.directed.witnesses.length},
    coverage:summary.sections.length,unvisited:summary.unvisited,winningSeed:winningSave.seed,winningActions:winningSave.actions.length};
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {console.log(stableJson(await runValidation(process.argv.slice(2))));}
  catch (error) {console.error('validation: '+(error instanceof Error?error.message:String(error)));process.exitCode=1;}
}
