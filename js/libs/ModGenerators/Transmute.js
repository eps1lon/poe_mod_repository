/* global Mod, ModGenerator, Item, Currency */

(function (__undefined) {
    this.Transmute = Currency.extend({
        init: function (all_mods) {
            this._super(all_mods);
        },
        mapApplicable: function (mod_container) {
            var old_rarity = mod_container.rarity;
            
            // simulate applicable mods as blue item
            mod_container.rarity = Item.rarity.MAGIC;
            var applicable_mods = this._super(mod_container);
            mod_container.rarity = old_rarity;
            
            return applicable_mods;
        },
        applyTo: function (mod_container) {
            if (mod_container.rarity === Item.rarity.NORMAL) {
                // change to magic
                mod_container.rarity = Item.rarity.MAGIC;

                // add one affix
                if (mod_container.addMod(this.chooseApplicableMod(mod_container))) {
                    // and maybe another
                    // TODO transmute rolls for number of affixes?
                    if (Math.random() <= 0.5) {
                        mod_container.addMod(this.chooseApplicableMod(mod_container));
                    }
                    return true;
                }
                // something went wrong revert to old rarity
                mod_container.rarity = Item.rarity.NORMAL;
                
                throw new ModGeneratorException("no applicable mods found");
                
                return false;
            }
            
            // TODO transmute ingame msg when not white
            throw new ModGeneratorException("not normal rarity");
            
            return false;
        }
    });
})();