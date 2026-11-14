/* Match-me badges and the deterministic "something different" walk.
 *
 * Pure functions, no DOM, so the page and the tests share one definition.
 * Both rules are deliberately boring: a badge exists exactly when the
 * corresponding line in score() adds points, and the walk moves one step
 * along the catalog's own area and goal order. Same answers in, same
 * result out, every time.
 */

export const GOAL_ORDER = ["ease", "earn", "help", "learn"];

export const GOAL_BADGE = {
  ease: "daily life",
  earn: "money",
  help: "helping",
  learn: "learning"
};

export const AREA_BADGE = {
  food: "food",
  money: "money",
  home: "home",
  family: "family",
  health: "health",
  learning: "learning",
  community: "community",
  work: "work"
};

export const TIME_BADGE = {
  weekend: "weekend",
  evenings: "evenings",
  month: "a month"
};

export const LANE_BADGE = {
  ready: "no code",
  assistant: "with an AI assistant",
  code: "write the code"
};

/* One badge per scoring branch that actually scored. A time that is one bucket
   away scores a single point, so it gets a "~" badge rather than a tick. */
export function badgesFor(answers, idea) {
  const out = [];

  if (answers.area && idea.area === answers.area) {
    out.push({ text: AREA_BADGE[idea.area] || idea.area, mark: "\u2713", kind: "hit" });
  }
  if (answers.goal && (idea.goals || []).includes(answers.goal)) {
    out.push({ text: GOAL_BADGE[answers.goal] || answers.goal, mark: "\u2713", kind: "hit" });
  }
  if (answers.time) {
    if (answers.time === idea.minutes) {
      out.push({ text: TIME_BADGE[idea.minutes] || idea.minutes, mark: "\u2713", kind: "hit" });
    } else if (adjacentTime(answers.time, idea.minutes)) {
      out.push({ text: TIME_BADGE[idea.minutes] || idea.minutes, mark: "~", kind: "near" });
    }
  }
  if (answers.lane && (idea.lanes || []).includes(answers.lane)) {
    out.push({ text: LANE_BADGE[answers.lane] || answers.lane, mark: "\u2713", kind: "hit" });
  }

  if (!out.length) {
    out.push({ text: "closest fit", mark: "", kind: "fallback" });
  }
  return out;
}

/* The time buckets in order; the catalog ships "weekend", "evenings", "month". */
const TIME_ORDER = ["weekend", "evenings", "month"];

export function adjacentTime(a, b) {
  const i = TIME_ORDER.indexOf(a);
  const j = TIME_ORDER.indexOf(b);
  return i >= 0 && j >= 0 && Math.abs(i - j) === 1;
}

/* Step the goal and the area to the next one in catalog order, keeping the
   time and the build lane. `areaIds` is data.areas.map(a => a.id), so the walk
   follows whatever order the catalog declares.
 *
 * Because the area index advances by one each call, a walk from any starting
 * answer set visits every area before repeating one. */
export function nextAnswers(answers, areaIds) {
  const goals = GOAL_ORDER;
  const gi = goals.indexOf(answers.goal);
  const goal = goals[(gi + 1) % goals.length];

  const ai = areaIds.indexOf(answers.area);
  const area = areaIds[(ai + 1) % areaIds.length];

  return {
    answers: { goal, area, time: answers.time, lane: answers.lane },
    changed: [
      { key: "from-goal", from: answers.goal, to: goal },
      { key: "from-area", from: answers.area, to: area }
    ]
  };
}
