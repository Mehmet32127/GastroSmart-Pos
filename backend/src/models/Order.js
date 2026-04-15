const mongoose = require('mongoose')

// ── Order Item ────────────────────────────────────────────────────────────────
const orderItemSchema = new mongoose.Schema(
  {
    menu_item_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    menu_item_name: { type: String, required: true },
    quantity:   { type: Number, required: true, min: 0.01 },
    unit_price: { type: Number, required: true, min: 0 },
    total_price:{ type: Number, required: true, min: 0 },
    tax:        { type: Number, default: 8, min: 0 },
    note:       String,
    status: {
      type: String,
      enum: ['pending', 'preparing', 'served', 'cancelled'],
      default: 'pending',
    },
    waiter_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    waiter_name: String,
  },
  { timestamps: true }
)

// ── Order ─────────────────────────────────────────────────────────────────────
const orderSchema = new mongoose.Schema(
  {
    table_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
    waiter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
    items: [orderItemSchema],

    // Financials
    subtotal:      { type: Number, default: 0 },
    tax_total:     { type: Number, default: 0 },
    discount:      { type: Number, default: 0 },
    discount_type: { type: String, enum: ['percent', 'amount'], default: 'percent' },
    total:         { type: Number, default: 0 },

    // Payment (filled on close)
    paid_amount:    { type: Number, default: 0 },
    cash_amount:    Number,
    card_amount:    Number,
    change_amount:  { type: Number, default: 0 },
    payment_method: {
      type: String,
      enum: ['cash', 'card', 'mixed', 'complimentary'],
    },

    // Meta
    guest_count: { type: Number, default: 1, min: 1 },
    note: String,
    status: {
      type: String,
      enum: ['open', 'closed', 'cancelled', 'voided'],
      default: 'open',
    },
    closed_at: Date,
  },
  { timestamps: true }
)

orderSchema.index({ table_id: 1, status: 1 })
orderSchema.index({ waiter_id: 1 })
orderSchema.index({ status: 1 })
orderSchema.index({ createdAt: -1 })
orderSchema.index({ status: 1, closed_at: 1 })   // rapor sorguları için
orderSchema.index({ closed_at: 1 })               // tarih aralığı filtreleri için

/**
 * Recalculates subtotal, tax_total, and total based on active items.
 * Call before save() when items change.
 */
orderSchema.methods.recalculate = function () {
  const active = this.items.filter(i => i.status !== 'cancelled')
  this.subtotal  = active.reduce((s, i) => s + i.total_price, 0)
  this.tax_total = active.reduce((s, i) => s + (i.total_price * i.tax) / (100 + i.tax), 0)
  const disc = this.discount_type === 'percent'
    ? this.subtotal * (this.discount / 100)
    : this.discount
  this.total = Math.max(0, parseFloat((this.subtotal - disc).toFixed(2)))
  return this
}

module.exports = mongoose.model('Order', orderSchema)
