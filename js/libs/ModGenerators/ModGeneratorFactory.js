/* global this, Class, ModGeneratorFactory */

(function (__undefined) {
    this.ModGeneratorFactory = Class.extend({});
    
    this.ModGeneratorFactory.build = function (ident, all_mods) {
        var generator = ModGeneratorFactory.GENERATORS[ident];
        if (!generator) {
            console.log("could not identify ", ident);
            return null;
        }
        return new window[generator.klass](all_mods);
    };
    
    this.ModGeneratorFactory.GENERATORS = {
        TRANSMUTE: {
            klass: "Transmute",
            name: "Orb of Transmutation",
            stats: [
                "Currency",
                "Upgrades a normal item to a magic item",
                "Right click this item then left click a normal item to apply"
            ]
        },
        AUGMENT: {
            klass: "Augment",
            name: "Orb of Augmentation",
            stats: [
                "Currency",
                "Enchants a magic item with a new random property",
                "Right click this item then left click a normal item to apply"
            ]
        },
        ALTERATION: {
            klass: "Alteration",
            name: "Orb of Alteration",
            stats: [
                "Currency",
                "Reforges a magic item with new random properties",
                "Right click this item then left click a normal item to apply"
            ]
        },
        SCOURING: {
            klass: "Scouring",
            name: "Orb of Scouring",
            stats: [
                "Currency",
                "Removes all properties from an item",
                "Right click this item then left click a normal item to apply"
            ]
        },
        REGAL: {
            klass: "Regal",
            name: "Regal Orb",
            stats: [
                "Currency",
                "Upgrades a magic item to a rare item",
                "Right click this item then left click a magic item to apply it. Current properties are retained and a new one is added."
            ]
        },
        ALCHEMY: {
            klass: "Alchemy",
            name: "Orb of Alchemy",
            stats: [
                "Currency",
                "Upgrades a normal item to rare item",
                "Right click this item then left click a magic item to apply it. Current properties are retained and a new one is added."
            ]
        },
        CHAOS: {
            klass: "Chaos",
            name: "Chaos Orb",
            stats: [
                "Currency",
                "Upgrades a magic item to a rare item",
                "Right click this item then left click a magic item to apply it. Current properties are retained and a new one is added."
            ]
        },
        EXALTED: {
            klass: "Exalted",
            name: "Exalted Orb",
            stats: [
                "Currency",
                "Enchants a rare item with a new random property",
                "Right click this item then left click a rare item to apply it. Rare items can have up to six random properties."
            ]
        },
        ITEMSHOWCASE: {
            klass: "ItemShowcase",
            name: "Showcase",
            stats: [
                "All Mods",
                "shows all possible mods"
            ]
        },
        ENCHANTMENTBENCH: {
            klass: "Enchantmentbench",
            name: "Enchantmentbench",
            stats: [
                "Craftingbench",
                "crafts implicit enchantments"
            ]
        }
    };
})();

