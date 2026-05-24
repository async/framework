export function generateRandomTodo() {
  const actions = [
    "Review",
    "Complete",
    "Update",
    "Write",
    "Plan",
    "Research",
    "Organize",
    "Schedule",
    "Prepare",
    "Create",
  ];

  const subjects = [
    "project documentation",
    "weekly report",
    "team meeting notes",
    "presentation slides",
    "budget proposal",
    "client feedback",
    "code review",
    "user research",
    "marketing strategy",
    "design mockups",
  ];

  const timeframes = [
    "for tomorrow",
    "by end of week",
    "before deadline",
    "for next sprint",
    "this afternoon",
    "",
    "by Monday",
    "for the meeting",
    "ASAP",
    "within 2 days",
  ];

  const action = actions[Math.floor(Math.random() * actions.length)];
  const subject = subjects[Math.floor(Math.random() * subjects.length)];
  const timeframe = timeframes[Math.floor(Math.random() * timeframes.length)];

  return `${action} ${subject} ${timeframe}`.trim();
}
