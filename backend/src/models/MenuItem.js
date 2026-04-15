const mongoose = require('mongoose')

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    cost: Number,
    description: String,
    image_url: String,
    is_available: {
      type: Boolean,
      default: true,
    },
    stock_quantity: Number,
    preparation_time: Number, // minutes
    is_spicy: Boolean,
    is_vegetarian: Boolean,
    is_vegan: Boolean,
    allergens: [String],
    sort_order: Number,
    min_stock:  Number,
    unit:       { type: String, default: 'adet' },
    tax:        { type: Number, default: 8 },
    tags:       [String],
  },
  { timestamps: true }
)

menuItemSchema.index({ category_id: 1 })
menuItemSchema.index({ name: 1 })
menuItemSchema.index({ is_available: 1 })
menuItemSchema.index({ is_available: 1, stock_quantity: 1 })  // stok raporu için

module.exports = mongoose.model('MenuItem', menuItemSchema)
