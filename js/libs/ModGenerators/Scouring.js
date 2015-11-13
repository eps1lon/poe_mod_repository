/* global Item, ModGenerator */

(function (__undefined) {
    this.Scouring = ModGenerator.extend({
        init: function () {
            this._super([]);
        },
        applyTo: function (mod_container) { 
            switch (mod_container.rarity) {
                // @TODO correct ingame msgs
                case Item.rarity.UNIQUE:
                    throw new ModGeneratorException("cant scour uniques");
                case Item.rarity.NORMAL:
                    throw new ModGeneratorException("nothing to scour");
            }
            
            // @TODO affixes cannot be changed
            // and not necessarily change rarity
            
            // white item
            mod_container.rarity = Item.rarity.NORMAL;
            
            // without mods
            mod_container.removeAllMods();
            
            return true;
        }
    });
})();