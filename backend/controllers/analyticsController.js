const QueueEntry = require('../models/QueueEntry');

// @desc    Get queue statistics and analytics
// @route   GET /api/analytics
// @access  Private (Staff only)
const getQueueAnalytics = async (req, res, next) => {
  try {
    const totalEntries = await QueueEntry.countDocuments();
    const waitingCount = await QueueEntry.countDocuments({ status: 'waiting' });
    const servedCount = await QueueEntry.countDocuments({ status: 'served' });

    // MongoDB Aggregation for triage score statistics among waiting patients
    const scoreStats = await QueueEntry.aggregate([
      { $match: { status: 'waiting' } },
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$triageScore' },
          maxScore: { $max: '$triageScore' },
          minScore: { $min: '$triageScore' }
        }
      }
    ]);

    // Breakdown by urgency categories
    const criticalCount = await QueueEntry.countDocuments({ status: 'waiting', triageScore: { $gte: 30 } });
    const emergencyCount = await QueueEntry.countDocuments({ status: 'waiting', triageScore: { $gte: 15, $lt: 30 } });
    const routineCount = await QueueEntry.countDocuments({ status: 'waiting', triageScore: { $lt: 15 } });

    // Most common symptoms via unwind and group aggregation
    const topSymptoms = await QueueEntry.aggregate([
      { $unwind: '$symptoms' },
      { $group: { _id: '$symptoms', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      summary: {
        total: totalEntries,
        waiting: waitingCount,
        served: servedCount,
        avgTriageScore: scoreStats.length > 0 ? Math.round(scoreStats[0].avgScore * 10) / 10 : 0,
        maxTriageScore: scoreStats.length > 0 ? scoreStats[0].maxScore : 0
      },
      urgencyBreakdown: {
        critical: criticalCount,
        emergency: emergencyCount,
        routine: routineCount
      },
      topSymptoms: topSymptoms.map(item => ({ symptom: item._id, count: item.count }))
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getQueueAnalytics };
