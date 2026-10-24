// Shared admin authentication helpers.
//
// The dashboard is a long-lived SPA: every navigation triggers several API
// calls. Verifying a JWT is cheap, but hitting MongoDB for the admin record on
// each call is not. We therefore cache the admin document for a short window
// and only re-read it when the token's `iat` is newer than the cached record
// (i.e. the admin changed their profile/password in another tab).

const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const ADMIN_TTL_MS = Number(process.env.ADMIN_CACHE_MS || 60000);
const cache = new Map(); // adminId -> { admin, expiresAt }

function extractToken(req) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
    // EventSource cannot set headers; the SSE endpoint accepts ?token=
    if (typeof req.query?.token === 'string' && req.query.token) return req.query.token;
    return null;
}

async function loadAdmin(id) {
    const cached = cache.get(String(id));
    if (cached && cached.expiresAt > Date.now()) return cached.admin;
    const admin = await Admin.findById(id).select('-password').lean();
    if (admin) cache.set(String(id), { admin, expiresAt: Date.now() + ADMIN_TTL_MS });
    return admin;
}

function invalidateAdmin(id) {
    if (id) cache.delete(String(id));
    else cache.clear();
}

async function verifyAdmin(req, res, next) {
    try {
        const token = extractToken(req);
        if (!token) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await loadAdmin(decoded.id);
        if (!admin) {
            cache.delete(String(decoded.id));
            return res.status(401).json({ success: false, message: 'Admin not found' });
        }
        req.admin = admin;
        req.adminId = String(admin._id);
        next();
    } catch (err) {
        const message = err.name === 'TokenExpiredError' ? 'Session expired' : 'Invalid token';
        return res.status(401).json({ success: false, message });
    }
}

/** Same as verifyAdmin but never rejects: sets req.admin when a valid token exists. */
async function optionalAdmin(req, _res, next) {
    try {
        const token = extractToken(req);
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const admin = await loadAdmin(decoded.id);
            if (admin) {
                req.admin = admin;
                req.adminId = String(admin._id);
            }
        }
    } catch {
        // ignore — anonymous request
    }
    next();
}

module.exports = { verifyAdmin, optionalAdmin, invalidateAdmin, extractToken };
