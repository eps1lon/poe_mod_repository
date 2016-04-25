(function (__undefined) {
    var Currency = require('./Currency');
    var Mod = require('../mods/Mod');
    
    var $ = require('../jquery/jquery_node');
    
    /**
     * class EnchantmentBench extends Currency
     * 
     * ingame representation of a enchantment bench
     */
    var Enchantmentbench = Currency.extend({
        init: function (all_mods, and_filter) {
            if (and_filter === __undefined) {
                // dummy filter
                and_filter = function () { return true; };
            }
            
            this._super(all_mods, function (mod_props) {
                return Enchantmentbench.mod_filter(mod_props) 
                        && and_filter(mod_props);
            });
        },
        /**
         * replaces implicits with new enchantment mod
         * @param {Item} item
         * @returns {Boolean}
         */
        applyTo: function (item) {
            if (this.applicableTo(item)) {
                item.removeAllImplicits();
                
                return item.addImplicits(this.chooseMod(item));
            }
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
        return [Mod.MOD_TYPE.ENCHANTMENT].indexOf(+mod_props.GenerationType) !== -1;
    };
    
    module.exports = Enchantmentbench;
}).call(this);