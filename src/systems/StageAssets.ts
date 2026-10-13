import Phaser from 'phaser';
import { getBoss } from '../config/bosses';
import { getEnemy } from '../config/enemies';
import { createSpriteAnims, loadSpriteSheets, unloadSpriteSheets } from '../rig/SpriteView';
import type { StageConfig } from '../types/game';

/** Sprite-sheet keys (userAssets.json) a stage can show: wave enemies, summons and its bosses. */
export function spriteKeysForStage(stage: StageConfig): Set<string> {
  const types = new Set<string>(['minion']); // summoners always call minions
  stage.waves.forEach((w) => w.enemies.forEach((e) => types.add(e.type)));
  const bosses = [stage.bossId, stage.secondBossId].filter((id): id is string => !!id).map(getBoss);
  bosses.forEach((b) => b.phases.forEach((p) => p.moves.forEach((m) => m.summon && types.add(m.summon))));
  const keys = new Set<string>();
  types.forEach((t) => {
    const s = getEnemy(t).sprite;
    if (s) keys.add(s.key);
  });
  bosses.forEach((b) => {
    if (b.sprite) keys.add(b.sprite.key);
    if (b.transformSprite) keys.add(b.transformSprite.key);
  });
  return keys;
}

/**
 * Keep only this stage's enemy/boss sheets in memory and queue the missing ones.
 * Call from preload() (the loader then runs automatically) or pass `start` to load in the background.
 */
export function prepareStageSprites(scene: Phaser.Scene, stage: StageConfig, start = false): void {
  const keys = spriteKeysForStage(stage);
  unloadSpriteSheets(scene, keys);
  const queued = loadSpriteSheets(scene, keys);
  if (start && queued > 0) {
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => createSpriteAnims(scene));
    scene.load.start();
  }
}
