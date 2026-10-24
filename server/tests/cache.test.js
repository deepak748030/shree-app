const test = require('node:test');
const assert = require('node:assert/strict');

// Make sure Redis is not used in unit tests even if the developer has env vars.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const cache = require('../config/cache');

test('cached() serves memory hits without calling the loader twice', async () => {
    cache.clearLocal();
    let calls = 0;
    const loader = async () => {
        calls += 1;
        return { value: calls };
    };

    const first = await cache.cached('unit', 'basic', 60, loader);
    const second = await cache.cached('unit', 'basic', 60, loader);

    assert.equal(calls, 1);
    assert.deepEqual(first, { value: 1 });
    assert.deepEqual(second, { value: 1 });
});

test('bump() invalidates every key in a namespace instantly', async () => {
    cache.clearLocal();
    let calls = 0;
    const loader = async () => ++calls;

    assert.equal(await cache.cached('ns-a', 'k', 60, loader), 1);
    assert.equal(await cache.cached('ns-a', 'k', 60, loader), 1);

    cache.bump('ns-a');
    assert.equal(await cache.cached('ns-a', 'k', 60, loader), 2);

    // Other namespaces are untouched.
    assert.equal(await cache.cached('ns-b', 'k', 60, loader), 3);
    assert.equal(await cache.cached('ns-b', 'k', 60, loader), 3);
});

test('concurrent identical loads are collapsed into one (single flight)', async () => {
    cache.clearLocal();
    let calls = 0;
    const loader = async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 30));
        return calls;
    };

    const results = await Promise.all(
        Array.from({ length: 10 }, () => cache.cached('unit', 'flight', 60, loader))
    );

    assert.equal(calls, 1, 'loader must be invoked exactly once');
    assert.ok(results.every((r) => r === 1));
});

test('expired entries are reloaded', async () => {
    cache.clearLocal();
    let calls = 0;
    const loader = async () => ++calls;

    await cache.cached('unit', 'ttl', 0.05, loader);
    assert.equal(await cache.cached('unit', 'ttl', 0.05, loader), 1);
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(await cache.cached('unit', 'ttl', 0.05, loader), 2);
});

test('stats() reports hits and misses', async () => {
    cache.clearLocal();
    const loader = async () => 'x';
    await cache.cached('unit', 'stats', 60, loader);
    await cache.cached('unit', 'stats', 60, loader);
    const stats = cache.stats();
    assert.ok(stats.hits >= 1);
    assert.ok(stats.loads >= 1);
    assert.equal(typeof stats.hitRate, 'number');
    assert.equal(stats.redis, false);
});

test('failing loaders are not cached', async () => {
    cache.clearLocal();
    let calls = 0;
    const loader = async () => {
        calls += 1;
        if (calls === 1) throw new Error('boom');
        return 'recovered';
    };

    await assert.rejects(() => cache.cached('unit', 'err', 60, loader));
    assert.equal(await cache.cached('unit', 'err', 60, loader), 'recovered');
    assert.equal(calls, 2);
});
