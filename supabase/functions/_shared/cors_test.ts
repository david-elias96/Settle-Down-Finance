import { assertEquals } from 'jsr:@std/assert@1';
import { allowedOrigins, corsHeaders } from './cors.ts';

Deno.test('only the web app origin gets CORS headers', () => {
  const allowed = allowedOrigins(undefined);
  assertEquals(corsHeaders('https://app.settledownfinancial.com', allowed)['Access-Control-Allow-Origin'], 'https://app.settledownfinancial.com');
  assertEquals(corsHeaders('https://evil.example', allowed), {});
  assertEquals(corsHeaders(null, allowed), {});
});

Deno.test('APP_WEB_ORIGINS overrides the default and ignores malformed entries', () => {
  assertEquals(allowedOrigins('https://a.example, http://insecure.example, *'), ['https://a.example']);
  assertEquals(allowedOrigins('*'), ['https://app.settledownfinancial.com']);
});
