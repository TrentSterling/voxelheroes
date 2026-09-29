// The canvas UI (ui/canvas/gfx.js): the title panel, HUD widgets, dialog, banner, toast, speech
// bubbles, pause, settings and map are all drawn by the game, answer taps through hit regions, and
// none of it is DOM.
export const description = 'Canvas UI end to end: title panel and Start, HUD layout, dialog typing and taps, banner, toast, speech bubbles, pause, settings (cycle + slider), map, phone widths.';

export default async function (t) {
  const H = 'window.__voxelHeroes';
  // repaint first: hit regions exist only for what the last frame drew
  const view = () =>
    t.eval(() => {
      const h = window.__voxelHeroes;
      h.render();
      return {
        hud: h.game.hud.hudView(),
        ui: h.game.ui.uiView(),
        dlg: h.game.dialog.dialogView(),
        ov: h.game.overlay.overlayView(),
        mode: h.state.mode,
      };
    });
  const press = (id) =>
    t.eval((who) => {
      const h = window.__voxelHeroes;
      h.render();
      return h.game.ui.pressUi(who);
    }, id);
  const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const layoutOk = (v) => {
    const ws = v.hud.widgets;
    const inside = ws.every((w) => w.x >= 0 && w.y >= 0 && w.x + w.w <= v.ui.w && w.y + w.h <= v.ui.h);
    let clash = null;
    for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) if (overlaps(ws[i], ws[j])) clash = `${ws[i].id}/${ws[j].id}`;
    return { inside, clash };
  };

  // ------------------------------------------------------------ the title panel
  let v = await view();
  t.expect(v.mode === 'title' && v.ov.visible && v.ov.button === 'Start adventure', `the title panel offers Start (${v.ov.button})`);
  t.expect(v.ui.hits.some((h) => h.id === 'overlay-start'), 'the Start button is a hit region');
  t.expect(v.hud.widgets.length === 0, 'no HUD over the title');
  t.expect(await t.eval(() => !document.getElementById('overlay')), 'the panel is not DOM');
  await t.shot('00-title');
  t.expect(await press('overlay-start'), 'pressing Start');
  await t.step(0.5);
  v = await view();
  t.expect(v.mode === 'play' && !v.ov.visible, 'Start begins the game and the panel goes');

  // ------------------------------------------------------------ the HUD
  const ids = v.hud.widgets.map((w) => w.id);
  t.expect(v.hud.visible && ['hearts', 'coins', 'area', 'objective', 'clock', 'settings', 'sound'].every((id) => ids.includes(id)), `the HUD shows its widgets (${ids.join(',')})`);
  t.expect(await t.eval(() => !document.getElementById('hud') && !document.getElementById('dialog') && !document.getElementById('clock')), 'no DOM HUD, dialog or clock');
  let ok = layoutOk(v);
  t.expect(ok.inside && !ok.clash, `every widget sits inside the view and clear of the others (${ok.clash ?? 'ok'})`);
  await t.shot('01-hud');

  await t.eval(() => {
    const h = window.__voxelHeroes;
    h.give('key');
    h.give('boomerang');
    h.state.coins = 137;
  });
  await t.step(0.6);
  v = await view();
  const ids2 = v.hud.widgets.map((w) => w.id);
  t.expect(ids2.includes('keys') && ids2.includes('item-slot'), `a key and an item add the keys counter and the item slot (${ids2.join(',')})`);
  ok = layoutOk(v);
  t.expect(ok.inside && !ok.clash, `still no overlap with them (${ok.clash ?? 'ok'})`);
  await t.shot('02-hud-items');

  // ------------------------------------------------------------ the dialog
  await t.eval(() => {
    window.__choice = 'pending';
    window.__voxelHeroes.game.dialog
      .ask('Buy a bomb bag for 30 coins? It holds thirty bombs and never goes out of style.', ['Buy', 'Not now'], { speaker: 'Old Wren' })
      .then((c) => (window.__choice = c));
  });
  await t.step(0.3);
  v = await view();
  t.expect(v.dlg && v.dlg.shown.length > 0 && v.dlg.shown.length < v.dlg.text.length, `the text types out (${v.dlg?.shown.length}/${v.dlg?.text.length})`);
  await t.shot('03-dialog-typing');
  await t.step(4);
  v = await view();
  t.expect(v.dlg?.choices?.length === 2, 'the choices appear once the page is typed');
  t.expect(v.ui.hits.some((h) => h.id === 'dialog-choice-1'), 'each choice is a hit region');
  await t.shot('04-dialog-choices');
  const pressed = await press('dialog-choice-1');
  await t.step(0.3);
  t.expect(pressed && (await t.eval(() => window.__choice)) === 1, 'a tap on a choice picks it and closes the box');
  v = await view();
  t.expect(v.dlg === null, 'the box is gone');

  await t.eval(() => {
    window.__done = false;
    window.__voxelHeroes.game.dialog.showDialog(['First page.', 'Second page.']).then(() => (window.__done = true));
  });
  await t.step(1);
  await press('dialog');
  await t.step(0.3);
  v = await view();
  t.expect(v.dlg?.page === 1, 'a tap on the box turns the page');
  await press('dialog');
  await t.step(0.2);
  await press('dialog');
  await t.step(0.3);
  t.expect(await t.eval(() => window.__done), 'and another closes it');

  // ------------------------------------------------------------ banner, toast, speech
  const fx = await t.eval(() => {
    const h = window.__voxelHeroes;
    h.game.banner.showBanner('The Test Banner');
    h.game.toast.toast('A small toast');
    const npc = h.entities.find((e) => e.bubble);
    npc?.bubble.emote('!', 9999);
    npc?.bubble.say('Good morning!');
    return { banner: h.game.banner.bannerView(), toast: h.game.toast.toastView(), npc: !!npc };
  });
  t.expect(fx.banner.visible && fx.banner.text === 'The Test Banner', 'a banner shows');
  t.expect(fx.toast.visible && fx.toast.text === 'A small toast', 'a toast shows');
  await t.step(0.5);
  v = await view();
  const shown = await t.eval(() => window.__voxelHeroes.game.npcFx.bubblesShown());
  t.expect(fx.npc && shown >= 1, `a speech bubble is drawn over a townsperson (${shown})`);
  await t.shot('06-banner-toast-speech');

  // ------------------------------------------------------------ pause
  await t.press('Escape');
  await t.step(0.2);
  v = await view();
  t.expect(v.mode === 'paused' && v.ov.title === 'Paused' && v.ui.hits.some((h) => h.id === 'overlay-start'), 'Escape pauses with a Resume button');
  t.expect(v.hud.alpha < 0.6, `the HUD dims behind the pause panel (${v.hud.alpha.toFixed(2)})`);
  await t.shot('07-pause');
  await press('overlay-start');
  await t.step(0.2);
  v = await view();
  t.expect(v.mode === 'play', 'Resume returns to play');

  // ------------------------------------------------------------ settings
  await t.press('o');
  await t.step(0.2);
  let st = await t.eval(() => window.__voxelHeroes.game.settingsPanel.settingsView());
  t.expect(st.open && (await view()).mode === 'settings', 'O opens Settings as a mode');
  const before = st.rows.find((r) => r.key === 'blur').text;
  await press('setting-blur-next');
  st = await t.eval(() => window.__voxelHeroes.game.settingsPanel.settingsView());
  t.expect(st.rows.find((r) => r.key === 'blur').text !== before, `a click on > cycles a row (${before} -> ${st.rows.find((r) => r.key === 'blur').text})`);
  await t.eval(() => {
    const h = window.__voxelHeroes;
    h.render();
    h.game.ui.dragUi('setting-volume', 0.5);
  });
  st = await t.eval(() => window.__voxelHeroes.game.settingsPanel.settingsView());
  const vol = st.rows.find((r) => r.key === 'volume').value;
  t.expect(Math.abs(vol - 0.5) <= 0.06, `dragging the Volume slider to the middle sets it (${vol})`);
  await t.shot('08-settings');
  await t.press('Escape');
  await t.step(0.2);
  t.expect((await view()).mode === 'play', 'Escape closes Settings back to play');

  // ------------------------------------------------------------ map
  await t.tap('map');
  let mp = await t.eval(() => window.__voxelHeroes.game.mapScreen.mapView());
  t.expect(mp.open && mp.cells > 0 && mp.hero, `the map opens with charted screens and the hero (${mp.cells})`);
  await t.shot('09-map');
  await press('map-close');
  await t.step(0.2);
  mp = await t.eval(() => window.__voxelHeroes.game.mapScreen.mapView());
  t.expect(!mp.open && (await view()).mode === 'play', 'Close shuts the map');

  // ------------------------------------------------------------ other window shapes
  for (const [name, w, h] of [['phone', 390, 844], ['phone-wide', 844, 390], ['hd', 1920, 1080]]) {
    await t.page.setViewportSize({ width: w, height: h });
    await t.step(0.2);
    v = await view();
    ok = layoutOk(v);
    t.expect(ok.inside && !ok.clash, `${name} ${w}x${h}: widgets inside and clear (${ok.clash ?? 'ok'}; logical ${v.ui.w}x${v.ui.h}, scale ${v.ui.scale})`);
    await t.shot(`10-${name}`);
  }
  await t.page.setViewportSize({ width: 1280, height: 720 });
  void H;
}
