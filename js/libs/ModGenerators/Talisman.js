/* global ModGenerator, Mod */

(function (__undefined) {
    /**
     * TODO
     */
    this.Talisman = ModGenerator.extend({
        init: function () {
            
        }
    });
    
    this.Talisman.mod_filter = function (mod_props) {
        // talisman wildcard
        return [Mod.MOD_TYPE.ENCHANTMENT].indexOf(+mod_props.GenerationType) !== -1;
    };
})();