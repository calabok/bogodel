/* ---------- v8: Пути (билды) героя. Герой сам выбирает, кем стать, как в старом добром БК ----------
   st — веса характеристик (prim — основная характеристика класса), cats — любимое оружие, kind — тип брони,
   sh — любит щит, h2 — любит двуручное, props — ценные свойства, feats — любимые черты, z — любимая зона удара,
   bz — что прикрывает, cls — классы, которым путь «к лицу», fx — небольшой боевой бонус пути */
const BUILDS = {
  tank:    { t: 'Танком', n: 'Танк', ic: '🛡', d: 'Стоит стеной: щит, тяжёлая броня, много здоровья. Бьёт не больно, зато долго.', st: { con: 3, str: 1.5, wis: 1 }, cats: ['sword', 'mace'], kind: 'h', sh: 1, props: ['hp', 'acrit', 'blockp', 'thorns', 'regen', 'con'], feats: ['ironskin', 'tough', 'sentinel', 'gourmet'], z: 'chest', bz: 'head', cls: ['warrior', 'cleric', 'barbarian'], race: ['dwarf', 'orc'], al: 0, fx: { blk: .06, red: .08 } },
  crit:    { t: 'Критовиком', n: 'Критовик', ic: '🎯', d: 'Бьёт редко, но метко — и очень больно. Живёт ради жёлтых цифр.', st: { prim: 3, wis: 1.5, int: 1 }, cats: ['axe', 'dagger', 'bow'], props: ['crit', 'acc', 'pierce', 'stun'], feats: ['wmaster', 'lucky', 'brawler'], z: 'head', bz: 'chest', cls: ['warrior', 'ranger', 'rogue', 'mage', 'barbarian'], race: ['elf', 'human'], al: 0, fx: { crit: .07 } },
  dodge:   { t: 'Уворотчиком', n: 'Уворотчик', ic: '💨', d: 'Его не поймать: лёгкая броня, высокая Ловкость и вечное «мимо!».', st: { dex: 3, con: 1.2, wis: .8 }, cats: ['dagger', 'sword', 'bow'], kind: 'l', props: ['dodge', 'acrit', 'poison', 'dex'], feats: ['swift', 'sentinel', 'lucky'], z: 'legs', bz: 'chest', cls: ['rogue', 'ranger', 'bard'], race: ['halfling', 'elf'], al: 0, fx: { dodge: .06 } },
  berserk: { t: 'Берсерком', n: 'Берсерк', ic: '🪓', d: 'Силач с двуручником: щит — для трусов, броня — для слабаков.', st: { str: 3, con: 2 }, cats: ['two', 'axe'], h2: 1, props: ['fire', 'vamp', 'crit', 'stun', 'str'], feats: ['brawler', 'wmaster', 'tough'], z: 'head', bz: 'belly', cls: ['barbarian', 'warrior'], race: ['orc', 'dwarf'], al: -1, fx: { dmg: .1, red: -.05 } },
  mage:    { t: 'Чародеем', n: 'Чародей', ic: '🔮', d: 'Посох, мантия и умное лицо. Лёд, огонь и вера — его конёк.', st: { int: 3, wis: 2 }, cats: ['staff'], kind: 'c', h2: 1, props: ['ice', 'fire', 'faith', 'int', 'wis'], feats: ['devout', 'sentinel', 'lucky'], z: 'chest', bz: 'head', cls: ['mage', 'cleric', 'bard'], race: ['gnome', 'tiefling', 'elf'], al: 0, fx: { spell: .1 } },
  healer:  { t: 'Целителем', n: 'Целитель', ic: '✚', d: 'Лечит себя и других прямо в бою. Не умирает из принципа.', st: { wis: 3, con: 1.5, cha: 1 }, cats: ['mace', 'staff'], sh: 1, props: ['regen', 'vamp', 'holy', 'faith', 'wis'], feats: ['devout', 'preacher', 'gourmet'], z: 'belly', bz: 'chest', cls: ['cleric', 'bard'], race: ['dwarf', 'human'], al: 1, fx: { heal: .015 } },
  trick:   { t: 'Хитрецом-торгашом', n: 'Хитрец-торгаш', ic: '🎭', d: 'Ядовитый кинжал, язык без костей и кошелёк без дна.', st: { cha: 3, dex: 1.5, int: 1 }, cats: ['dagger', 'music'], kind: 'l', props: ['gold', 'luck', 'poison', 'preach', 'cha'], feats: ['trader', 'silver', 'treasure', 'lucky'], z: 'waist', bz: 'head', cls: ['bard', 'rogue'], race: ['halfling', 'tiefling', 'gnome'], al: 0, fx: { first: .3, gold: .15 } }
};
/* Подстройка путей под равный винрейт (симуляции bal8): d — урон, r — входящий урон в бою по зонам */
const BUILD_BAL = { tank: { d: .93, r: 1 }, crit: { d: .96, r: 1 }, dodge: { d: .94, r: 1 }, berserk: { d: 1.05, r: 1 }, mage: { d: 1.1, r: 1 }, healer: { d: .85, r: 1 }, trick: { d: 1.04, r: 1 } };
const BLD_K = { cd: 48 * 3600, respec: 3 * 3600, loss: 5, stuck: 45 * 3600, suggest: 30, fee: [15, 6] };
const BLD_WHY = {
  start: 'с детства мечтал', loss: 'надоело проигрывать', item: 'нашёл вещь мечты', stuck: 'застрял в развитии', god: 'по совету бога', dun: 'пещеры не прощают', migr: 'так сложилось'
};
const BLD_SAY = {
  start: ['Решил: буду {t}! Мама говорила, что у меня талант.', 'Посмотрел на себя в лужу и понял: я — {b}. Без вариантов.', 'Гадалка сказала, что мой путь — {b}. Гадалке я заплатил, значит, правда.'],
  loss: ['Хватит! Решил, что я вообще-то {b}. Прошлое — ошибка молодости.', 'Меня бьют, значит, путь неверный. Становлюсь {t}!'],
  item: ['Нашёл «{i}» — это знак! Теперь я {b}.', '«{i}» так ладно сидит в руке… Похоже, я всю жизнь был {t}.'],
  stuck: ['Что-то я застоялся. Попробую себя в роли: {b}.', 'Скучно быть тем, кем был. Буду {t}!'],
  god: ['Бог шепнул: «будь {t}». Ну раз бог…', 'Послушал бога: отныне я {b}. Начинаю переучиваться.'],
  dun: ['Пещера показала: старый путь не работает. Пробую стать {t}.'],
  no: ['Бог советует стать {t}? Не-а. Я сам знаю, кем мне быть.', 'Подумал над советом стать {t}… Подумал ещё… Нет.', 'Стать {t}? Звучит как работа. Отказываюсь.']
};
