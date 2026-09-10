import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from './index';

test('GET /healthz returns 200 with a JSON body', async () => {
  const app = buildServer();
  const response = await app.inject({ method: 'GET', url: '/healthz' });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.status, 'ok');
});
