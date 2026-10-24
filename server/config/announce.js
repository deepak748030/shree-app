// One-liner used by write routes to (a) invalidate caches and (b) push a
// realtime event, in the right order. Keeping it in one place means a new
// endpoint cannot accidentally notify the dashboard *before* the cache is
// invalidated (which would let a client refetch the old value).
//
//   const { announce } = require('../config/announce');
//   announce('quotes', 'changed', { id }, ['quotes', 'analytics']);

const realtime = require('./realtime');

function announce(topic, type, payload = {}, invalidate = []) {
    return realtime.publish(topic, type, payload, { invalidate });
}

/** Coalesced variant for hot paths (Naam Jap taps, step sync, …). */
function announceThrottled(topic, type, payload = {}, invalidate = []) {
    return realtime.publishThrottled(topic, type, payload, { invalidate });
}

module.exports = { announce, announceThrottled, publish: announce, publishThrottled: announceThrottled };
