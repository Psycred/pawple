/**
 * Store URLs — update when Pawple is live on each store.
 * Used by the home page download button only.
 */
window.PAWPLE_STORE_LINKS = {
  android: 'https://play.google.com/store/apps/details?id=com.anonymous.Pawple',
  ios: null,
};

(function applyStoreLinks() {
  var androidBtn = document.getElementById('download-android');
  if (!androidBtn || !window.PAWPLE_STORE_LINKS) {
    return;
  }
  var url = window.PAWPLE_STORE_LINKS.android;
  if (url) {
    androidBtn.setAttribute('href', url);
    androidBtn.setAttribute('rel', 'noopener noreferrer');
  }
})();
