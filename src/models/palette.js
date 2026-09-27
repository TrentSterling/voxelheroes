// Character, enemy, pickup and effect colours (sRGB hex authoring colours; the renderer converts
// them to linear). From the look lab's working palette (design/art-bible/lab/src/palette.js); the
// names are ours. Each character uses at most seven slots (art bible section 10).
export const CP = {
  // people
  skin: 0xf2cf94, skinLo: 0xe2a878, eye: 0x1e1e2e, eyeHi: 0xffffff,
  // the hero's seven slots
  heroHair: 0x7a4526, heroBand: 0xe23b3b, heroTunic: 0x2f6fd6, heroLeather: 0x6b4222, heroGold: 0xf2c43c,
  shieldWood: 0xb0743c, shieldRim: 0xe9b832, shieldMark: 0xf4f4f4,
  bladeHi: 0xf4f8ff, blade: 0xc9d3e6, bladeLo: 0x98a3bc, hilt: 0x7a4a26, guard: 0xe9b832,
  // elder
  robe: 0x7a5aa8, robeLo: 0x5e4486, beard: 0xf4f4f4, staff: 0x8a5a30, staffGem: 0x3ad0ff,
  // enemies
  slime: 0x5ad06a, slimeLo: 0x36a048, slimeHi: 0xb4f2a0,
  slimeRed: 0xe0404a, slimeRedLo: 0xb02a36, slimeRedHi: 0xff8f98,
  slimeBlue: 0x3f7fe0, slimeBlueLo: 0x2a55a8, slimeBlueHi: 0x9cc4ff,
  toad: 0x8e4fd0, toadLo: 0x5d2e94, toadHi: 0xb07ae8, toadBelly: 0xe8d8b0, toadMouth: 0x3a1a4a,
  pebble: 0xb4a894, pebbleLo: 0x8a7e6c,
  beetle: 0x8a3fb8, beetleLo: 0x5e2a86, beetleHorn: 0xf2e0b0, beetleFace: 0x2e2436, beetleEye: 0xffe24a,
  bone: 0xe2d8bf, boneLo: 0xbdb193, rust: 0x8c5a3a, rustHi: 0xb07a4a, socket: 0x1a1a22, redEye: 0xff4a3a,
  bat: 0x4a3a6a, batLo: 0x2e2446, batWing: 0x6a4a8a,
  golem: 0x8f8a80, golemLo: 0x6c675f, golemMoss: 0x5a9a4a, golemEye: 0xff5a2a, golemCore: 0x7af0ff,
  steel: 0x8a93a8, steelLo: 0x5d6478, tabard: 0xc2402e, slit: 0x15161c,
  // pickups
  heart: 0xf2384a, heartHi: 0xff9aa6, heartLo: 0xc02838,
  coin: 0xf6c93c, coinLo: 0xc8961e, coinHi: 0xfff0a0,
  gemGreen: 0x2fd36b, gemGreenLo: 0x1f9a4c, gemBlue: 0x3a8ff0, gemBlueLo: 0x2562b8, gemHi: 0xe8fff2,
  keyGold: 0xe8b830, keyGoldLo: 0xb8891c, keyGoldHi: 0xfff0b0,
  // effects
  spark: 0xfff6c8, puff: 0xf2f2f2,
};
