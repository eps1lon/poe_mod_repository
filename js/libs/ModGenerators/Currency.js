/* global RollableMod, Mod, ModGenerator */

(function (__undefined) {
    this.Currency = ModGenerator.extend({
        init: function (all_mods, and_filter) {
            if (and_filter === __undefined) {
                // dummy filter
                and_filter = function (mod) { return true; };
            }
            
            this._super(all_mods, RollableMod, function (mod) {
                return [Mod.MOD_TYPE.PREFIX, Mod.MOD_TYPE.SUFFIX, Mod.MOD_TYPE.IMPLICIT].indexOf(+mod["GenerationType"]) !== -1 
                        && mod["SpawnWeight_TagsKeys"] !== ""
                        && and_filter(mod);
            });
        },
        applyTo: function (mod_container) {
            return false;
        }
    });
})();