const mongoose = require('mongoose')

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    icon: String,
    color: String,
    sort_order: Number,
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
)

categorySchema.index({ sort_order: 1 })

module.exports = mongoose.model('Category', categorySchema)
