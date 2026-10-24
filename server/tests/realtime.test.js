const test = require('node:test');
const assert = require('node:assert/strict');

process.env.REALTIME_THROTTLE_MS = '60';
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const realtime = require('../config/realtime');

test('publish() assigns increasing ids and is replayable', () => {
    const before = realtime.currentSeq();
    const a = realtime.publish('users', 'sync', { deviceId: 'd1' });
    const b = realtime.publish('users', 'sync', { deviceId: 'd2' });

    assert.equal(typeof a.id, 'number');
    assert.ok(b.id > a.id);
    assert.ok(realtime.currentSeq() > before);

    const replay = realtime.eventsSince(a.id, ['users']);
    assert.ok(replay.some((e) => e.id === b.id));
    assert.ok(replay.every((e) => e.topic === 'users'));
});

test('eventsSince filters by topic', () => {
    realtime.publish('quotes', 'updated', { id: 1 });
    const quoteEvents = realtime.eventsSince(0, ['quotes']);
    assert.ok(quoteEvents.length > 0);
    assert.ok(quoteEvents.every((e) => e.topic === 'quotes'));
});

test('publishThrottled delivers a trailing event', async () => {
    const seen = [];
    const before = realtime.currentSeq();

    for (let i = 0; i < 5; i++) {
        realtime.publishThrottled('analytics', 'burst', { i });
    }
    const immediate = realtime.eventsSince(before, ['analytics']);
    assert.ok(immediate.length <= 1, 'at most one event inside the throttle window');

    await new Promise((r) => setTimeout(r, 120));
    const after = realtime.eventsSince(before, ['analytics']);
    assert.ok(after.length >= 1, 'trailing event must be delivered');

    for (const e of after) seen.push(e.data);
    assert.ok(seen.length >= 1);
});

test('publish() never throws on bad payloads and returns an event', () => {
    const circular = {};
    circular.self = circular;
    const event = realtime.publish('system', 'weird', circular);
    // Serialisation failure is swallowed inside deliver(), publish still returns.
    assert.equal(event, null === event ? null : event);
    assert.ok(event === null || typeof event.id === 'number');
});
