import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('reset explanations retain the approved Before copying sentences in all three lesson copies', async () => {
  const reminders = {
    'discard-commit': 'Before copying: run git status and stash or commit any work you want to keep.',
    'recover-from-reflog': 'Before copying: confirm the target in your own reflog and preserve uncommitted work.'
  };
  for (const file of [
    'experiences/git/git-repository-practice.authoring.json',
    'experiences/git/git-repository-practice.json',
    'wordpress/experiences/git-repository-practice.json'
  ]) {
    const source = await readFile(new URL('../' + file, import.meta.url), 'utf8');
    const lesson = JSON.parse(source);
    for (const [id, sentence] of Object.entries(reminders)) {
      const text = lesson.beats
        ? lesson.beats.find(beat => beat.id === id)?.explanation.segments.find(segment => segment.at === 'command')?.text
        : lesson.steps.find(step => step.beat.id === id && step.commentary.anchor === 'command')?.commentary.text;
      assert.ok(text?.startsWith(sentence), `${file}: ${id} must start with the approved sentence`);
      assert.equal(source.split(sentence).length - 1, 1, `${file}: ${id} reminder must appear exactly once`);
    }
  }
});
