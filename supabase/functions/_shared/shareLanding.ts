const ANDROID_STORE_URL =
  Deno.env.get('PAWPLE_ANDROID_STORE_URL') ??
  'https://play.google.com/store/apps/details?id=com.anonymous.Pawple';
const IOS_STORE_URL =
  Deno.env.get('PAWPLE_IOS_STORE_URL') ?? 'https://pawple.app/download';

export function buildShareLandingScript(type: 'moment' | 'meetup', id: string) {
  const deepLink = `pawple://${type}/${encodeURIComponent(id)}`;
  const safeDeepLink = deepLink.replace(/'/g, "\\'");
  const safeAndroid = ANDROID_STORE_URL.replace(/'/g, "\\'");
  const safeIos = IOS_STORE_URL.replace(/'/g, "\\'");

  return `<script>
(function () {
  var deepLink = '${safeDeepLink}';
  var androidStore = '${safeAndroid}';
  var iosStore = '${safeIos}';
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  var fallbackStore = isIOS ? iosStore : androidStore;
  var opened = Date.now();
  window.location.href = deepLink;
  setTimeout(function () {
    if (Date.now() - opened < 1800) {
      window.location.href = fallbackStore;
    }
  }, 1200);
})();
</script>`;
}

export function buildSharePreviewImageUrl(
  supabaseUrl: string,
  ownerId: string,
  folder: 'moment-share' | 'meetup-share',
  itemId: string,
) {
  const base = supabaseUrl.replace(/\/$/, '');
  return `${base}/storage/v1/object/public/share-previews/${ownerId}/${folder}/${itemId}.png`;
}
