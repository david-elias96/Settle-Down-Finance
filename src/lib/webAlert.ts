/** Native builds already have real alerts; the web app replaces Alert in webAlert.web.ts. */
export function installWebAlert() {}

export { browserAlert } from './browserAlert';
