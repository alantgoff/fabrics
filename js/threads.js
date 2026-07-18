/* Thread shade catalogs + color matcher.
 *
 * Shade lists are curated approximations: hex values are screen estimates of
 * dyed thread and code/name pairs are best-effort — treat matches as ranked
 * starting points and confirm against a physical color card. Corrections are
 * one-line edits here. */
const THREADS = (() => {
  // [code, name, hex]
  const GUTERMANN = [
    ['800', 'White', '#f8f7f3'], ['111', 'Ivory', '#f4efe2'], ['022', 'Cream', '#f2ead2'],
    ['414', 'Eggshell', '#ede4d3'], ['070', 'Sand', '#dfd1b4'], ['186', 'Beige', '#d2bfa0'],
    ['520', 'Khaki', '#b3a179'], ['722', 'Taupe', '#a08e7c'], ['868', 'Mushroom', '#8c7c6d'],
    ['038', 'Light Gray', '#c9c8c4'], ['008', 'Silver Gray', '#b0afac'], ['040', 'Mid Gray', '#8f8e8b'],
    ['701', 'Slate Gray', '#6e6e6e'], ['036', 'Charcoal', '#4a4a4a'], ['125', 'Dark Charcoal', '#333333'],
    ['000', 'Black', '#1c1c1c'],
    ['502', 'Pale Yellow', '#f5ecb2'], ['852', 'Lemon', '#f3e370'], ['177', 'Buttercup', '#f2d33c'],
    ['417', 'Sun Yellow', '#f0c419'], ['968', 'Gold', '#d9a927'], ['971', 'Old Gold', '#c19334'],
    ['412', 'Mustard', '#b8892c'], ['448', 'Honey', '#c9973f'],
    ['122', 'Peach', '#f5c8a0'], ['350', 'Apricot', '#f0a86c'], ['362', 'Light Orange', '#f09a48'],
    ['470', 'Orange', '#e97d24'], ['982', 'Burnt Orange', '#c8651f'], ['932', 'Rust', '#a54a20'],
    ['649', 'Blush', '#f3cfc6'], ['659', 'Light Pink', '#f2b8c0'], ['320', 'Rose Pink', '#e78ca0'],
    ['321', 'Pink', '#e26a8d'], ['382', 'Hot Pink', '#d63f7c'], ['733', 'Fuchsia', '#c02472'],
    ['890', 'Magenta', '#a51d64'],
    ['406', 'Coral', '#ec6a5c'], ['364', 'Salmon', '#ea8574'],
    ['156', 'Light Red', '#d94b4b'], ['410', 'Red', '#c11f2f'], ['365', 'Scarlet', '#b31226'],
    ['408', 'Cherry', '#9c1a2c'], ['226', 'Dark Red', '#851b26'], ['369', 'Wine', '#6e1a28'],
    ['450', 'Burgundy', '#5c1a26'], ['108', 'Maroon', '#4d1e24'],
    ['300', 'Pale Lilac', '#dcc9e0'], ['158', 'Lilac', '#c1a0cc'], ['391', 'Lavender', '#a486bd'],
    ['810', 'Violet', '#7d5a9e'], ['392', 'Purple', '#5f3d85'], ['128', 'Deep Purple', '#472a66'],
    ['129', 'Plum', '#6c3a5c'], ['455', 'Eggplant', '#472b3f'],
    ['193', 'Ice Blue', '#cfe0ea'], ['075', 'Powder Blue', '#a8c6dd'], ['143', 'Sky Blue', '#7fb0d4'],
    ['196', 'Light Blue', '#5f96c8'], ['322', 'Cornflower', '#4a76b8'], ['315', 'Medium Blue', '#31599f'],
    ['214', 'Royal Blue', '#1f3f8f'], ['232', 'Cobalt', '#1c3a7d'], ['310', 'Navy', '#1e2a50'],
    ['339', 'Dark Navy', '#171f3a'], ['112', 'Midnight', '#12172b'],
    ['904', 'Denim Blue', '#3a5a86'], ['236', 'Steel Blue', '#5a7591'],
    ['714', 'Aqua', '#7fcbd1'], ['736', 'Turquoise', '#3aacb5'], ['189', 'Teal', '#1f7d84'],
    ['870', 'Dark Teal', '#155a60'], ['687', 'Petrol', '#1d4e57'],
    ['152', 'Mint', '#bfe3cc'], ['205', 'Light Green', '#94cc8f'], ['833', 'Apple Green', '#6fb356'],
    ['396', 'Grass Green', '#4d9440'], ['235', 'Kelly Green', '#2e8540'], ['402', 'Emerald', '#1e7a4c'],
    ['788', 'Forest Green', '#1e5631'], ['472', 'Bottle Green', '#173f28'],
    ['582', 'Sage', '#a4b494'], ['824', 'Olive', '#77713c'], ['432', 'Dark Olive', '#565426'],
    ['616', 'Moss', '#6d7a3d'],
    ['893', 'Nude', '#e8c9ac'], ['139', 'Camel', '#c69c6d'], ['887', 'Caramel', '#ab7943'],
    ['854', 'Toffee', '#8f5f33'], ['650', 'Cocoa', '#6e4a2f'], ['694', 'Brown', '#5b3a26'],
    ['696', 'Dark Brown', '#43291a'], ['697', 'Espresso', '#2f1d13'],
    ['169', 'Ecru', '#e9dfc8'], ['618', 'Linen', '#d8cbae'],
  ];

  const COATS = [
    ['0100', 'White', '#f8f7f4'], ['0210', 'Natural', '#f1eadb'], ['0260', 'Cream', '#f0e7cd'],
    ['8010', 'Ivory', '#efe8d8'], ['0270', 'Ecru', '#e5d8bd'], ['0250', 'Buff', '#d8c5a3'],
    ['0300', 'Tan', '#c3a27a'], ['0320', 'Khaki', '#a99268'], ['0360', 'Taupe', '#93826f'],
    ['0410', 'Silver', '#c7c6c2'], ['0420', 'Nickel', '#adacaa'], ['0450', 'Gray', '#8b8a88'],
    ['0620', 'Slate', '#69696a'], ['0810', 'Charcoal', '#454546'], ['0900', 'Black', '#1c1c1c'],
    ['7010', 'Pale Yellow', '#f6eeb5'], ['7150', 'Lemon Ice', '#f4e57a'], ['7250', 'Yellow', '#f1d43e'],
    ['7330', 'Sun Yellow', '#efc31e'], ['7530', 'Gold', '#d5a52c'], ['7560', 'Old Gold', '#bd8f32'],
    ['7640', 'Mustard', '#b28429'],
    ['8210', 'Peach', '#f5c69c'], ['8410', 'Apricot', '#f1a568'], ['8620', 'Orange', '#e87e26'],
    ['8720', 'Tangerine', '#e06a1e'], ['8890', 'Rust', '#a84d21'],
    ['1310', 'Blush', '#f4d0c8'], ['1350', 'Light Pink', '#f2b6bf'], ['1450', 'Rose', '#e88ba0'],
    ['1840', 'Pink', '#e0688b'], ['1950', 'Hot Pink', '#d43e7b'], ['2050', 'Fuchsia', '#bc2470'],
    ['2260', 'Magenta', '#a01c62'],
    ['2820', 'Coral', '#eb695b'], ['2870', 'Salmon', '#e98371'],
    ['2160', 'Light Red', '#d84a49'], ['2250', 'Red', '#bf1f2e'], ['2270', 'Scarlet', '#b01225'],
    ['2320', 'Cherry', '#991a2b'], ['2420', 'Crimson', '#831a25'], ['2620', 'Wine', '#6b1a27'],
    ['2740', 'Burgundy', '#591a25'], ['2810', 'Maroon', '#4a1e23'],
    ['3040', 'Orchid', '#d9c6de'], ['3130', 'Lilac', '#bd9dc9'], ['3330', 'Lavender', '#a081ba'],
    ['3530', 'Violet', '#795798'], ['3690', 'Purple', '#5b3a80'], ['3750', 'Deep Purple', '#452963'],
    ['3830', 'Plum', '#683a59'], ['3910', 'Eggplant', '#452a3d'],
    ['4030', 'Ice Blue', '#cedfe9'], ['4110', 'Powder Blue', '#a5c4db'], ['4230', 'Sky Blue', '#7cadd2'],
    ['4320', 'Light Blue', '#5c93c5'], ['4440', 'Cornflower', '#4873b5'], ['4550', 'Medium Blue', '#2f579c'],
    ['4650', 'Royal Blue', '#1e3d8c'], ['4720', 'Cobalt', '#1b387a'], ['4900', 'Navy', '#1d294e'],
    ['4950', 'Dark Navy', '#161e38'], ['4970', 'Midnight', '#111629'],
    ['4530', 'Denim', '#395884'], ['4340', 'Steel Blue', '#58738f'],
    ['5230', 'Aqua', '#7cc9cf'], ['5350', 'Turquoise', '#38aab3'], ['5470', 'Teal', '#1e7b82'],
    ['5560', 'Dark Teal', '#14585e'], ['5610', 'Petrol', '#1c4c55'],
    ['6030', 'Mint', '#bde1ca'], ['6130', 'Light Green', '#91ca8c'], ['6240', 'Apple Green', '#6cb053'],
    ['6360', 'Grass Green', '#4a913d'], ['6450', 'Kelly Green', '#2c823e'], ['6550', 'Emerald', '#1d774a'],
    ['6760', 'Forest Green', '#1d542f'], ['6790', 'Bottle Green', '#163d26'],
    ['6110', 'Sage', '#a1b191'], ['6720', 'Olive', '#746e3a'], ['6740', 'Dark Olive', '#535124'],
    ['6340', 'Moss', '#6a773b'],
    ['8110', 'Nude', '#e7c7a9'], ['8270', 'Camel', '#c3996a'], ['8360', 'Caramel', '#a87641'],
    ['8450', 'Toffee', '#8c5d31'], ['8530', 'Cocoa', '#6b482d'], ['8630', 'Brown', '#583824'],
    ['8770', 'Dark Brown', '#412818'], ['8960', 'Espresso', '#2d1c12'],
  ];

  const BRANDS = [
    { name: 'Gütermann Sew-All', shades: GUTERMANN },
    { name: 'Coats & Clark Dual Duty XP', shades: COATS },
  ];

  /* sRGB hex → CIE Lab (D65) */
  function hexToLab(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    const v = parseInt(m[1], 16);
    const lin = c => {
      c /= 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const r = lin((v >> 16) & 255), g = lin((v >> 8) & 255), b = lin(v & 255);
    let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
    let y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    x = f(x); y = f(y); z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }

  function deltaE(lab1, lab2) {
    return Math.sqrt(
      (lab1[0] - lab2[0]) ** 2 + (lab1[1] - lab2[1]) ** 2 + (lab1[2] - lab2[2]) ** 2);
  }

  /* Rank each brand's shades by closeness to a hex color. */
  function matchThreads(hex, perBrand = 3) {
    const target = hexToLab(hex);
    if (!target) return [];
    return BRANDS.map(brand => ({
      brand: brand.name,
      matches: brand.shades
        .map(([code, name, shadeHex]) => ({
          code, name, hex: shadeHex,
          deltaE: deltaE(target, hexToLab(shadeHex)),
        }))
        .sort((a, b) => a.deltaE - b.deltaE)
        .slice(0, perBrand),
    }));
  }

  function findShade(brandName, code) {
    const brand = BRANDS.find(b => b.name === brandName);
    if (!brand) return null;
    const hit = brand.shades.find(([c]) => c === String(code).trim());
    return hit ? { code: hit[0], name: hit[1], hex: hit[2] } : null;
  }

  return { BRANDS, matchThreads, findShade };
})();
