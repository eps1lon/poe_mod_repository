/* global this */

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
        /*
        AUGMENT: {
            klass: "Augment",
            name: "Orb of Augmentation",
            stats: [
                "Currency",
                "Enchants a magic item with a new random property",
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
        },//*/
        Currency: {
            klass: "Currency",
            name: "Orb of Testing",
            stats: [
                "Currency",
                "Adds one property to an item",
                "Right click this item then left click a normal item to apply"
            ]
        },
        ItemShowcase: {
            klass: "ItemShowcase",
            name: "Showcase",
            stats: [
                "All Mods",
                "shows all possible mods"
            ]
        }
    };
})();

