// Generates authoring/v1 validator fixtures from a minimal clean base experience.
// Each invalid fixture changes exactly one thing so it violates exactly one rule.
// Usage: node tools/generate-authoring-v1-fixtures.mjs   (writes authoring/v1/fixtures/{valid,invalid,lint}/ + manifest.json)
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'authoring', 'v1', 'fixtures');

const base = () => ({
  schema: 'localis.cim/authoring/v1',
  id: 'fixture-base',
  title: 'Fixture Base',
  description: 'Minimal clean experience used to derive single-violation fixtures.',
  subject: 'git',
  version: '1.0.0',
  console: { title: 'git \u2014 fixture', prompt: '~/fixture (main) $' },
  presentation: { layout: 'console-explanation', defaultPlaybackRate: 1 },
  beats: [
    {
      id: 'show-status', dwell: 3000,
      console: { command: 'git status', typing: true, output: [
        { text: 'On branch main', tone: 'normal' },
        { text: 'Changes not staged for commit:', tone: 'normal' },
        { id: 'a-mod', text: '        modified:   notes.txt', tone: 'warning' },
        { text: 'no changes added to commit', tone: 'dim' } ] },
      explanation: { heading: 'Check the state', segments: [
        { at: 'command', text: 'git status reports what has changed.' },
        { at: 'output', text: 'notes.txt has unstaged edits.', focus: ['a-mod'] } ],
        references: [ { label: 'Git status documentation', url: 'https://git-scm.com/docs/git-status' } ] },
    },
    {
      id: 'stage', dwell: 3000,
      console: { command: 'git add -p -- notes.txt', typing: true, output: [
        { text: 'diff --git a/notes.txt b/notes.txt', tone: 'dim' },
        { text: '--- a/notes.txt', tone: 'dim' },
        { text: '+++ b/notes.txt', tone: 'dim' },
        { text: '@@ -1,3 +1,3 @@', tone: 'normal' },
        { text: ' first line', tone: 'normal' },
        { text: '-old line', tone: 'removed' },
        { text: '+new line', tone: 'added' },
        { text: ' last line', tone: 'normal' },
        { id: 'b-prompt', text: '(1/1) Stage this hunk [y,n,q,a,d,e,?]?', tone: 'normal' } ], response: 'y' },
      explanation: { heading: 'Stage the hunk', segments: [
        { at: 'command', text: '-p presents changes one hunk at a time.' },
        { at: 'output', text: 'Git waits for a decision.', focus: ['b-prompt'] },
        { at: 'response', text: 'y stages the hunk.' } ],
        references: [ { label: 'Git add documentation', url: 'https://git-scm.com/docs/git-add' } ] },
      risk: { level: 'free-to-undo', guidance: 'git restore --staged notes.txt unstages it.' },
    },
  ],
});

const A = (d) => d.beats[0], B = (d) => d.beats[1];
const withBeat = (d, beat) => { d.beats.push(beat); return d; };

// [file, mutate, expected error id | null, expected warning id | null, note]
const cases = [
  // ---- invalid: each changes one thing and must fail on exactly one diagnostic ----
  ['invalid/invalid-json.json', null, 'CIM-AUTH-PARSE', null, '§22 malformed JSON'],
  ['invalid/duplicate-key.json', 'DUPKEY', 'CIM-AUTH-DUPLICATE-KEY', null, '§1 fail-closed parsing'],
  ['invalid/schema-mismatch.json', (d) => { d.schema = 'localis.cim/experience/v1'; }, 'CIM-AUTH-SCHEMA-ID', null, '§2'],
  ['invalid/missing-required-field.json', (d) => { delete d.title; }, 'CIM-AUTH-MISSING-FIELD', null, '§2 root field'],
  ['invalid/unknown-root-field.json', (d) => { d.theme = 'dark'; }, 'CIM-AUTH-UNKNOWN-FIELD', null, '§1, §2 closed root'],
  ['invalid/removed-presentation-field.json', (d) => { d.presentation.explanationTitle = 'Explanation'; }, 'CIM-AUTH-UNKNOWN-FIELD', null, 'C1: removed from authoring v1'],
  ['invalid/unknown-beat-field.json', (d) => { A(d).color = 'red'; }, 'CIM-AUTH-UNKNOWN-FIELD', null, '§1, §6 closed beat'],
  ['invalid/empty-beats.json', (d) => { d.beats = []; }, 'CIM-AUTH-EMPTY-BEATS', null, '§2'],
  ['invalid/invalid-experience-id.json', (d) => { d.id = 'Fixture_Base'; }, 'CIM-AUTH-INVALID-ID', null, '§3 experience id'],
  ['invalid/invalid-beat-id.json', (d) => { B(d).id = 'Stage Hunk'; }, 'CIM-AUTH-INVALID-ID', null, '§3 beat id'],
  ['invalid/invalid-output-id.json', (d) => { B(d).console.output[5].id = 'oldLine'; }, 'CIM-AUTH-INVALID-ID', null, '§3 output id'],
  ['invalid/duplicate-beat-id.json', (d) => { B(d).id = 'show-status'; }, 'CIM-AUTH-DUPLICATE-BEAT-ID', null, '§3'],
  ['invalid/duplicate-output-id.json', (d) => { B(d).console.output[5].id = 'a-mod'; }, 'CIM-AUTH-DUPLICATE-OUTPUT-ID', null, '§3'],
  ['invalid/missing-prompt.json', (d) => { delete d.console.prompt; B(d).console.prompt = '~/fixture (main) $'; }, 'CIM-AUTH-MISSING-PROMPT', null, '§4'],
  ['invalid/unknown-layout.json', (d) => { d.presentation.layout = 'split'; }, 'CIM-AUTH-UNKNOWN-LAYOUT', null, '§5'],
  ['invalid/playback-rate-below-range.json', (d) => { d.presentation.defaultPlaybackRate = 0.25; }, 'CIM-AUTH-PLAYBACK-RATE', null, 'A2R §11'],
  ['invalid/playback-rate-above-range.json', (d) => { d.presentation.defaultPlaybackRate = 5; }, 'CIM-AUTH-PLAYBACK-RATE', null, 'A2R §11'],
  ['invalid/reserved-beat-id.json', (d) => { A(d).id = 'initial'; }, 'CIM-AUTH-RESERVED-ID', null, 'A2R §6'],
  ['invalid/version-not-semver.json', (d) => { d.version = '1.0'; }, 'CIM-AUTH-VERSION', null, 'A2R §7'],
  ['invalid/final-anchor-incomplete.json', (d) => { B(d).explanation.segments.pop(); }, 'CIM-AUTH-FINAL-ANCHOR', null, 'A2R §3 response beat ends on output'],
  ['invalid/final-anchor-output-pending.json', (d) => { A(d).explanation.segments.pop(); }, 'CIM-AUTH-FINAL-ANCHOR', null, 'A2R §3 output beat ends on command'],
  ['invalid/negative-dwell.json', (d) => { A(d).dwell = -1; }, 'CIM-AUTH-TYPE', null, '§6'],
  ['invalid/missing-explanation.json', (d) => { delete A(d).explanation; }, 'CIM-AUTH-MISSING-FIELD', null, '§6'],
  ['invalid/missing-command.json', (d) => { delete A(d).console.command; }, 'CIM-AUTH-MISSING-FIELD', null, '§7'],
  ['invalid/missing-output.json', (d) => { A(d).explanation.segments.pop(); delete A(d).console.output; }, 'CIM-AUTH-MISSING-FIELD', null, '§7'],
  ['invalid/typing-not-boolean.json', (d) => { A(d).console.typing = 'yes'; }, 'CIM-AUTH-TYPE', null, '§7'],
  ['invalid/copy-not-string.json', (d) => { A(d).console.copy = 42; }, 'CIM-AUTH-INVALID-COPY', null, '§7, §17'],
  ['invalid/copy-empty.json', (d) => { A(d).console.copy = '   '; }, 'CIM-AUTH-INVALID-COPY', null, '§7, §17'],
  ['invalid/missing-tone.json', (d) => { delete A(d).console.output[0].tone; }, 'CIM-AUTH-MISSING-FIELD', null, '§8'],
  ['invalid/unknown-tone.json', (d) => { A(d).console.output[0].tone = 'red'; }, 'CIM-AUTH-UNKNOWN-TONE', null, '§8'],
  ['invalid/tab-in-output.json', (d) => { A(d).console.output[2].text = '\tmodified:   notes.txt'; }, 'CIM-AUTH-TAB-CHARACTER', null, '§9 output'],
  ['invalid/tab-in-command.json', (d) => { A(d).console.command = 'git\tstatus'; }, 'CIM-AUTH-TAB-CHARACTER', null, '§9 command'],
  ['invalid/line-break-in-output.json', (d) => { A(d).console.output[0].text = 'On branch main\nChanges not staged'; }, 'CIM-AUTH-LINE-BREAK', null, '§9 output'],
  ['invalid/line-break-in-command.json', (d) => { A(d).console.command = 'git status\ngit log'; }, 'CIM-AUTH-LINE-BREAK', null, '§9 command'],
  ['invalid/line-break-in-prompt.json', (d) => { d.console.prompt = '~/fixture\n(main) $'; }, 'CIM-AUTH-LINE-BREAK', null, '§9 prompt'],
  ['invalid/line-break-in-response.json', (d) => { B(d).console.response = 'y\r\n'; }, 'CIM-AUTH-LINE-BREAK', null, '§9 response'],
  ['invalid/line-break-in-copy.json', (d) => { A(d).console.copy = 'git status\u2028git log'; }, 'CIM-AUTH-LINE-BREAK', null, '§9 copy (U+2028)'],
  ['invalid/missing-heading.json', (d) => { delete A(d).explanation.heading; }, 'CIM-AUTH-MISSING-FIELD', null, '§10'],
  ['invalid/no-segments.json', (d) => { A(d).explanation.segments = []; }, 'CIM-AUTH-NO-SEGMENTS', null, '§10'],
  ['invalid/unknown-anchor.json', (d) => { A(d).explanation.segments[0].at = 'typing'; }, 'CIM-AUTH-UNKNOWN-ANCHOR', null, '§11'],
  ['invalid/segment-order.json', (d) => { A(d).explanation.segments.unshift({ at: 'output', text: 'Explained before the command was typed.' }); }, 'CIM-AUTH-SEGMENT-ORDER', null, '§11'],
  ['invalid/output-anchor-without-output.json', (d) => withBeat(d, { id: 'fetch', console: { command: 'git fetch', output: [] },
      explanation: { heading: 'Fetch', segments: [ { at: 'output', text: 'Nothing new arrived.' } ] } }), 'CIM-AUTH-OUTPUT-ANCHOR-WITHOUT-OUTPUT', null, '§11'],
  ['invalid/response-anchor-without-response.json', (d) => { A(d).explanation.segments.push({ at: 'response', text: 'Nothing was asked.' }); }, 'CIM-AUTH-RESPONSE-ANCHOR-WITHOUT-RESPONSE', null, '§11'],
  ['invalid/response-without-prompt.json', (d) => withBeat(d, { id: 'commit', console: { command: 'git commit', output: [], response: 'y' },
      explanation: { heading: 'Commit', segments: [ { at: 'command', text: 'Records the staged change.' }, { at: 'response', text: 'Confirmed.' } ] } }), 'CIM-AUTH-RESPONSE-WITHOUT-PROMPT', null, '§12'],
  ['invalid/focus-unknown-target.json', (d) => { A(d).explanation.segments[1].focus = ['no-such-line']; }, 'CIM-AUTH-FOCUS-UNKNOWN-TARGET', null, '§13'],
  ['invalid/focus-cross-beat.json', (d) => { B(d).explanation.segments[1].focus = ['a-mod']; }, 'CIM-AUTH-FOCUS-CROSS-BEAT', null, '§13'],
  ['invalid/focus-references-future-output.json', (d) => { B(d).explanation.segments[0].focus = ['b-prompt']; }, 'CIM-AUTH-FOCUS-FUTURE-OUTPUT', null, '§13'],
  ['invalid/reference-not-https.json', (d) => { A(d).explanation.references[0].url = 'http://git-scm.com/docs/git-status'; }, 'CIM-AUTH-REFERENCE-URL', null, '§15'],
  ['invalid/reference-relative-url.json', (d) => { A(d).explanation.references[0].url = '/docs/git-status'; }, 'CIM-AUTH-REFERENCE-URL', null, '§15'],
  ['invalid/reference-generic-label.json', (d) => { A(d).explanation.references[0].label = 'Read More'; }, 'CIM-AUTH-REFERENCE-LABEL', null, '§15 (case-insensitive)'],
  ['invalid/unknown-risk-level.json', (d) => { B(d).risk.level = 'dangerous'; }, 'CIM-AUTH-UNKNOWN-RISK-LEVEL', null, '§18'],
  ['invalid/risk-level-none.json', (d) => { B(d).risk = { level: 'none' }; }, 'CIM-AUTH-UNKNOWN-RISK-LEVEL', null, '§18 no authored none'],
  ['invalid/risk-label-present.json', (d) => { B(d).risk.label = 'FREE TO UNDO'; }, 'CIM-AUTH-UNKNOWN-FIELD', null, '§18 label removed'],
  ['invalid/risk-missing-level.json', (d) => { delete B(d).risk.level; }, 'CIM-AUTH-MISSING-FIELD', null, '§18'],
  // ---- valid: MAY/optional rules that must be accepted ----
  ['valid/prompt-overrides-only.json', (d) => { delete d.console.prompt; A(d).console.prompt = '~/fixture (main) $'; B(d).console.prompt = '~/fixture (feature) $'; }, null, null, '§4 every beat overrides'],
  ['valid/rate-range-bounds.json', (d) => { d.presentation.defaultPlaybackRate = 2; }, null, null, 'A2R §11 inclusive bound'],
  ['valid/command-only-beat.json', (d) => withBeat(d, { id: 'fetch', console: { command: 'git fetch', output: [] },
      explanation: { heading: 'Fetch', segments: [ { at: 'command', text: 'Downloads remote objects without changing your branch.' } ] } }), null, null, 'A2R §3 command is the last phase'],
  ['valid/minimal-optionals.json', (d) => { delete d.console.title; d.presentation = { layout: 'console-explanation' };
      d.beats.forEach((b) => { delete b.dwell; delete b.console.typing; delete b.explanation.references; }); delete B(d).risk.guidance; }, null, null, '§4-§7, §10, §18 optional fields omitted'],
  ['valid/trailing-whitespace-and-copy.json', (d) => { B(d).console.output[8].text += '   '; A(d).console.copy = 'git status --short'; A(d).console.typing = false; }, null, null, '§7, §9, §17'],
  // ---- lint: valid documents that must warn ----
  ['lint/lint-focus-breadth.json', (d) => { const o = B(d).console.output; ['l0', 'l1', 'l2', 'l3'].forEach((id, i) => { o[i].id = id; });
      B(d).explanation.segments[1].focus = ['l0', 'l1', 'l2', 'l3']; }, null, 'CIM-AUTH-LINT-FOCUS-BREADTH', '§13'],
  ['lint/lint-tone-density.json', (d) => { A(d).console.output[1].tone = 'warning'; }, null, 'CIM-AUTH-LINT-TONE-DENSITY', '§20'],
  ['lint/lint-blank-lines-excluded.json', (d) => { for (let i = 0; i < 8; i++) A(d).console.output.push({ text: '', tone: 'normal' }); A(d).console.output[1].tone = 'added'; }, null, 'CIM-AUTH-LINT-TONE-DENSITY', '§20 blanks excluded: 2/4 non-blank warns; 2/12 with blanks would not'],
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/invalid`, { recursive: true });
mkdirSync(`${OUT}/lint`, { recursive: true });
mkdirSync(`${OUT}/valid`, { recursive: true });
writeFileSync(`${OUT}/valid/base.json`, JSON.stringify(base(), null, 2) + '\n');
const manifest = { 'valid/base.json': { errors: [], warnings: [], note: 'Clean base; must validate with no diagnostics' } };
for (const [file, mutate, errorId, warnId, note] of cases) {
  if (mutate === 'DUPKEY') {
    writeFileSync(`${OUT}/${file}`, JSON.stringify(base(), null, 2).replace('"command": "git status",', '"command": "git reset --hard HEAD~1",\n        "command": "git status",') + '\n');
  } else if (mutate === null) {
    writeFileSync(`${OUT}/${file}`, JSON.stringify(base(), null, 2).slice(0, 180).trimEnd() + '\n');
  } else {
    const d = base(); mutate(d);
    writeFileSync(`${OUT}/${file}`, JSON.stringify(d, null, 2) + '\n');
  }
  manifest[file] = { errors: errorId ? [errorId] : [], warnings: warnId ? [warnId] : [], note };
}
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(`wrote ${cases.length + 1} fixtures`);
