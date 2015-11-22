/* global Mod, MasterMod, ApplicableMod */

(function (__undefined) {
    this.ItemShowcase = ModGenerator.extend({
        init: function (all_mods) {
            var mods = $.map(all_mods, function (mod) {
                if ([Mod.MOD_TYPE.PREFIX, Mod.MOD_TYPE.SUFFIX, Mod.MOD_TYPE.IMPLICIT].indexOf(+mod["GenerationType"]) === -1 ) {
                    return null;
                }
                
                if (+mod['Domain'] === Mod.DOMAIN.MASTER) {
                    var craftingbenchoption = $.map(MasterMod.craftingbenchoptions, function (option) {
                        if (+option['ModsKey'] === +mod['Rows']) {
                            return option;
                        }
                        return null;
                    })[0];
                    
                    if (!craftingbenchoption) {
                        // most likely legacy
                        //console.log("could not find craftingbenchoption for ", +mod['Rows'], mod);
                        return null;
                    }
                          
                    return new MasterMod(mod, craftingbenchoption);
                }
                
                if (mod["SpawnWeight_TagsKeys"] !== "") {
                    return new RollableMod(mod);
                }

                return null;
            });
            
            this._super(mods, ApplicableMod);
            
            //console.log(this.getAvailableMods());
        },
        applyTo: function (mod_container) {
            return false;
        }
    });
})();