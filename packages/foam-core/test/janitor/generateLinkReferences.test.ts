import * as path from 'path';
import { generateLinkReferences } from '../../src/janitor';
import { bootstrap } from '../../src/bootstrap';
import { createConfigFromFolders } from '../../src/config';
import { FileDataStore, Matcher } from '../../src/services/datastore';
import { Logger } from '../../src/utils/log';
import { FoamWorkspace } from '../../src/model/workspace';
import { URI } from '../../src/model/uri';
import { Resource } from '../../src/model/note';
import { Range } from '../../src/model/range';
import { MarkdownResourceProvider } from '../../src';

Logger.setLevel('error');

describe('generateLinkReferences', () => {
  let _workspace: FoamWorkspace;
  const findBySlug = (slug: string): Resource => {
    return _workspace
      .list()
      .find(res => URI.getBasename(res.uri) === slug) as Resource;
  };

  beforeAll(async () => {
    const config = createConfigFromFolders([
      URI.file(path.join(__dirname, '..', '__scaffold__')),
    ]);
    _workspace = await bootstrap(config, new FileDataStore()).then(
      foam => foam.workspace
    );
    await _workspace.registerProvider(
      new MarkdownResourceProvider(
        new Matcher(
          config.workspaceFolders,
          config.includeGlobs,
          config.ignoreGlobs
        )
      )
    );
  });

  it('initialised test graph correctly', () => {
    expect(_workspace.list().length).toEqual(6);
  });

  it('should add link references to a file that does not have them', () => {
    const note = findBySlug('index');
    const expected = {
      newText: textForNote(
        note,
        `
[//begin]: # "Autogenerated link references for markdown compatibility"
[first-document]: first-document "First Document"
[second-document]: second-document "Second Document"
[file-without-title]: file-without-title "file-without-title"
[//end]: # "Autogenerated link references"`
      ),
      range: Range.create(9, 0, 9, 0),
    };

    const actual = generateLinkReferences(note, _workspace, false);

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should remove link definitions from a file that has them, if no links are present', () => {
    const note = findBySlug('second-document');

    const expected = {
      newText: '',
      range: Range.create(6, 0, 8, 42),
    };

    const actual = generateLinkReferences(note, _workspace, false);

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should update link definitions if they are present but changed', () => {
    const note = findBySlug('first-document');

    const expected = {
      newText: textForNote(
        note,
        `[//begin]: # "Autogenerated link references for markdown compatibility"
[file-without-title]: file-without-title "file-without-title"
[//end]: # "Autogenerated link references"`
      ),
      range: Range.create(8, 0, 10, 42),
    };

    const actual = generateLinkReferences(note, _workspace, false);

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should not cause any changes if link reference definitions were up to date', () => {
    const note = findBySlug('third-document');

    const expected = null;

    const actual = generateLinkReferences(note, _workspace, false);

    expect(actual).toEqual(expected);
  });
});

/**
 * Will adjust a text line separator to match
 * what is used by the note
 * Necessary when running tests on windows
 *
 * @param note the note we are adjusting for
 * @param text starting text, using a \n line separator
 */
function textForNote(note: Resource, text: string): string {
  return text.split('\n').join(note.source.eol);
}
