const mongoose = require('mongoose')

const cashCloseSchema = new mongoose.Schema(
  {
    cash_total:     { type: Number, required: true },
    expected_total: { type: Number, required: true },
    difference:     { type: Number, required: true },
    banknotes:      { type: mongoose.Schema.Types.Mixed, default: {} },
    note:           String,
    closed_by:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

cashCloseSchema.index({ createdAt: -1 })

module.exports = mongoose.model('CashClose', cashCloseSchema)
