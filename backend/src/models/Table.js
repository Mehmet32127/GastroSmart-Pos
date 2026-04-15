const mongoose = require('mongoose')

const tableSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true },
    name:   { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1, default: 4 },
    section: { type: String, trim: true, default: 'Salon' },
    status: {
      type: String,
      enum: ['available', 'occupied', 'reserved', 'cleaning'],
      default: 'available',
    },
  },
  { timestamps: true }
)

tableSchema.index({ status: 1 })

module.exports = mongoose.model('Table', tableSchema)
