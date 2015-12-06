/* global ModGenerator, Mod, MasterMod, Item */

(function (__undefined) {
    /**
     * class Masterbench extends ModGenerator
     * 
     * ingame representation of a Craftingbench
     */
    this.Masterbench = ModGenerator.extend({
        /**
         * MasterMod.craftingbenchoptions needs to be initialized
         * @constructor
         * @param {Array} all_mods
         * @param {Number} npc_master_key NPCMasterKey column
         * @returns {Masterbench}
         */
        init: function (all_mods, npc_master_key) {
            // all options
            // craftingbenchoptions instanceof {} so we cant use grep
            this.craftingbenchoptions = $.map(MasterMod.craftingbenchoptions, function (option) {
                if (+option.NPCMasterKey === npc_master_key) {
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
                if (+mod_props.Domain === Mod.DOMAIN.MASTER) {
                    // mastermod? => look for craftingbench
                    var craftingbenchoption = $.grep(that.craftingbenchoptions, function (option) {
                        return +option.ModsKey === +mod_props.Rows;
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
        /**
         * applies a chosen craftingbenchoption
         * 
         * @param {Item} baseitem
         * @param {Number} option_index option_index within this.craftingbenchoptions
         * @returns {Boolean}
         */
        applyTo: function (baseitem, option_index) {
            var mod, old_rarity;
            
            // option within options
            var option = this.craftingbenchoptions[option_index];
            if (option === __undefined) {
                return false;
            }
            
            mod = $.grep(this.getAvailableMods(), function (mod) {
                return +mod.getProp("Rows") === +option.ModsKey;
            })[0];
            
            // valid mod?
            if (!(mod instanceof MasterMod)) {
                console.log(mod, "needs to be instanceof MasterMod");
                return false;
            }
            
            // white gets upgraded to blue
            old_rarity = baseitem.rarity;
            if (old_rarity === Item.RARITY.NORMAL) {
                baseitem.rarity = Item.RARITY.MAGIC;
            }
            
            // mod applicable
            if (mod.applicableTo(baseitem)) {
                return baseitem.addMod(mod);
            }
            
            // return to old rarity on failure
            baseitem.rarity = old_rarity;
            
            return false;
        },
        /**
         * every item is welcome
         * @param {Item} item
         * @returns {Boolean}
         */
        applicableTo: function (item) {
            return true;
        },
        applicableByteHuman: function () {
            return {
                strings: [],
                bits: []
            };
        },
        /**
         * greps mod::applicableTo 
         * @param {Item} baseitem
         * @param {byte} success whitelist
         * @returns {Array}
         */
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
        /**
         * greps mod::applicableTo
         * 
         * @param {Item} baseitem
         * @param {byte} success whitelist
         * @returns {Array}
         */
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