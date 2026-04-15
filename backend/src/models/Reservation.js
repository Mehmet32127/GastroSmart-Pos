const mongoose = require('mongoose')

const reservationSchema = new mongoose.Schema(
  {
    table_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Table',
    },
    guest_name: {
      type:     String,
      required: true,
      trim:     true,
    },
    guest_phone: {
      type:     String,
      required: true,
      trim:     true,
    },
    guest_email: {
      type:  String,
      trim:  true,
    },
    party_size: {
      type:     Number,
      required: true,
      min:      1,
    },
    reservation_time: {
      type:     Date,
      required: true,
    },
    duration_minutes: {
      type:    Number,
      default: 120,
    },
    // Computed end time stored for quick querying
    end_time: {
      type: Date,
    },
    notes: String,
    status: {
      type:    String,
      enum:    ['pending', 'confirmed', 'seated', 'completed', 'cancelled'],
      default: 'pending',
    },
    // Deposit tracking
    deposit: {
      type:    Number,
      min:     0,
      default: 0,
    },
    deposit_paid: {
      type:    Boolean,
      default: false,
    },
    deposit_refunded: {
      type:    Boolean,
      default: false,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },
  },
  { timestamps: true }
)

// Auto-compute end_time before save
reservationSchema.pre('save', function (next) {
  if (this.reservation_time && this.duration_minutes) {
    this.end_time = new Date(
      this.reservation_time.getTime() + this.duration_minutes * 60 * 1000
    )
  }
  next()
})

reservationSchema.index({ reservation_time: 1 })
reservationSchema.index({ status: 1 })
reservationSchema.index({ guest_phone: 1 })
reservationSchema.index({ table_id: 1, reservation_time: 1 })

module.exports = mongoose.model('Reservation', reservationSchema)
