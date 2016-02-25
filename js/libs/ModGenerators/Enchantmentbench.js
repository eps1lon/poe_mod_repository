(function (__undefined) {
    var ModGenerator = require('./ModGenerator');
    var Mod = require('../mods/Mod');
    var RollableMod = require('../mods/RollableMod');
    
    var $ = require('../jquery/jquery_node');
    
    /**
     * class EnchantmentBench extends ModGenerator
     * 
     * ingame representation of a enchantment bench
     */
    var Enchantmentbench = ModGenerator.extend({
        init: function (all_mods, and_filter) {
            if (and_filter === __undefined) {
                // dummy filter
                and_filter = function () { return true; };
            }
            
            this._super(all_mods, RollableMod, function (mod) {
                return mod.SpawnWeight_TagsKeys !== "" && 
                        Enchantmentbench.mod_filter(mod);
            });
        },
        applyTo: function (mod_container) {
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
        name: function () {
            return 'Enchantmentbench';
        },
        mods: function (baseitem, success) {
            return $.grep(this.getAvailableMods(), function (mod) {
                return mod.applicableTo(baseitem, success) && 
                        mod.spawnableOn(baseitem);
            });
        },
        map: function (baseitem, success) {
            return $.map(this.getAvailableMods(), function (mod) {
                mod.applicableTo(baseitem, success);
                mod.spawnableOn(baseitem);
                
                return mod;
            });
        }
    });
    
    Enchantmentbench.mod_filter = function (mod_props) {
        // talisman wildcard
        return [Mod.MOD_TYPE.ENCHANTMENT].indexOf(+mod_props.GenerationType) !== -1;
    };
    
    module.exports = Enchantmentbench;
}).call(this);