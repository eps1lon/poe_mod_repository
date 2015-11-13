/* global Mod, ModGenerator, Item */

(function (__undefined) {
    this.Augment = ModGenerator.extend({
        init: function (all_mods) {
            this._super(new Transmute(all_mods).available_mods);
        },
        applyTo: function (mod_container) { 
            if (mod_container.rarity === Item.rarity.MAGIC) {
                if (mod_container.addMod(this.chooseApplicableMod(mod_container))) {
                    return true;
                }
                
                throw new ModGeneratorException("already prefix and suffix");
                
                return false;
            }
            
            // TODO augment ingame msg when not white
            throw new ModGeneratorException("not magic rarity");
            
            return false;
        }
    });
})();