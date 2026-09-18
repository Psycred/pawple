/**
 * Dedicated Instagram Moment journal export — source contract tests.
 * Run: node --test tests/unit/moment-instagram-sharing.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSrc = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

function extractExportedFunctionBody(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) {
    return '';
  }
  const nextExport = source.indexOf('\nexport ', start + 1);
  return nextExport > start ? source.slice(start, nextExport) : source.slice(start);
}

describe('Instagram Moment journal export', () => {
  const journalCard = readSrc('src/components/InstagramMomentJournalCard.js');
  const momentCard = readSrc('src/components/MomentCard.js');
  const shareEngine = readSrc('src/utils/shareFeedPost.js');
  const postCard = readSrc('src/components/PostCard.js');

  it('exports exactly 1080 by 1080 capture dimensions', () => {
    assert.match(journalCard, /INSTAGRAM_MOMENT_JOURNAL_OUTPUT_SIZE\s*=\s*1080/);
    assert.match(journalCard, /INSTAGRAM_MOMENT_JOURNAL_LAYOUT_SIZE\s*=\s*540/);
    assert.match(shareEngine, /format:\s*'jpg'/);
    assert.match(shareEngine, /width:\s*captureWidth/);
    assert.match(shareEngine, /height:\s*captureHeight/);
    assert.match(momentCard, /INSTAGRAM_MOMENT_JOURNAL_OUTPUT_SIZE/);
  });

  it('renders the moment photo and crayon Pawple frame', () => {
    assert.match(journalCard, /<FeedImageTreatment/);
    assert.match(journalCard, /<CrayonFrameOverlay/);
    assert.doesNotMatch(journalCard, /memoryFrameStrokeWidth/);
    assert.doesNotMatch(journalCard, /import\s+ShareCard/);
  });

  it('faithfully adapts the feed PostCard into a 1:1 canvas', () => {
    assert.match(journalCard, /INSTAGRAM_MOMENT_JOURNAL_CARD_WIDTH/);
    assert.match(journalCard, /theme\.feed\.postAspectRatio/);
    assert.match(journalCard, /theme\.feed\.imageSectionFlexRatio/);
    assert.match(journalCard, /theme\.feed\.textSectionFlexRatio/);
    assert.match(journalCard, /scrapbookTiltTransform/);
    assert.match(journalCard, /metaShelf/);
    assert.doesNotMatch(journalCard, /flex:\s*0\.58/);
    assert.doesNotMatch(journalCard, /flex:\s*0\.42/);
    assert.doesNotMatch(journalCard, /paddingTop:\s*theme\.spacing\.lg/);
  });

  it('renders journal metadata fields when present', () => {
    assert.match(journalCard, /caption/);
    assert.match(journalCard, /petEntries/);
    assert.match(journalCard, /date/);
    assert.match(journalCard, /location/);
    assert.match(journalCard, /hasCaption/);
    assert.match(journalCard, /hasPet/);
  });

  it('omits feed action chrome from the export card', () => {
    assert.doesNotMatch(journalCard, /ActionBar/);
    assert.doesNotMatch(journalCard, /ReportSheet/);
    assert.doesNotMatch(journalCard, /ContentSafetyMenu/);
    assert.doesNotMatch(journalCard, /handleShare/);

    const instagramCaptureBlock =
      momentCard.match(
        /<View pointerEvents="none" style={styles\.instagramCaptureHost}>[\s\S]*?<\/View>/,
      )?.[0] ?? '';
    assert.match(instagramCaptureBlock, /<InstagramMomentJournalCard/);
    assert.doesNotMatch(instagramCaptureBlock, /ActionBar/);
  });

  it('skips optional caption and pet blocks without layout artifacts', () => {
    assert.match(journalCard, /hasCaption \?/);
    assert.match(journalCard, /hasPet \?/);
    assert.match(journalCard, /: null\}/);
    assert.match(journalCard, /metaShelf/);
  });

  it('uses a dedicated Instagram native share path with the image file', () => {
    const instagramShareBody = extractExportedFunctionBody(
      shareEngine,
      'export async function shareMomentInstagramImage',
    );

    assert.match(instagramShareBody, /format:\s*'jpg'/);
    assert.match(instagramShareBody, /RNShare\.shareSingle\(/);
    assert.match(instagramShareBody, /RNShare\.Social\.INSTAGRAM/);
    assert.match(instagramShareBody, /url:\s*shareableUri/);
    assert.match(instagramShareBody, /type:\s*'image\/jpeg'/);
    assert.doesNotMatch(instagramShareBody, /sharePublicLink/);
    assert.doesNotMatch(instagramShareBody, /uploadMomentSharePreview/);
    assert.doesNotMatch(instagramShareBody, /buildPublicShareUrl/);
  });

  it('branches Instagram from normal link sharing via a minimal chooser', () => {
    assert.match(shareEngine, /export function presentMomentShareChooser/);
    assert.match(momentCard, /presentMomentShareChooser\(/);
    assert.match(momentCard, /runShareLink/);
    assert.match(momentCard, /runShareInstagram/);
    assert.match(momentCard, /shareMomentWithPreview\(/);
    assert.match(momentCard, /shareMomentInstagramImage\(/);
  });
});

describe('unchanged neighbouring share surfaces', () => {
  const shareEngine = readSrc('src/utils/shareFeedPost.js');
  const postCard = readSrc('src/components/PostCard.js');
  const meetup = readSrc('src/screens/MeetupDetailsScreen.js');
  const publicLinks = readSrc('src/lib/publicShareLinks.js');

  it('keeps the visible Feed Moment card at 4:5', () => {
    assert.match(postCard, /aspectRatio:\s*theme\.feed\.postAspectRatio/);
  });

  it('keeps normal Moment link sharing and Meetup sharing unchanged', () => {
    assert.match(shareEngine, /export async function sharePublicLink\(\{ caption, displayUrl, imageUri \}\)/);
    assert.match(shareEngine, /export async function shareMomentWithPreview/);
    assert.match(shareEngine, /uploadMomentSharePreview/);
    assert.match(shareEngine, /export async function shareMeetupWithPreview/);
    assert.match(publicLinks, /export function buildPublicShareUrl/);
    assert.doesNotMatch(meetup, /shareMomentInstagramImage/);
    assert.doesNotMatch(meetup, /presentMomentShareChooser/);
  });

  it('keeps feed demo image sharing separate', () => {
    assert.match(shareEngine, /export async function shareFeedPost\(post\)/);
    assert.doesNotMatch(shareEngine, /shareFeedPost[\s\S]*?shareMomentInstagramImage/);
  });
});
