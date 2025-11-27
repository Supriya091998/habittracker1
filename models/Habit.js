const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema(
  {
    // optional reference to a User (if you have auth)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },

    // display name (for UI, even without auth)
    userName: { type: String, trim: true },

    // habit name
    name: { type: String, required: true, trim: true },

    // daily or weekly habit
    frequency: {
      type: String,
      enum: ['daily', 'weekly'],
      default: 'daily',
    },

    // every completion is stored as a Date
    datesDone: [{ type: Date }],
  },
  { timestamps: true }
);

// virtual: total number of times this habit was completed
habitSchema.virtual('totalCompletions').get(function () {
  return this.datesDone ? this.datesDone.length : 0;
});

// virtual: most recent completion date
habitSchema.virtual('lastDone').get(function () {
  if (!this.datesDone || this.datesDone.length === 0) return null;
  return this.datesDone[this.datesDone.length - 1];
});

// include virtuals when converting to objects / JSON
habitSchema.set('toObject', { virtuals: true });
habitSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Habit', habitSchema);
