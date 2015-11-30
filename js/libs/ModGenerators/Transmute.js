/* global Mod, ModGenerator, Item, Currency */

(function (__undefined) {
    this.Transmute = Currency.extend({
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
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
    
    this.Transmute.mod_filter = function (mod_props) {
        // prefix/suffix only
        return [Mod.MOD_TYPE.PREFIX, Mod.MOD_TYPE.SUFFIX].indexOf(+mod_props["GenerationType"]) !== -1;
    };
})();