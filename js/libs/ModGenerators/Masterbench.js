/* global ModGenerator, Mod, MasterMod, Item */

(function (__undefined) {
    /**
     * Masterbench extends ModGenerator
     */
    this.Masterbench = ModGenerator.extend({
        init: function (all_mods, npc_master_key) {
            // all options
            // craftingbenchoptions instanceof {} so we cant use grep
            this.craftingbenchoptions = $.map(MasterMod.craftingbenchoptions, function (option) {
                if (+option['NPCMasterKey'] === npc_master_key) {
                    return option;
                }
                return null;
            });
            
            // init mods
            /*
             * |mods| >> |craftingbenchoptions| so we loop through
             * mods and grep options instead of looping through options 
             * and grep mod
             */
            var that = this;
            this._super($.map(all_mods, function (mod_props) {
                if (+mod_props['Domain'] === Mod.DOMAIN.MASTER) {
                    // mastermod? => look for craftingbench
                    var craftingbenchoption = $.grep(that.craftingbenchoptions, function (option) {
                        return +option['ModsKey'] === +mod_props['Rows'];
                    })[0];
                    
                    if (!craftingbenchoption) {
                        // most likely legacy
                        //console.log("could not find craftingbenchoption for ", +mod['Rows'], mod);
                        return null;
                    }
                          
                    return new MasterMod(mod_props, craftingbenchoption);
                }
                
                return null;
            }), MasterMod);
            
            // possible interface between gui and class
            this.chosen_mod = null;
        },
        applyTo: function (option) {
            return false;
        },
        applicableTo: function (item) {
            return true;
        },
        applicableByteHuman: function () {
            return {
                strings: [],
                bits: []
            };
        },
        chooseMod: function (item) {
            // todo interface between gui and choosemod
            return this.getAvailableMods()[0];
        },
        mods: function (baseitem, success) {
            // simulate blue if white
            var old_rarity = baseitem.rarity;
            if (old_rarity === Item.RARITY.NORMAL) {
                baseitem.rarity = Item.RARITY.MAGIC;
            }
            
            var mods = $.grep(this.getAvailableMods(), function (mod) {
                return mod.applicableTo(baseitem, success);
            });
            
            // reroll
            baseitem.rarity = old_rarity;
            
            return mods;
        },
        map: function (baseitem, success) {
            // simulate blue if white
            var old_rarity = baseitem.rarity;
            if (old_rarity === Item.RARITY.NORMAL) {
                baseitem.rarity = Item.RARITY.MAGIC;
            }
            
            var mods = $.map(this.getAvailableMods(), function (mod) {
                mod.applicableTo(baseitem, success);
                return mod;
            });
            
            // reroll
            baseitem.rarity = old_rarity;
            
            return mods;
        }
    });
})();