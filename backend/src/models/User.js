const mongoose = require('mongoose')
const bcryptjs = require('bcryptjs')

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password_hash: {
      type: String,
      required: true,
    },
    full_name: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'manager', 'waiter'],
      default: 'waiter',
      required: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
    },
    phone: String,
    is_active: {
      type: Boolean,
      default: true,
    },
    last_login: Date,
  },
  { timestamps: true }
)

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password_hash')) return next()
  try {
    const salt = await bcryptjs.genSalt(
      parseInt(process.env.BCRYPT_ROUNDS) || 12
    )
    this.password_hash = await bcryptjs.hash(this.password_hash, salt)
    next()
  } catch (err) {
    next(err)
  }
})

// Compare password
userSchema.methods.comparePassword = async function (plainPassword) {
  return bcryptjs.compare(plainPassword, this.password_hash)
}

module.exports = mongoose.model('User', userSchema)
