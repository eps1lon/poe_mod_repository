(function (__undefined) {
    var Class = require('../Inheritance');
    var Transmute = require('./Transmute');
    var Augment = require('./Augment');
    var Alteration = require('./Alteration');
    var Scouring = require('./Scouring');
    var Regal = require('./Regal');
    var Alchemy = require('./Alchemy');
    var Chaos = require('./Chaos');
    var Exalted = require('./Exalted');
    var ItemShowcase = require('./ItemShowcase');
    var Enchantmentbench = require('./Enchantmentbench');
    var Vaal = require('./Vaal');
    
    var ModGeneratorFactory = Class.extend({});
    
    ModGeneratorFactory.build = function (ident, all_mods) {
        var generator = ModGeneratorFactory.GENERATORS[ident];
        if (!generator) {
            console.log("could not identify ", ident);
            return null;
        }
        return new generator.constructor(all_mods);
    };
    
    ModGeneratorFactory.GENERATORS = {
        TRANSMUTE: {
            klass: "Transmute",
            name: "Orb of Transmutation",
            stats: [
                "Currency",
                "Upgrades a normal item to a magic item",
                "Right click this item then left click a normal item to apply"
            ],
            constructor: Transmute
        },
        AUGMENT: {
            klass: "Augment",
            name: "Orb of Augmentation",
            stats: [
                "Currency",
                "Enchants a magic item with a new random property",
                "Right click this item then left click a normal item to apply"
            ],
            constructor: Augment
        },
        ALTERATION: {
            klass: "Alteration",
            name: "Orb of Alteration",
            stats: [
                "Currency",
                "Reforges a magic item with new random properties",
                "Right click this item then left click a normal item to apply"
            ],
            constructor: Alteration
        },
        SCOURING: {
            klass: "Scouring",
            name: "Orb of Scouring",
            stats: [
                "Currency",
                "Removes all properties from an item",
                "Right click this item then left click a normal item to apply"
            ],
            constructor: Scouring
        },
        REGAL: {
            klass: "Regal",
            name: "Regal Orb",
            stats: [
                "Currency",
                "Upgrades a magic item to a rare item",
                "Right click this item then left click a magic item to apply it. Current properties are retained and a new one is added."
            ],
            constructor: Regal
        },
        ALCHEMY: {
            klass: "Alchemy",
            name: "Orb of Alchemy",
            stats: [
                "Currency",
                "Upgrades a normal item to rare item",
                "Right click this item then left click a magic item to apply it. Current properties are retained and a new one is added."
            ],
            constructor: Alchemy
        },
        CHAOS: {
            klass: "Chaos",
            name: "Chaos Orb",
            stats: [
                "Currency",
                "Upgrades a magic item to a rare item",
                "Right click this item then left click a magic item to apply it. Current properties are retained and a new one is added."
            ],
            constructor: Chaos
        },
        EXALTED: {
            klass: "Exalted",
            name: "Exalted Orb",
            stats: [
                "Currency",
                "Enchants a rare item with a new random property",
                "Right click this item then left click a rare item to apply it. Rare items can have up to six random properties."
            ],
            constructor: Exalted
        },
        ITEMSHOWCASE: {
            klass: "ItemShowcase",
            name: "Showcase",
            stats: [
                "All Mods",
                "shows all possible mods"
            ],
            constructor: ItemShowcase
        },
        ENCHANTMENTBENCH: {
            klass: "Enchantmentbench",
            name: "Enchantmentbench",
            stats: [
                "Craftingbench",
                "crafts implicit enchantments"
            ],
            constructor: Enchantmentbench
        },
        VAAL: {
            klass: "Vaal",
            name: "Vaal Orb",
            stats: [
                "Corrupts an item, modifying it",
                "unpredictably"
            ],
            constructor: Vaal
        }
    };
    
    module.exports = ModGeneratorFactory;
}).call(this);

