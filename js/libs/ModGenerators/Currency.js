/* global RollableMod, Mod */

(function (__undefined) {
    this.Currency = ModGenerator.extend({
        init: function (all_mods) {
            this._super($.grep(all_mods, function (mod) {
                return [Mod.MOD_TYPE.PREFIX, Mod.MOD_TYPE.SUFFIX, Mod.MOD_TYPE.IMPLICIT].indexOf(+mod["GenerationType"]) !== -1 
                        && mod["SpawnWeight_TagsKeys"] !== "";
            }), RollableMod);
        },
        applyTo: function (mod_container) {
            return false;
        }
    });
})();