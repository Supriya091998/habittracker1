// routes/habits.js
const express = require('express');
const Habit = require('../models/Habit');

const router = express.Router();

// protect routes
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

// streak calc (daily + weekly)
function calculateStreak(habit) {
  if (!habit.datesDone || habit.datesDone.length === 0) return 0;

  const dates = habit.datesDone
    .map((d) => new Date(d))
    .sort((a, b) => b - a); // newest → oldest

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;

  // DAILY STREAK
  if (habit.frequency === 'daily') {
    for (let i = 0; i < dates.length; i++) {
      const d = new Date(dates[i]);
      d.setHours(0, 0, 0, 0);

      const expected = new Date(today);
      expected.setDate(today.getDate() - streak);

      if (d.getTime() === expected.getTime()) {
        streak++;
      } else if (d.getTime() < expected.getTime()) {
        // we hit a gap
        break;
      }
    }
    return streak;
  }

  // WEEKLY STREAK
  if (habit.frequency === 'weekly') {
    for (let i = 0; i < dates.length; i++) {
      const d = new Date(dates[i]);
      d.setHours(0, 0, 0, 0);

      const expectedStart = new Date(today);
      expectedStart.setDate(today.getDate() - streak * 7);
      expectedStart.setHours(0, 0, 0, 0);

      const diffDays =
        Math.abs(expectedStart.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);

      // if we did the habit sometime in that 7-day window
      if (diffDays <= 6) {
        streak++;
      } else if (d.getTime() < expectedStart.getTime()) {
        break;
      }
    }
    return streak;
  }

  return streak;
}

// HOME IS IN auth.js – this router handles /habits pages only

// LIST HABITS
router.get('/habits', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const habits = await Habit.find({ user: userId }).sort({ createdAt: -1 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const attention = [];
  let doneTodayCount = 0;

  const mapped = habits.map((h) => {
    const streak = calculateStreak(h);

    const sortedDates = (h.datesDone || [])
      .map((d) => new Date(d))
      .sort((a, b) => b - a);

    const latest = sortedDates[0] || null;

    const didToday = sortedDates.some((d) => {
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });

    if (didToday) doneTodayCount++;

    let reminderText = '';
    let reminderClass = '';
    let needsAttention = false;

    if (h.frequency === 'daily') {
      if (didToday) {
        reminderText = 'Completed today. Keep it going.';
        reminderClass = 'reminder-success';
      } else {
        reminderText = 'Not done today yet.';
        reminderClass = 'reminder-warn';
        needsAttention = true;
      }
    } else {
      // weekly
      if (!latest) {
        reminderText = 'Weekly habit not done this week.';
        reminderClass = 'reminder-warn';
        needsAttention = true;
      } else {
        const diffDays =
          (today.getTime() - latest.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays <= 6) {
          reminderText = 'Done this week. Nice!';
          reminderClass = 'reminder-success';
        } else {
          reminderText = 'Not done this week yet.';
          reminderClass = 'reminder-warn';
          needsAttention = true;
        }
      }
    }

    if (needsAttention) attention.push(h);

    return {
      ...h.toObject(),
      streak,
      didToday,
      reminderText,
      reminderClass,
    };
  });

  const message = req.query.msg || '';

  res.render('habits', {
    habits: mapped,
    message,
    attention,
    total: habits.length,
    doneTodayCount,
    currentUserName: req.session.userName || '',
  });
});

// SHOW NEW HABIT FORM
router.get('/habits/new', requireLogin, (req, res) => {
  res.render('new', { currentUserName: req.session.userName || '' });
});

// CREATE HABIT
router.post('/habits', requireLogin, async (req, res) => {
  const { name, frequency, notes } = req.body;

  await Habit.create({
    user: req.session.userId,
    userName: req.session.userName,
    name,
    frequency,
    notes,
  });

  res.redirect('/habits');
});

// MARK TODAY DONE
router.post('/habits/:id/done', requireLogin, async (req, res) => {
  const habit = await Habit.findOne({
    _id: req.params.id,
    user: req.session.userId,
  });

  if (!habit) return res.redirect('/habits');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const already = (habit.datesDone || []).some((d) => {
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    return dd.getTime() === today.getTime();
  });

  const userName = req.session.userName || 'Great job';

  if (!already) {
    habit.datesDone.push(today);
    await habit.save();

    return res.redirect(
      '/habits?msg=' + encodeURIComponent(userName + ', excellent job today!')
    );
  }

  return res.redirect('/habits?msg=' + encodeURIComponent('You already marked today ✅'));
});

// DELETE HABIT
router.post('/habits/:id/delete', requireLogin, async (req, res) => {
  await Habit.findOneAndDelete({
    _id: req.params.id,
    user: req.session.userId,
  });
  res.redirect('/habits');
});

// STATS PAGE (enhanced for charts + summaries)
router.get('/habits/stats', requireLogin, async (req, res) => {
  const habits = await Habit.find({ user: req.session.userId }).sort({
    createdAt: -1,
  });

  // Attach streak to each habit
  const withStreak = habits.map((h) => ({
    ...h.toObject(),
    streak: calculateStreak(h),
  }));

  const dailyHabits = withStreak.filter((h) => h.frequency === 'daily');
  const weeklyHabits = withStreak.filter((h) => h.frequency === 'weekly');

  // Summary: longest streak + most completed
  let bestStreakHabit = null;
  let bestStreakValue = 0;
  let mostCompletedHabit = null;
  let mostCompletedCount = 0;

  withStreak.forEach((h) => {
    const completions = (h.datesDone || []).length;

    if (h.streak > bestStreakValue) {
      bestStreakValue = h.streak;
      bestStreakHabit = h;
    }

    if (completions > mostCompletedCount) {
      mostCompletedCount = completions;
      mostCompletedHabit = h;
    }
  });

  // Trend data: last 7 days total completions across all habits
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const trendLabels = [];
  const trendCounts = new Array(7).fill(0);
  const options = { month: 'short', day: 'numeric' };

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    trendLabels.push(d.toLocaleDateString('en-US', options));
  }

  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  withStreak.forEach((h) => {
    (h.datesDone || []).forEach((d) => {
      const dd = new Date(d);
      dd.setHours(0, 0, 0, 0);

      const diffDays = Math.round((today.getTime() - dd.getTime()) / MS_PER_DAY);
      // 0 = today, 6 = 6 days ago
      if (diffDays >= 0 && diffDays <= 6) {
        const indexFromLeft = 6 - diffDays; // align with label index
        trendCounts[indexFromLeft] += 1;
      }
    });
  });

  res.render('stats', {
    habits: withStreak,
    dailyHabits,
    weeklyHabits,
    currentUserName: req.session.userName || '',
    bestStreakHabit,
    bestStreakValue,
    mostCompletedHabit,
    mostCompletedCount,
    trendLabels,
    trendCounts,
  });
});

module.exports = router;
