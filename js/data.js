/* FEISAR fan site — data
   Ship names, leagues, stats and technical data from the Wipeout games
   (via Wipeout Central / Fandom). Prices are fictional. */
window.FEISAR = (() => {
  const IMG = 'assets/ships/';

  const SHIPS = [
    {
      id: 'speed', code: 'AGRC-S', name: 'FEISAR Speed', league: 'AGRC', year: 2048, game: 'Wipeout 2048', cls: 'Speed class',
      img: IMG + 'speed.webp', action: IMG + 'agrc-action.webp',
      desc: 'Sublime handling for anyone starting out in anti-gravity racing. A consummate all-rounder that catches the competition through the corners.',
      stats: [['Speed', 8, 10], ['Handling', 7, 10], ['Shield', 4, 10], ['Firepower', 6, 10]],
      tech: [['Class', 'Speed'], ['Championship', 'Anti-Gravity Racing Championship'], ['Status', 'Entry-level federal issue']],
      pilots: ['Ami Nakajima'], price: 2950000,
    },
    {
      id: 'agility', code: 'AGRC-A', name: 'FEISAR Agility', league: 'AGRC', year: 2048, game: 'Wipeout 2048', cls: 'Agility class',
      img: IMG + 'agility.webp',
      desc: 'Trades a little top-end speed for extra manoeuvrability. Hyper-dynamic airbrakes make it ideal for the most technical circuits.',
      stats: [['Speed', 5, 10], ['Handling', 9, 10], ['Shield', 6, 10], ['Firepower', 7, 10]],
      tech: [['Class', 'Agility'], ['Airbrakes', 'Hyper-dynamic'], ['Best for', 'Technical circuits · Zone']],
      pilots: ['Ami Nakajima'], price: 3050000,
    },
    {
      id: 'fighter', code: 'AGRC-F', name: 'FEISAR Fighter', league: 'AGRC', year: 2048, game: 'Wipeout 2048', cls: 'Fighter class',
      img: IMG + 'fighter.webp',
      desc: 'The all-rounder FEISAR spirit with an added punch. A heavy-weapons variant — the hero craft of the AGRC era.',
      stats: [['Speed', 5, 10], ['Handling', 6, 10], ['Shield', 8, 10], ['Firepower', 8, 10]],
      tech: [['Class', 'Fighter'], ['Role', 'Heavy weapons / Combat'], ['Status', 'Hero craft, AGRC']],
      pilots: ['Ami Nakajima'], price: 3300000,
    },
    {
      id: 'prototype', code: 'AGRC-P', name: 'FEISAR Prototype', league: 'AGRC', year: 2048, game: 'Wipeout 2048', cls: 'Prototype class',
      img: IMG + 'prototype.webp',
      desc: 'An experimental fuel system that charges from speed pads. Every pad raises its top speed — beyond the stated speed class of any race.',
      stats: [['Speed', 11, 10], ['Handling', 7, 10], ['Shield', 4, 10], ['Firepower', 6, 10]],
      tech: [['Class', 'Prototype · Speed'], ['Trait', 'Speed-pad charged top speed'], ['Reset', 'New lap · heavy impact']],
      pilots: ['Classified'], price: null,
    },
    {
      id: 'ls5600', code: 'LS-5600', name: 'LS-5600 Mk.IV', league: 'F3600', year: 2052, game: 'Wipeout', cls: 'F3600 League',
      img: IMG + 'ls5600.webp', small: true,
      desc: 'Twin side-mounted mid-size engines with enhanced quad fins. The slowest craft of its season — and the most powerful engine on the grid.',
      stats: [['Speed', 3, 10], ['Thrust', 8, 10], ['Handling', 10, 10], ['Shield', 3, 10]],
      tech: [['Engine', 'Syrus 2800 Mk.II'], ['Configuration', '2 × 1,400 bhp · super reheat'], ['Stabilisers', 'Pro-Am SR320'], ['Braking', 'Airflow 220 SRBS'], ['Weapons', 'FEISAR 4 Armacall Computer']],
      pilots: ['Sofia de la Rente', 'Paul Jackson'], price: 1850000,
    },
    {
      id: 'f5000', code: 'F5000', name: 'FEISAR F5000', league: 'F5000', year: 2097, game: 'Wipeout 2097 · Wipeout 64', cls: 'F5000 League',
      img: IMG + 'f5000.webp', small: true,
      desc: 'Excellent turning ability and easy to control. Most circuits can be flown without touching the airbrakes.',
      stats: [['Speed', 3, 10], ['Thrust', 6, 10], ['Handling', 7, 10], ['Shield', 6, 10]],
      tech: [['Aerodynamics', '7 / 10'], ['Hull', 'Single-hull design'], ['Rating', 'Beginner']],
      pilots: ['FEISAR F5000 squad'], price: 2400000,
    },
    {
      id: 'f7200', code: 'F7200', name: 'FEISAR F7200', league: 'F7200', year: 2116, game: 'Wipeout 3', cls: 'F7200 League',
      img: IMG + 'f7200.webp', small: true,
      desc: 'The strongest thrust of all and shields equal to the toughest on the grid. Off the mark so quickly a wall barely slows it.',
      stats: [['Speed', 1, 5], ['Thrust', 5, 5], ['Handling', 4, 5], ['Shield', 4, 5]],
      tech: [['Thrust', 'Class leading'], ['Shield', 'Joint strongest, F7200'], ['Rating', 'Beginner']],
      pilots: ['Carlos Beneto'], price: 3100000,
    },
    {
      id: 'ls59', code: 'LS-59', name: 'LS-59', league: 'F9000', year: 2160, game: 'Wipeout Fusion', cls: 'F9000 League',
      img: IMG + 'ls59.webp', small: true, champion: true,
      desc: 'Excellent lateral stability engineering. The craft that carried Daniel Johnson and FEISAR to the 2164 AG Racing League title.',
      stats: [['Speed', 5, 6], ['Thrust', 3, 6], ['Handling', 5, 6], ['Shield', 5, 6]],
      tech: [['Engine', '1800 RamJet Special™'], ['Stabilisers', 'Levitron Technology Corp. V100'], ['Braking', 'Air-Flow Research 44'], ['Weapons', 'Armacall VII'], ['Shield', 'Garrett VR-7'], ['Top speed', '1,062 → 1,572 km/h'], ['Mass', '1,187 kg']],
      dims: '12.0 × 5.9 × 2.4 m', pilots: ['Daniel Johnson', 'Carlos Beneto'], price: 5900000,
    },
    {
      id: 'fx300', code: 'FX300', name: 'FEISAR FX300', league: 'FX300', year: 2197, game: 'Wipeout Pure', cls: 'FX300 League',
      img: IMG + 'fx300.webp', small: true,
      desc: 'You know where you are with a FEISAR. A benchmark combination of agility and reliability, tested in late 2196.',
      stats: [['Speed', 2, 5], ['Thrust', 4, 5], ['Handling', 5, 5], ['Shield', 3, 5]],
      tech: [['Development', '2194 — 2196'], ['Chassis', 'Agile · high thrust'], ['Best for', 'Technical circuits']],
      pilots: ['FEISAR FX300 squad'], price: 4200000,
    },
    {
      id: 'fx350', code: 'FX350/400', name: 'FEISAR FX350', league: 'FX350 · FX400', year: 2207, game: 'Wipeout Pulse · Wipeout HD', cls: 'FX350 / FX400',
      img: IMG + 'fx350.webp', action: IMG + 'fx400.webp',
      desc: 'Built in Bologna from components supplied by every member state. The best-handling race chassis of the FX350 and FX400 series.',
      stats: [['Speed', 7, 10], ['Thrust', 8, 10], ['Handling', 10, 10], ['Shield', 8, 10]],
      tech: [['Development', 'Bologna, Italy'], ['Origin of parts', 'All member states'], ['Delegate', 'Pippo Ancelotti']],
      pilots: ['Riley Webb'], price: 6800000,
    },
    {
      id: 'fury', code: 'FX350 FURY', name: 'FX350 Fury', league: 'FX350 Fury', year: 2207, game: 'Wipeout HD Fury', cls: 'Fury upgrade',
      img: IMG + 'fury.webp', wide: true,
      desc: 'A much-needed speed boost and a thrust upgrade, with the same lightning reflexes. A considerable threat on any circuit.',
      stats: [['Speed', 8, 10], ['Thrust', 8.5, 10], ['Handling', 10, 10], ['Shield', 8, 10]],
      tech: [['Upgrade', 'Fury package'], ['Speed', '+1 over FX350'], ['Thrust', '+0.5 over FX350']],
      pilots: ['Riley Webb'], price: 7900000,
    },
  ];

  const HQS = [
    { code: 'BO', city: 'Bologna', lon: 11.34, lat: 44.49, role: 'Operational HQ 2207 · FX350/400 development centre', op: true },
    { code: 'BX', city: 'Brussels', lon: 4.35, lat: 50.85, role: 'Federal council liaison · "The Muscles Behind Brussels"' },
    { code: 'BC', city: 'Barcelona', lon: 2.17, lat: 41.39, role: 'Ceramic-carbon hull materials' },
    { code: 'LS', city: 'Lisbon', lon: -9.14, lat: 38.72, role: 'Pilot academy & simulation' },
    { code: 'TL', city: 'Toulouse', lon: 1.44, lat: 43.6, role: 'Thrust chamber assembly' },
    { code: 'PA', city: 'Paris', lon: 2.35, lat: 48.86, role: 'Federal finance & bonds' },
    { code: 'AM', city: 'Amsterdam', lon: 4.9, lat: 52.37, role: 'AG field physics' },
    { code: 'FR', city: 'Frankfurt', lon: 8.68, lat: 50.11, role: 'Telemetry & race operations' },
    { code: 'WI', city: 'Vienna', lon: 16.37, lat: 48.21, role: 'Stabiliser engineering' },
    { code: 'ST', city: 'Stockholm', lon: 18.07, lat: 59.33, role: 'Cold-field endurance testing' },
    { code: 'WA', city: 'Warsaw', lon: 21.01, lat: 52.23, role: 'Weapons control systems' },
    { code: 'AT', city: 'Athens', lon: 23.73, lat: 37.98, role: 'Shield research' },
  ];

  const PILOTS = [
    { name: 'Ami Nakajima', league: 'AGRC', years: '2048 — 2050', note: 'AGRC lead pilot' },
    { name: 'Sofia de la Rente', league: 'F3600', years: '2052', note: 'LS-5600 Mk.IV' },
    { name: 'Paul Jackson', league: 'F3600', years: '2052', note: 'LS-5600 Mk.IV' },
    { name: 'Carlos Beneto', league: 'F7200 · F9000', years: '2116 — 2164', note: '"I am the real lead pilot"' },
    { name: 'Daniel Johnson', league: 'F9000', years: '2160 — 2164', note: '2164 Pilots\' Champion', gold: true },
    { name: 'Riley Webb', league: 'FX400', years: '2207', note: 'FX400 campaign' },
  ];

  return { SHIPS, HQS, PILOTS };
})();
