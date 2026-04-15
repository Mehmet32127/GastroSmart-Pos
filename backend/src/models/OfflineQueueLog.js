const mongoose = require('mongoose')

const offlineQueueLogSchema = new mongoose.Schema(
  {
    queue_id:     { type: String, required: true, unique: true },
    type:         { type: String, required: true },
    payload:      { type: mongoose.Schema.Types.Mixed, required: true },
    hmac:         { type: String, required: true },
    status:       { type: String, default: 'processed' },
    processed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

offlineQueueLogSchema.index({ createdAt: -1 })

module.exports = mongoose.model('OfflineQueueLog', offlineQueueLogSchema)
