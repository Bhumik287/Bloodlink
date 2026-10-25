/**
 * Administrator REST API Routes
 * Course Reference: Unit-3 Express Routing & Unit-5 Role-Based Access Control (RBAC)
 */

const express = require('express');
const { getDB } = require('../config/db');
const { requireAdmin, toObjectId } = require('../middleware/auth');

const router = express.Router();

// Apply requireAdmin guard to all admin routes
router.use(requireAdmin);

// 1. GET /api/admin/overview - Overall system metrics, requests, and users
router.get('/overview', async (req, res, next) => {
  try {
    const db = getDB();

    const [totalUsers, totalRequests, openRequests, fulfilledRequests] = await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('bloodRequests').countDocuments(),
      db.collection('bloodRequests').countDocuments({ status: { $in: ['open', 'responses_received'] } }),
      db.collection('bloodRequests').countDocuments({ status: 'fulfilled' })
    ]);

    const requests = await db.collection('bloodRequests')
      .find()
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    // Retrieve users excluding password hashes
    const users = await db.collection('users')
      .find({}, { projection: { passwordHash: 0 } })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalRequests,
        openRequests,
        fulfilledRequests
      },
      requests,
      users
    });
  } catch (error) {
    next(error);
  }
});

// 2. PUT /api/admin/requests/:id/status - Moderate and update request status
router.put('/requests/:id/status', async (req, res, next) => {
  try {
    const reqId = toObjectId(req.params.id);
    if (!reqId) {
      return res.status(400).json({ success: false, message: 'Invalid request identifier.' });
    }

    const { status } = req.body;
    const allowed = ['open', 'in_progress', 'fulfilled', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status transition.' });
    }

    const db = getDB();
    const result = await db.collection('bloodRequests').updateOne(
      { _id: reqId },
      { $set: { status, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    res.json({
      success: true,
      message: `Request status updated to ${status}.`
    });
  } catch (error) {
    next(error);
  }
});

// 3. DELETE /api/admin/requests/:id - Delete an inappropriate or spam request
router.delete('/requests/:id', async (req, res, next) => {
  try {
    const reqId = toObjectId(req.params.id);
    if (!reqId) {
      return res.status(400).json({ success: false, message: 'Invalid request identifier.' });
    }

    const db = getDB();
    await Promise.all([
      db.collection('bloodRequests').deleteOne({ _id: reqId }),
      db.collection('donorResponses').deleteMany({ requestId: reqId })
    ]);

    res.json({
      success: true,
      message: 'Request and associated responses deleted permanently.'
    });
  } catch (error) {
    next(error);
  }
});

// 4. PUT /api/admin/users/:id/status - Suspend or activate a user
router.put('/users/:id/status', async (req, res, next) => {
  try {
    const targetUserId = toObjectId(req.params.id);
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Invalid user identifier.' });
    }

    const { status } = req.body;
    if (status !== 'active' && status !== 'suspended') {
      return res.status(400).json({ success: false, message: 'Status must be active or suspended.' });
    }

    const db = getDB();
    const user = await db.collection('users').findOne({ _id: targetUserId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot modify administrator status.' });
    }

    await db.collection('users').updateOne(
      { _id: targetUserId },
      { $set: { status, updatedAt: new Date() } }
    );

    res.json({
      success: true,
      message: `User status changed to ${status}.`
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
