import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSrc = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

describe('dedicated external Moment share rendering', () => {
  it('keeps the normal in-app Moment card at 4:5', () => {
    const postCard = readSrc('src/components/PostCard.js');
    const theme = readSrc('src/config/theme.js');

    assert.match(postCard, /aspectRatio:\s*theme\.feed\.postAspectRatio/);
    assert.match(theme, /postAspectRatio:\s*4\s*\/\s*5/);
  });

  it('loads the share photo through PawpleStorageImage for private storage URLs', () => {
    const shareCard = readSrc('src/components/ShareCard.js');

    assert.match(shareCard, /import PawpleStorageImage from '\.\/PawpleStorageImage'/);
    assert.match(shareCard, /<PawpleStorageImage/);
    assert.doesNotMatch(shareCard, /<Image\s+source=\{\{ uri: photoUri \}\}/);
  });

  it('captures the separate share card at exactly 1080 by 1080', () => {
    const momentCard = readSrc('src/components/MomentCard.js');
    const shareCard = readSrc('src/components/ShareCard.js');
    const shareEngine = readSrc('src/utils/shareFeedPost.js');

    assert.match(shareCard, /MOMENT_SHARE_OUTPUT_SIZE\s*=\s*1080/);
    assert.match(shareCard, /width:\s*SHARE_LAYOUT_SIZE/);
    assert.match(shareCard, /height:\s*SHARE_LAYOUT_SIZE/);
    assert.match(momentCard, /<ShareCard/);
    assert.match(momentCard, /captureWidth:\s*MOMENT_SHARE_OUTPUT_SIZE/);
    assert.match(momentCard, /captureHeight:\s*MOMENT_SHARE_OUTPUT_SIZE/);
    assert.match(momentCard, /shareCaptureHost/);
    assert.match(shareEngine, /export async function shareMomentWithPreview/);
    assert.match(shareEngine, /width:\s*captureWidth,\s*height:\s*captureHeight/);
  });

  it('preserves the existing native iOS and Android share mechanisms', () => {
    const source = readSrc('src/utils/shareFeedPost.js');
    assert.match(source, /Platform\.OS === 'ios'/);
    assert.match(source, /Share\.share\(/);
    assert.match(source, /RNShare\.open\(/);
    assert.match(source, /useInternalStorage:\s*true/);
  });
});

describe('share deep-link destination lifecycle', () => {
  it('uses centralized HTTPS builders for Moment and Meetup shares', () => {
    const momentCard = readSrc('src/components/MomentCard.js');
    const meetup = readSrc('src/screens/MeetupDetailsScreen.js');
    const shareEngine = readSrc('src/utils/shareFeedPost.js');

    assert.match(momentCard, /shareMomentWithPreview\(/);
    assert.doesNotMatch(momentCard, /shareFeedPost\(/);
    assert.match(meetup, /shareMeetupWithPreview\(/);
    assert.match(shareEngine, /buildPublicShareUrl\('moment',\s*id\)/);
    assert.match(shareEngine, /buildPublicShareUrl\('meetup',\s*id\)/);
    assert.match(shareEngine, /displayUrl/);
    assert.doesNotMatch(meetup, /shareFeedPost\(/);
    assert.match(shareEngine, /export async function shareMeetupWithPreview/);
    assert.match(shareEngine, /export async function sharePublicLink/);
    assert.doesNotMatch(meetup, /pawple:\/\/moment/);
    assert.doesNotMatch(meetup, /pawple:\/\/meetup/);
  });

  it('retains and flushes destinations around auth and navigation readiness', () => {
    const app = readSrc('App.js');
    const pending = readSrc('src/lib/pendingShareDestination.js');

    assert.match(app, /parseShareDestination\(url\)/);
    assert.match(app, /storePendingShareDestination\(user\?\.id \?\? null,\s*destination\)/);
    assert.match(app, /getPendingShareDestination\(user\.id\)/);
    assert.match(app, /clearPendingShareDestination\(user\.id\)/);
    assert.match(app, /hasCompletedOnboarding/);
    assert.match(app, /navigationReady/);
    assert.match(pending, /PRE_AUTH_KEY/);
  });

  it('routes to exact Moment and Meetup destinations', () => {
    const app = readSrc('App.js');
    const momentScreen = readSrc('src/screens/MomentDetailsScreen.js');
    const moments = readSrc('src/services/moments.js');
    const meetupScreen = readSrc('src/screens/MeetupDetailsScreen.js');

    assert.match(app, /navigate\('MomentDetailsScreen'/);
    assert.match(app, /navigate\('MeetupDetailsScreen'/);
    assert.match(momentScreen, /fetchMomentById\(momentId\)/);
    assert.match(moments, /export async function fetchMomentById/);
    assert.match(momentScreen, /This moment is no longer available\./);
    assert.match(meetupScreen, /fetchMeetupById\(meetupId\)/);
  });

  it('registers app-side pawple.app handling without removing legacy links', () => {
    const appConfig = readSrc('app.json');
    assert.match(appConfig, /"scheme":\s*"pawple"/);
    assert.match(appConfig, /"host":\s*"pawple\.app"/);
    assert.match(appConfig, /"host":\s*"pawple\.com"/);
    assert.match(appConfig, /"applinks:pawple\.app"/);
  });
});
