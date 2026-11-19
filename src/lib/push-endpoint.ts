/** Push services browsers actually use. Anything else is refused, so the server never POSTs to an arbitrary or internal URL. */
const PUSH_HOSTS = [/^fcm.googleapis.com$/, /^android.googleapis.com$/, /(^|.)push.services.mozilla.com$/, /(^|.)notify.windows.com$/, /^web.push.apple.com$/, /(^|.)push.apple.com$/];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && !u.port && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}
