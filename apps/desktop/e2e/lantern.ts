/**
 * lantern.ts — The Sunken Lantern (the first run's sample campaign) made ready
 * for Play the way a GM does it, for the files that test Play (play.e2e.ts,
 * play-board.e2e.ts): music added to the Library from files, the encounter's
 * map (blank, the fight placed, fog revealed, its music), Play's window from
 * Play's Home, a scene made from the encounter, and Start. Every step goes
 * through the UI; play.e2e.ts checks what each one leaves, and play-board.e2e.ts
 * starts from them.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from 'playwright-core';
import { go, launch, live, newWindow, role, section, type Launched } from './app';

/** The Library's free tracks (CC0), copied for the Open dialog to answer with, under names of the test's own. */
const bundled = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/renderer/public/library/music');

/** The app launched for the GM: Tabletop in GM view, and the Open dialog answering with two music files. */
export async function launchGm(): Promise<Launched> {
  const media = path.join(os.tmpdir(), `ballad-e2e-music-${process.pid}`);
  mkdirSync(media, { recursive: true });
  copyFileSync(path.join(bundled, 'the-old-tower-inn.mp3'), path.join(media, 'Tavern Theme.mp3'));
  copyFileSync(path.join(bundled, 'medieval-battle.mp3'), path.join(media, 'Battle Drums.mp3'));
  const t = await launch();
  await t.app.evaluate(({ dialog }, dir) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [`${dir}/Tavern Theme.mp3`, `${dir}/Battle Drums.mp3`] });
  }, media);
  await section(t.win, 'Tabletop');
  await role(t.win, 'gm');
  return t;
}

/** The campaign's records, and the GM's steps to get it to the table. `t` is a getter: a file may relaunch. */
export function lantern(t: () => Launched) {
  const campaign = () => live<any>(t().vault().worlds).find((w) => w.name === 'The Sunken Lantern');
  const encounter = () => live<any>(t().vault().encounters).find((e) => e.worldId === campaign().id);
  const scene = () => live<any>(t().vault().playScenes ?? {})[0];
  const tokensOn = (id: string) => live<any>(t().vault().tokens ?? {}).filter((x) => x.sceneId === id);
  /** Waits (up to 5 s) for something another window writes; the assert after it says what didn't happen. */
  const waitFor = async (check: () => boolean) => {
    for (let i = 0; i < 50 && !check(); i++) await t().win.waitForTimeout(100);
  };

  return {
    campaign,
    encounter,
    scene,
    tokensOn,
    waitFor,

    /** Library → Music → Add Music: the two files. */
    async addMusic() {
      const { win } = t();
      await go(win, '/library/music');
      await win.getByRole('button', { name: 'Add Music' }).first().click();
      await win.getByRole('button', { name: /Battle Drums/ }).waitFor();
      await t().saved();
    },

    /** The encounter's Map tab: a blank map, the rest of the fight placed, fog on and a part revealed; its Music tab: Battle Drums. */
    async mapEncounter() {
      const { win } = t();
      await go(win, `/encounters/${encounter().id}`);
      await win.getByRole('tab', { name: /^Map/ }).click();
      await win.getByRole('tab', { name: 'Blank' }).click();
      await win.getByRole('spinbutton', { name: 'Squares Across' }).fill('16');
      await win.getByRole('spinbutton', { name: 'Squares Down' }).fill('10');
      await win.getByRole('button', { name: 'Use This Map' }).click();
      await win.getByRole('application').waitFor();
      await win.getByRole('button', { name: 'Add Tokens' }).click();
      await win.getByRole('button', { name: 'Place The Rest Of The Fight' }).click();
      await win.getByRole('button', { name: 'Close Add Tokens' }).click();
      await win.keyboard.press('Escape');
      await win.getByRole('complementary', { name: 'Map settings' }).getByRole('switch', { name: 'Fog of war' }).click();
      await win.keyboard.press('f');
      const box = (await win.getByRole('application').boundingBox())!;
      await win.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
      await win.mouse.down();
      await win.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 6 });
      await win.mouse.up();
      await win.getByRole('tab', { name: /^Music/ }).click();
      await win.getByRole('button', { name: 'Add Music' }).click();
      await win.getByRole('button', { name: /Battle Drums/ }).click();
      await t().saved();
    },

    /** Play's Home in the main window (nothing opens by itself). */
    async playHome() {
      await section(t().win, 'Play');
      await t().win.getByText('You Run · 1').waitFor();
    },

    /** The campaign's Open Play, from Play's Home: its window. */
    async openPlay(): Promise<Page> {
      await t().win.getByRole('button', { name: /^Open Play: The Sunken Lantern/ }).click();
      const play = await newWindow(t());
      await play.getByRole('complementary', { name: 'Scenes' }).waitFor();
      return play;
    },

    /** New Scene, from the encounter. */
    async newScene(play: Page) {
      await play.getByRole('button', { name: 'New Scene' }).first().click();
      const dialog = play.getByRole('dialog', { name: 'New Scene' });
      await dialog.locator('ul button').first().click();
      await dialog.getByRole('button', { name: 'Create Scene' }).click();
      await play.getByRole('application').waitFor();
      await waitFor(() => Boolean(scene()));
      await t().saved();
    },

    /** Start The Scene: live for the table, its music on. */
    async start(play: Page) {
      await play.getByRole('button', { name: /^Start (The|This) Scene/ }).click();
      await play.getByLabel('Now playing').filter({ hasText: 'Battle Drums' }).waitFor();
      await waitFor(() => campaign().tabletop?.live?.sceneId === scene()?.id);
      await t().saved();
    },
  };
}
