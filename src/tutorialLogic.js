// The tutorial's step machine, free of any game imports so it can be unit-tested (tutorial.js feeds it
// the live numbers each frame). Steps: 0 click/hold to gain a little soda, 1 walk to the x1 treadmill and
// train to the goal, 2 jump on the Soda Jump pad to earn Wins, 3 buy the first soda upgrade (hold E),
// `done` = finished.
//
// c = { soda, clickGoal, trainGoal, wins, price, owned, done }
// Returns the step to be on now (it may go back, e.g. when the Wins were spent before buying).
export function nextStep(step, c) {
  if (step >= c.done) return step
  if (c.owned) return c.done
  switch (step) {
    case 0:
      if (c.soda >= c.trainGoal) return c.wins >= c.price ? 3 : 2
      return c.soda >= c.clickGoal ? 1 : 0
    case 1:
      if (c.soda < c.trainGoal) return 1
      return c.wins >= c.price ? 3 : 2
    case 2:
      return c.wins >= c.price ? 3 : 2
    case 3:
      return c.wins >= c.price ? 3 : 2
    default:
      return step
  }
}
