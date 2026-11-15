/**
 * Full page load to a same-origin path after sign-in or sign-out.
 *
 * The client router cache can hold responses fetched under the previous
 * identity (for example a prefetch of /app that the proxy answered with a
 * redirect to /login while signed out). A full load discards all of it.
 */
export function hardNavigate(path: string): void {
  window.location.replace(new URL(path, window.location.origin).toString());
}
