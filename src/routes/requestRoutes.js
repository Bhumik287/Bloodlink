/**
 * Blood Requests REST API Routes
 * Course Reference: Unit-3 Express Routing & Unit-4 MongoDB Operations
 */

const express = require('express');
const { getDB } = require('../config/db');
const { requireAuth, requireRole, toObjectId } = require('../middleware/auth');

const router = express.Router();

const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const VALID_COMPONENTS = ['whole_blood', 'platelets'];
const VALID_URGENCIES = ['immediate', 'within_24h', 'within_48h'];

// 1. GET /api/requests/stats - Live database counters for home page
router.get('/stats', async (req, res, next) => {
  try {
    const db = getDB();
    const [openRequests, totalDonors, fulfilledRequests] = await Promise.all([
      db.collection('bloodRequests').countDocuments({ status: { $in: ['open', 'responses_received'] } }),
      db.collection('users').countDocuments({ role: 'donor', status: 'active' }),
      db.collection('bloodRequests').countDocuments({ status: 'fulfilled' })
    ]);

    res.json({
      success: true,
      stats: {
        openRequests,
        totalDonors,
        fulfilledRequests
      }
    });
  } catch (error) {
    next(error);
  }
});

// 2. GET /api/requests/my - Get requests submitted by current user
router.get('/my', requireAuth, async (req, res, next) => {
  try {
    const db = getDB();
    const userId = toObjectId(req.session.user._id);

    const requests = await db.collection('bloodRequests')
      .find({ requesterId: userId })
      .sort({ createdAt: -1 })
      .toArray();

    // Attach response counts for each request
    const responseCounts = await db.collection('donorResponses').aggregate([
      { $match: { requestId: { $in: requests.map(r => r._id) } } },
      { $group: { _id: '$requestId', count: { $sum: 1 } } }
    ]).toArray();

    const countMap = {};
    responseCounts.forEach(rc => {
      countMap[rc._id.toString()] = rc.count;
    });

    const enrichedRequests = requests.map(r => ({
      ...r,
      responseCount: countMap[r._id.toString()] || 0
    }));

    res.json({
      success: true,
      requests: enrichedRequests
    });
  } catch (error) {
    next(error);
  }
});

// 3. GET /api/requests/notifications - Get in-app alerts for user
router.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const db = getDB();
    const userId = toObjectId(req.session.user._id);

    const notifications = await db.collection('notifications')
      .find({ userId: userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    res.json({
      success: true,
      notifications
    });
  } catch (error) {
    next(error);
  }
});

// 4. PUT /api/requests/notifications/read - Mark user notifications as read
router.put('/notifications/read', requireAuth, async (req, res, next) => {
  try {
    const db = getDB();
    const userId = toObjectId(req.session.user._id);

    await db.collection('notifications').updateMany(
      { userId: userId, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({ success: true, message: 'Notifications marked as read.' });
  } catch (error) {
    next(error);
  }
});

// 5. GET /api/requests - Public discovery with search & filters
router.get('/', async (req, res, next) => {
  try {
    const { bloodGroup, componentType, urgency, search, city, sortBy } = req.query;
    const db = getDB();

    // Base query: Only show active emergency requests
    const query = {
      status: { $in: ['open', 'responses_received'] }
    };

    if (bloodGroup && VALID_BLOOD_GROUPS.includes(bloodGroup)) {
      query.bloodGroup = bloodGroup;
    }

    if (componentType && VALID_COMPONENTS.includes(componentType)) {
      query.componentType = componentType;
    }

    if (urgency && VALID_URGENCIES.includes(urgency)) {
      query.urgency = urgency;
    }

    if (city && city.trim()) {
      query.city = { $regex: new RegExp(city.trim(), 'i') };
    }

    if (search && search.trim()) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(sanitized, 'i');
      query.$or = [
        { hospitalName: regex },
        { city: regex },
        { locality: regex },
        { patientName: regex }
      ];
    }

    // Determine sorting
    let sortObj = { createdAt: -1 };
    if (sortBy === 'urgency') {
      // Prioritize immediate, then within_24h, then within_48h
      sortObj = { urgency: 1, createdAt: -1 };
    }

    const requests = await db.collection('bloodRequests')
      .find(query)
      .sort(sortObj)
      .limit(50)
      .toArray();

    res.json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (error) {
    next(error);
  }
});

// 6. POST /api/requests - Create a new emergency blood request
router.post('/', async (req, res, next) => {
  try {
    const {
      patientName,
      bloodGroup,
      componentType,
      unitsRequired,
      urgency,
      requiredDate,
      hospitalName,
      city,
      locality,
      hospitalAddress,
      requesterName,
      contactPhone,
      notes
    } = req.body;

    // Field Validations
    if (!patientName || !bloodGroup || !hospitalName || !city || !requesterName || !contactPhone) {
      return res.status(400).json({
        success: false,
        message: 'Patient name, blood group, hospital name, city, requester name, and contact phone are required.'
      });
    }

    if (!VALID_BLOOD_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({
        success: false,
        message: `Invalid blood group. Supported values: ${VALID_BLOOD_GROUPS.join(', ')}`
      });
    }

    const units = parseInt(unitsRequired, 10);
    if (isNaN(units) || units < 1 || units > 10) {
      return res.status(400).json({
        success: false,
        message: 'Units required must be an integer between 1 and 10.'
      });
    }

    if (!/^[0-9]{10}$/.test(contactPhone.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Contact mobile number must be exactly 10 digits.'
      });
    }

    const db = getDB();
    const requesterId = req.session?.user?._id ? toObjectId(req.session.user._id) : null;

    const newRequest = {
      requesterId: requesterId,
      requesterName: requesterName.trim(),
      contactPhone: contactPhone.trim(),
      patientName: patientName.trim(),
      bloodGroup: bloodGroup,
      componentType: componentType === 'platelets' ? 'platelets' : 'whole_blood',
      unitsRequired: units,
      hospitalName: hospitalName.trim(),
      hospitalAddress: (hospitalAddress || '').trim(),
      city: city.trim(),
      locality: (locality || '').trim(),
      urgency: VALID_URGENCIES.includes(urgency) ? urgency : 'within_24h',
      requiredDate: requiredDate || null,
      notes: (notes || '').trim(),
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const insertRes = await db.collection('bloodRequests').insertOne(newRequest);

    res.status(201).json({
      success: true,
      message: 'Emergency blood request registered successfully.',
      requestId: insertRes.insertedId.toString(),
      request: newRequest
    });
  } catch (error) {
    next(error);
  }
});

// 7. GET /api/requests/:id - Get single request details
router.get('/:id', async (req, res, next) => {
  try {
    const reqId = toObjectId(req.params.id);
    if (!reqId) {
      return res.status(400).json({ success: false, message: 'Invalid request identifier format.' });
    }

    const db = getDB();
    const request = await db.collection('bloodRequests').findOne({ _id: reqId });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    res.json({ success: true, request });
  } catch (error) {
    next(error);
  }
});

// 8. PUT /api/requests/:id/status - Update coordination status (Fulfilled / Cancelled)
router.put('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const reqId = toObjectId(req.params.id);
    if (!reqId) {
      return res.status(400).json({ success: false, message: 'Invalid request identifier.' });
    }

    const { status } = req.body;
    const allowedStatuses = ['fulfilled', 'cancelled', 'open'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Permitted transitions: ${allowedStatuses.join(', ')}`
      });
    }

    const db = getDB();
    const existing = await db.collection('bloodRequests').findOne({ _id: reqId });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    // Ownership check: Must be the requester who created it or an admin
    const currentUserId = req.session.user._id;
    const isOwner = existing.requesterId && existing.requesterId.toString() === currentUserId;
    const isAdmin = req.session.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: You can only update requests you submitted.'
      });
    }

    await db.collection('bloodRequests').updateOne(
      { _id: reqId },
      { $set: { status: status, updatedAt: new Date() } }
    );

    res.json({
      success: true,
      message: `Request status successfully updated to ${status}.`
    });
  } catch (error) {
    next(error);
  }
});

// 9. POST /api/requests/:id/respond - Donor pledges availability to help
router.post('/:id/respond', requireAuth, async (req, res, next) => {
  try {
    const reqId = toObjectId(req.params.id);
    if (!reqId) {
      return res.status(400).json({ success: false, message: 'Invalid request identifier.' });
    }

    const user = req.session.user;
    if (user.role !== 'donor' && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only registered donor accounts can respond to blood requests.'
      });
    }

    const db = getDB();
    const bloodReq = await db.collection('bloodRequests').findOne({ _id: reqId });
    if (!bloodReq) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    if (bloodReq.status === 'fulfilled' || bloodReq.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `Cannot respond: this blood request is already marked as ${bloodReq.status}.`
      });
    }

    const donorId = toObjectId(user._id);

    // Prevent duplicate response
    const existingResponse = await db.collection('donorResponses').findOne({
      requestId: reqId,
      donorId: donorId
    });

    if (existingResponse) {
      return res.status(400).json({
        success: false,
        message: 'You have already pledged availability for this blood request.'
      });
    }

    // Lookup donor's blood group from donor profile
    const donorProfile = await db.collection('donorProfiles').findOne({ userId: donorId });
    const donorBloodGroup = donorProfile?.bloodGroup || 'Donor';

    const responseDoc = {
      requestId: reqId,
      donorId: donorId,
      donorName: user.name,
      donorPhone: user.phone,
      donorBloodGroup: donorBloodGroup,
      donorCity: user.city,
      message: (req.body.message || '').trim(),
      status: 'pending',
      createdAt: new Date()
    };

    await db.collection('donorResponses').insertOne(responseDoc);

    // Update blood request status to responses_received if it was open
    if (bloodReq.status === 'open') {
      await db.collection('bloodRequests').updateOne(
        { _id: reqId },
        { $set: { status: 'responses_received', updatedAt: new Date() } }
      );
    }

    // Create an in-app notification for the requester
    if (bloodReq.requesterId) {
      await db.collection('notifications').insertOne({
        userId: bloodReq.requesterId,
        title: 'New Donor Response',
        message: `${user.name} (${donorBloodGroup}) has pledged availability for patient ${bloodReq.patientName}.`,
        relatedRequestId: reqId,
        isRead: false,
        createdAt: new Date()
      });
    }

    res.status(201).json({
      success: true,
      message: 'Thank you! Your availability has been shared with the requester.'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a response for this request.'
      });
    }
    next(error);
  }
});

// 10. GET /api/requests/:id/responses - View donor responses for a request
router.get('/:id/responses', requireAuth, async (req, res, next) => {
  try {
    const reqId = toObjectId(req.params.id);
    if (!reqId) {
      return res.status(400).json({ success: false, message: 'Invalid request identifier.' });
    }

    const db = getDB();
    const bloodReq = await db.collection('bloodRequests').findOne({ _id: reqId });
    if (!bloodReq) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    // Ownership check: Requester or admin only
    const currentUserId = req.session.user._id;
    const isOwner = bloodReq.requesterId && bloodReq.requesterId.toString() === currentUserId;
    const isAdmin = req.session.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only view responses for your own requests.'
      });
    }

    const responses = await db.collection('donorResponses')
      .find({ requestId: reqId })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      responses
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
