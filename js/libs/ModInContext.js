/* global Mod */

(function (__undefined) {
    /**
     * deprecated
     */
    this.ModInContext = Mod.extend({
        init: function (props) {
            this._super(props);
            
            // spawnchanceCalculateable
            this.spawnweight = null;
            this.spawnchance = 0;
            
            this.mod_gen_exception = null;
        },
        isApplicable: function () {
            return this.mod_gen_exception === null && this.spawnweight > 0;
        }
    });
    
    /**
     * 
     * @param {Array[mod]} mods
     * @returns {Array[mod]}
     */
    this.ModInContext.calculateSpawnchance = function (mods) {
        var sum_spawnweight = 0;
        
        $.each(mods, function (_, mod) {
            if (!mod.isApplicable()) {
                // continue
                return true;
            }
            sum_spawnweight += mod.spawnweight;
        });
        
        return $.map(mods, function (mod) {
            mod.spawnchance = mod.spawnweight / sum_spawnweight;
            return mod;
        });
    };
})();

