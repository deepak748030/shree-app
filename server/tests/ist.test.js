const test = require('node:test');
const assert = require('node:assert/strict');
const ist = require('../utils/ist');

test('today() is a valid IST calendar date', () => {
    const value = ist.today();
    assert.match(value, /^\d{4}-\d{2}-\d{2}$/);

    const istNow = new Date(Date.now() + 330 * 60 * 1000);
    const expected = `${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, '0')}-${String(
        istNow.getUTCDate()
    ).padStart(2, '0')}`;
    assert.equal(value, expected);
});

test('IST rolls over at 18:30 UTC, not at UTC midnight', () => {
    // 2026-03-01T18:29:00Z -> 2026-03-01 23:59 IST
    assert.equal(ist.toDateString(new Date('2026-03-01T18:29:00Z')), '2026-03-01');
    // 2026-03-01T18:31:00Z -> 2026-03-02 00:01 IST
    assert.equal(ist.toDateString(new Date('2026-03-01T18:31:00Z')), '2026-03-02');
});

test('daysAgo and daysWindow are ordered and contiguous', () => {
    const window = ist.daysWindow(7);
    assert.equal(window.length, 7);
    assert.equal(window[6], ist.today());
    assert.equal(window[5], ist.daysAgo(1));
    for (let i = 1; i < window.length; i++) {
        assert.ok(window[i] > window[i - 1], 'window must be sorted ascending');
    }
});

test('shortLabel formats without throwing', () => {
    assert.equal(typeof ist.shortLabel('2026-10-24'), 'string');
    assert.ok(ist.shortLabel('2026-10-24').length > 0);
    assert.equal(ist.shortLabel('not-a-date'), 'not-a-date');
});

test('startOfISTDay is midnight IST expressed in UTC', () => {
    const start = ist.startOfISTDay(new Date('2026-10-24T10:00:00Z'));
    assert.equal(start.toISOString(), '2026-10-23T18:30:00.000Z');
});
