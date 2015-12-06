/* global Currency, Mod, Vaal */

(function (__undefined) {
    /**
     * class Vaal extends Currency
     * 
     * ingame representation of Vaal Orb only regarding implicit corruptions
     */
    this.Vaal = Currency.extend({
        /**
         * @constructor
         * @param {type} all_mods
         * @returns {Vaal}
         */
        init: function (all_mods) {
            this._super(all_mods, Vaal.mod_filter);
        }
    });
    
    this.Vaal.mod_filter = function (mod_props) {
        // vaal implicits
        return [Mod.MOD_TYPE.VAAL].indexOf(+mod_props.GenerationType) !== -1;
    };
})();