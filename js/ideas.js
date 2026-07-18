/* Rule-based project idea engine.
 * Each idea lists the fabric categories it suits and rough yardage needed
 * (assumes ~44" width; generous estimates for a typical adult size). */
const IDEAS = (() => {
  const FABRIC_TYPES = [
    'Quilting cotton', 'Cotton lawn / voile', 'Linen', 'Rayon / viscose',
    'Cotton knit / jersey', 'French terry / sweatshirt', 'Rib knit',
    'Flannel', 'Denim / twill', 'Canvas / duck', 'Corduroy',
    'Wool / suiting', 'Satin / silky', 'Chiffon / sheer', 'Velvet',
    'Fleece', 'Minky / plush', 'Faux leather / vinyl', 'Lace', 'Tulle / mesh',
    'Home dec / upholstery', 'Other',
  ];

  // Category tags per type, used to match ideas.
  const TYPE_TAGS = {
    'Quilting cotton': ['woven-light', 'quilting', 'craft'],
    'Cotton lawn / voile': ['woven-light', 'drapey'],
    'Linen': ['woven-light', 'woven-mid', 'drapey'],
    'Rayon / viscose': ['drapey', 'woven-light'],
    'Cotton knit / jersey': ['knit'],
    'French terry / sweatshirt': ['knit', 'cozy'],
    'Rib knit': ['knit'],
    'Flannel': ['woven-mid', 'cozy', 'quilting'],
    'Denim / twill': ['woven-heavy', 'structured'],
    'Canvas / duck': ['woven-heavy', 'structured', 'bag'],
    'Corduroy': ['woven-mid', 'woven-heavy', 'structured'],
    'Wool / suiting': ['woven-mid', 'structured', 'cozy'],
    'Satin / silky': ['drapey', 'fancy'],
    'Chiffon / sheer': ['drapey', 'fancy'],
    'Velvet': ['fancy', 'woven-mid'],
    'Fleece': ['cozy', 'knit', 'craft'],
    'Minky / plush': ['cozy', 'craft'],
    'Faux leather / vinyl': ['bag', 'structured'],
    'Lace': ['fancy'],
    'Tulle / mesh': ['fancy'],
    'Home dec / upholstery': ['woven-heavy', 'bag', 'home'],
    'Other': [],
  };

  const PROJECTS = [
    { name: 'Scrunchies & hair ties', yards: 0.25, tags: ['woven-light', 'drapey', 'fancy', 'knit', 'quilting'] },
    { name: 'Zipper pouch', yards: 0.25, tags: ['quilting', 'woven-light', 'woven-mid', 'bag', 'craft'] },
    { name: 'Coasters or mug rugs', yards: 0.25, tags: ['quilting', 'craft', 'woven-mid'] },
    { name: 'Face mask / small gifts', yards: 0.5, tags: ['quilting', 'woven-light'] },
    { name: 'Baby bibs & burp cloths', yards: 0.5, tags: ['quilting', 'cozy', 'knit', 'craft'] },
    { name: 'Beanie or headband', yards: 0.5, tags: ['knit', 'cozy'] },
    { name: 'Tote bag', yards: 1, tags: ['bag', 'woven-heavy', 'quilting', 'home', 'structured'] },
    { name: 'Throw pillow covers', yards: 1, tags: ['home', 'woven-heavy', 'quilting', 'woven-mid', 'fancy'] },
    { name: 'Camisole or tank top', yards: 1, tags: ['drapey', 'knit', 'woven-light'] },
    { name: 'Baby leggings & tops', yards: 1, tags: ['knit'] },
    { name: 'Apron', yards: 1.5, tags: ['woven-mid', 'woven-heavy', 'quilting', 'structured'] },
    { name: 'T-shirt', yards: 1.5, tags: ['knit'] },
    { name: 'Pencil or A-line skirt', yards: 1.5, tags: ['woven-mid', 'structured', 'drapey', 'knit'] },
    { name: 'Woven blouse', yards: 1.75, tags: ['woven-light', 'drapey'] },
    { name: 'Pajama pants', yards: 2, tags: ['woven-light', 'cozy', 'knit', 'quilting'] },
    { name: 'Leggings', yards: 2, tags: ['knit'] },
    { name: 'Baby quilt', yards: 2, tags: ['quilting', 'cozy', 'craft'] },
    { name: 'Sweatshirt / hoodie', yards: 2, tags: ['knit', 'cozy'] },
    { name: 'Simple gathered skirt', yards: 2, tags: ['woven-light', 'drapey', 'quilting'] },
    { name: 'Curtains (one window)', yards: 2.5, tags: ['home', 'woven-light', 'woven-mid', 'fancy'] },
    { name: 'Knit dress', yards: 2.5, tags: ['knit'] },
    { name: 'Shorts or cropped pants', yards: 1.5, tags: ['woven-mid', 'woven-heavy', 'structured'] },
    { name: 'Trousers / jeans', yards: 2.5, tags: ['woven-heavy', 'structured', 'woven-mid'] },
    { name: 'Shirt dress or day dress', yards: 3, tags: ['woven-light', 'drapey', 'woven-mid'] },
    { name: 'Cozy robe', yards: 3, tags: ['cozy', 'knit', 'drapey'] },
    { name: 'Structured jacket', yards: 3, tags: ['structured', 'woven-heavy', 'woven-mid'] },
    { name: 'Throw blanket', yards: 3, tags: ['cozy', 'craft', 'knit'] },
    { name: 'Maxi dress', yards: 4, tags: ['drapey', 'knit', 'woven-light', 'fancy'] },
    { name: 'Lap or twin quilt', yards: 4, tags: ['quilting'] },
    { name: 'Winter coat', yards: 4, tags: ['structured', 'cozy', 'woven-heavy'] },
    { name: 'Special-occasion gown', yards: 5, tags: ['fancy', 'drapey'] },
  ];

  /* Return projects that suit this fabric, split into makeable-now vs almost. */
  function suggestFor(fabric) {
    const tags = TYPE_TAGS[fabric.type] || [];
    const yards = Number(fabric.yards) || 0;
    if (!tags.length) return { now: [], almost: [] };
    const matches = PROJECTS.filter(p => p.tags.some(t => tags.includes(t)));
    return {
      now: matches.filter(p => p.yards <= yards).sort((a, b) => b.yards - a.yards),
      almost: matches.filter(p => p.yards > yards && p.yards <= yards + 1)
        .sort((a, b) => a.yards - b.yards),
    };
  }

  return { FABRIC_TYPES, suggestFor };
})();
