import { expect, test } from '@playwright/test';

type Snapshot = {
  phase: 'blind-select' | 'play' | 'shop' | 'game-over' | 'win';
  ante: number;
  blindIndex: 0 | 1 | 2;
  handsLeft: number;
  discardsLeft: number;
  roundScore: number;
  target: number;
  hand: Array<{ id: string }>;
};

test('smoke flow: boot, play, discard, overlays, screenshots', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('btn-play')).toBeVisible();
  await expect(page.getByTestId('btn-discard')).toBeVisible();

  await page.screenshot({ path: 'test-results/smoke-boot.png', fullPage: true });

  const beforePlay = await page.evaluate(() => {
    const bridge = (window as any).__OPEN_POKER_TEST__;
    if (!bridge) throw new Error('missing __OPEN_POKER_TEST__ bridge');
    bridge.selectFirst(2);
    return bridge.snapshot();
  }) as Snapshot;

  await expect(page.getByTestId('btn-play')).toBeEnabled();
  await page.evaluate(() => {
    const bridge = (window as any).__OPEN_POKER_TEST__;
    if (!bridge) throw new Error('missing __OPEN_POKER_TEST__ bridge');
    bridge.play();
  });

  await page.waitForTimeout(1800);
  const afterPlay = await page.evaluate(() => {
    const bridge = (window as any).__OPEN_POKER_TEST__;
    if (!bridge) throw new Error('missing __OPEN_POKER_TEST__ bridge');
    return bridge.snapshot();
  }) as Snapshot;

  expect(
    afterPlay.handsLeft !== beforePlay.handsLeft ||
      afterPlay.blindIndex !== beforePlay.blindIndex ||
      afterPlay.ante !== beforePlay.ante,
  ).toBe(true);

  await page.evaluate(() => {
    const bridge = (window as any).__OPEN_POKER_TEST__;
    if (!bridge) throw new Error('missing __OPEN_POKER_TEST__ bridge');
    bridge.restart();
    bridge.selectFirst(2);
  });
  const beforeDiscard = await page.evaluate(() => {
    const bridge = (window as any).__OPEN_POKER_TEST__;
    if (!bridge) throw new Error('missing __OPEN_POKER_TEST__ bridge');
    return bridge.snapshot();
  }) as Snapshot;

  await page.evaluate(() => {
    const bridge = (window as any).__OPEN_POKER_TEST__;
    if (!bridge) throw new Error('missing __OPEN_POKER_TEST__ bridge');
    bridge.discard();
  });
  await page.waitForTimeout(800);

  const afterDiscard = await page.evaluate(() => {
    const bridge = (window as any).__OPEN_POKER_TEST__;
    if (!bridge) throw new Error('missing __OPEN_POKER_TEST__ bridge');
    return bridge.snapshot();
  }) as Snapshot;
  expect(afterDiscard.discardsLeft).toBe(beforeDiscard.discardsLeft - 1);

  const gameOver = await page.evaluate(() => {
    const bridge = (window as any).__OPEN_POKER_TEST__;
    if (!bridge) throw new Error('missing __OPEN_POKER_TEST__ bridge');
    const snapshot = bridge.snapshot();
    snapshot.phase = 'game-over';
    snapshot.target = 300;
    snapshot.roundScore = 0;
    bridge.loadSnapshot(snapshot);
    return snapshot;
  }) as Snapshot;
  expect(gameOver.phase).toBe('game-over');

  await expect(page.locator('#overlay:not(.hidden)')).toBeVisible();
  await expect(page.locator('#overlay-title')).toHaveText('Game Over');
  await page.screenshot({ path: 'test-results/smoke-game-over.png', fullPage: true });

  await page.evaluate(() => {
    const bridge = (window as any).__OPEN_POKER_TEST__;
    if (!bridge) throw new Error('missing __OPEN_POKER_TEST__ bridge');
    const snapshot = bridge.snapshot();
    snapshot.phase = 'win';
    bridge.loadSnapshot(snapshot);
  });

  await expect(page.locator('#overlay-title')).toHaveText('You Win!');
  await page.screenshot({ path: 'test-results/smoke-win.png', fullPage: true });
});
