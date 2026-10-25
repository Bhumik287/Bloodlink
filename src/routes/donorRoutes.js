/**
 * Donor Management REST API Routes
 * Course Reference: Unit-3 Express Routing & Unit-4 MongoDB Operations
 */

const express = require('express');
const { getDB } = require('../config/db');
const { requireAuth, toObjectId } = require('../middleware/auth');

const router = express.Router();

// 1. GET /api/donors/profile - Get donor's profile & availability
router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const db = getDB();
    const userId = toObjectId(req.session.user._id);

    const profile = await db.collection('donorProfiles').findOne({ userId: userId });

    res.json({
      success: true,
      profile: profile || {
        bloodGroup: '',
        isAvailable: true,
        contactPreference: 'phone'
      }
    });
  } catch (error) {
    next(error);
  }
});

// 2. PUT /api/donors/profile - Update donor's profile & availability switch
router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const { name, phone, city, locality, bloodGroup, isAvailable } = req.body;
    const db = getDB();
    const userId = toObjectId(req.session.user._id);

    // Update base user details in users collection
    const userUpdate = {};
    if (name) userUpdate.name = name.trim();
    if (phone) userUpdate.phone = phone.trim();
    if (city) userUpdate.city = city.trim();
    if (locality) userUpdate.locality = locality.trim();

    if (Object.keys(userUpdate).length > 0) {
      await db.collection('users').updateOne(
        { _id: userId },
        { $set: userUpdate }
      );
      // Update session cache
      req.session.user.name = userUpdate.name || req.session.user.name;
      req.session.user.phone = userUpdate.phone || req.session.user.phone;
      req.session.user.city = userUpdate.city || req.session.user.city;
      req.session.user.locality = userUpdate.locality || req.session.user.locality;
    }

    // Update or upsert donor profile
    await db.collection('donorProfiles').updateOne(
      { userId: userId },
      {
        $set: {
          userId: userId,
          bloodGroup: bloodGroup || 'O+',
          city: (city || req.session.user.city || '').trim(),
          locality: (locality || req.session.user.locality || '').trim(),
          isAvailable: isAvailable !== false,
          lastUpdated: new Date()
        }
      },
      { upsert: true }
    );

    res.json({
      success: true,
      message: 'Donor profile and availability successfully updated.'
    });
  } catch (error) {
    next(error);
  }
});

// 3. GET /api/donors/my-responses - Get all donation pledges made by logged-in donor
router.get('/my-responses', requireAuth, async (req, res, next) => {
  try {
    const db = getDB();
    const userId = toObjectId(req.session.user._id);

    const responses = await db.collection('donorResponses')
      .find({ donorId: userId })
      .sort({ createdAt: -1 })
      .toArray();

    // Enrich responses with hospital and request information
    const requestIds = responses.map(r => r.requestId);
    const requests = await db.collection('bloodRequests')
      .find({ _id: { $in: requestIds } })
      .toArray();

    const requestMap = {};
    requests.forEach(reqDoc => {
      requestMap[reqDoc._id.toString()] = reqDoc;
    });

    const enriched = responses.map(r => {
      const parentReq = requestMap[r.requestId.toString()] || {};
      return {
        ...r,
        hospitalName: parentReq.hospitalName || 'Emergency Location',
        requestBloodGroup: parentReq.bloodGroup || '-',
        requestPatientName: parentReq.patientName || 'Patient',
        urgency: parentReq.urgency || 'Standard'
      };
    });

    res.json({
      success: true,
      responses: enriched
    });
  } catch (error) {
    next(error);
  }
});

// 4. DELETE /api/donors/responses/:id - Cancel a donor response
router.delete('/responses/:id', requireAuth, async (req, res, next) => {
  try {
    const respId = toObjectId(req.params.id);
    if (!respId) {
      return res.status(400).json({ success: false, message: 'Invalid response identifier.' });
    }

    const db = getDB();
    const userId = toObjectId(req.session.user._id);

    const response = await db.collection('donorResponses').findOne({ _id: respId });
    if (!response) {
      return res.status(404).json({ success: false, message: 'Response record not found.' });
    }

    // Ownership check: only the donor or an admin can cancel
    if (response.donorId.toString() !== userId.toString() && req.session.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: You can only cancel your own responses.'
      });
    }

    await db.collection('donorResponses').deleteOne({ _id: respId });

    res.json({
      success: true,
      message: 'Donation pledge response cancelled.'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
