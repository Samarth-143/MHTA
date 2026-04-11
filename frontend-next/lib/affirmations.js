const AFFIRMATIONS = [
  "I believe in my ability to grow and improve every day.",
  "I am worthy of love, respect, and happiness.",
  "I choose to focus on what I can control.",
  "I radiate confidence and positivity.",
  "I am stronger than my challenges.",
  "I embrace change as an opportunity to grow.",
  "I trust the journey of my life.",
  "I am becoming the best version of myself.",
  "I deserve success and fulfillment.",
  "I am proud of how far I have come.",
  "I handle challenges with grace and courage.",
  "I am filled with creative energy.",
  "I am enough just as I am.",
  "I choose happiness in this moment.",
  "I am resilient and can overcome anything.",
  "I attract positive opportunities into my life.",
  "I am constantly learning and evolving.",
  "I trust myself to make the right decisions.",
  "I am surrounded by positivity.",
  "I believe in my dreams.",
  "I am capable of achieving my goals.",
  "I choose peace over worry.",
  "I am confident in my unique abilities.",
  "I deserve good things in life.",
  "I am grateful for today.",
  "I am open to new possibilities.",
  "I create my own success.",
  "I am calm and in control.",
  "I am fearless in pursuing my passions.",
  "I trust my intuition.",
  "I am growing stronger every day.",
  "I bring value wherever I go.",
  "I am proud of who I am becoming.",
  "I choose progress over perfection.",
  "I am worthy of my dreams.",
  "I embrace my individuality.",
  "I am confident in my journey.",
  "I deserve to be happy.",
  "I am in charge of my mindset.",
  "I choose to see the good in everything.",
  "I am resilient in tough times.",
  "I am capable of amazing things.",
  "I trust the timing of my life.",
  "I am becoming more confident every day.",
  "I am focused and determined.",
  "I am worthy of success.",
  "I attract positivity into my life.",
  "I am grateful for my growth.",
  "I am proud of my efforts.",
  "I am confident in my path.",
  "I choose to believe in myself.",
  "I am filled with motivation.",
  "I am capable of handling anything.",
  "I trust my abilities.",
  "I am open to success.",
  "I deserve peace and happiness.",
  "I am constantly improving.",
  "I am strong and courageous.",
  "I choose positivity.",
  "I am aligned with my goals.",
  "I am worthy of respect.",
  "I trust the process.",
  "I am confident and bold.",
  "I am grateful for my journey.",
  "I am growing every day.",
  "I choose to stay positive.",
  "I am capable and strong.",
  "I am deserving of success.",
  "I trust myself completely.",
  "I am proud of my progress.",
  "I am focused on my goals.",
  "I am confident in my skills.",
  "I choose happiness daily.",
  "I am resilient and brave.",
  "I am open to growth.",
  "I trust my path.",
  "I am capable of success.",
  "I am strong and confident.",
  "I choose to keep going.",
  "I am worthy of my dreams.",
  "I am focused and driven.",
  "I trust in my journey.",
  "I am proud of my strength.",
  "I am confident in myself.",
  "I choose to believe in my potential.",
  "I am capable of achieving greatness.",
  "I am strong in adversity.",
  "I trust my decisions.",
  "I am open to opportunities.",
  "I am worthy of happiness.",
  "I choose courage over fear.",
  "I am confident in my growth.",
  "I am grateful for my strength.",
  "I am focused on success.",
  "I trust myself always.",
  "I am capable and worthy.",
  "I choose positivity every day.",
  "I am resilient and powerful.",
  "I am open to success.",
  "I trust my journey fully.",
  "I am confident and capable.",
  "I choose to grow.",
  "I am worthy of love.",
  "I am strong and determined.",
  "I trust my inner voice.",
  "I am capable of overcoming anything.",
  "I choose success.",
  "I am confident in my abilities.",
  "I am grateful for today.",
  "I am strong and resilient.",
  "I trust myself deeply.",
  "I am open to new opportunities.",
  "I am capable of greatness.",
  "I choose happiness.",
  "I am confident and focused.",
  "I am worthy of success and joy.",
  "I trust the process of life.",
  "I am growing stronger each day.",
  "I am capable of achieving my dreams.",
  "I choose to stay strong.",
  "I am confident in my journey.",
  "I am worthy of abundance.",
  "I trust my abilities fully.",
  "I am resilient and confident.",
  "I am open to growth and success.",
  "I choose to believe in myself.",
  "I am capable of positive change.",
  "I am strong and fearless.",
  "I trust my path ahead.",
  "I am worthy of achieving my goals.",
  "I am confident in who I am.",
  "I choose to move forward.",
  "I am capable of success and happiness.",
  "I trust my strength.",
  "I am resilient and determined.",
  "I am open to new beginnings.",
  "I choose courage and confidence.",
  "I am worthy of a great life.",
  "I am capable of making a difference.",
  "I trust myself to succeed.",
  "I am strong, confident, and capable.",
  "I choose to shine.",
  "I am worthy of everything I desire.",
  "I am capable of creating my future.",
  "I trust my journey completely.",
  "I am resilient and unstoppable.",
  "I am open to endless possibilities.",
];

const REPEAT_WINDOW_DAYS = 15;
const STEP = 37;
const OFFSET = 11;

function getDayNumber(dateString) {
  let year;
  let month;
  let day;

  if (dateString) {
    const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateString);
    if (!match) {
      return null;
    }

    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
    day = now.getDate();
  }

  const utcMidnight = Date.UTC(year, month - 1, day);
  const isValidDate =
    new Date(utcMidnight).getUTCFullYear() === year &&
    new Date(utcMidnight).getUTCMonth() === month - 1 &&
    new Date(utcMidnight).getUTCDate() === day;

  if (!isValidDate) {
    return null;
  }

  return Math.floor(utcMidnight / 86400000);
}

export function getAffirmationForDate(dateString) {
  const dayNumber = getDayNumber(dateString);

  if (dayNumber === null) {
    throw new Error('Invalid date format. Use YYYY-MM-DD.');
  }

  const count = AFFIRMATIONS.length;
  if (count === 0) {
    throw new Error('No affirmations available.');
  }

  const index = ((dayNumber * STEP + OFFSET) % count + count) % count;

  return {
    affirmation: AFFIRMATIONS[index],
    index,
    minimumRepeatGap: count >= REPEAT_WINDOW_DAYS ? REPEAT_WINDOW_DAYS : count,
    date: new Date(dayNumber * 86400000).toISOString().slice(0, 10),
    totalAffirmations: count,
  };
}

export { AFFIRMATIONS, REPEAT_WINDOW_DAYS };
