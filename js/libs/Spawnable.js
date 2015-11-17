(function (__undefined) {
    /**
     * Interface
     */
    this.Spawnable = Class.extend({
        init: function () {
            this.spawnweight_cached = 0;
            this.spawnchance = null;
            this.spawnable_byte = Spawnable.SUCCESS;
        },
        spawnableOn: function (mod_container) {
            
        }
    });
    
    this.Spawnable.map = function (mod_collection, mod_container) {
        return $.map(mod_collection.slice(), function (mod) {
            mod.spawnableOn(mod_container);
            return mod;
        });
    };
    
    this.Spawnable.mods = function (mod_collection, mod_container, success) {
        return $.grep(mod_collection.slice(), function (mod) {
            return mod.spawnableOn(mod_container, success);
        });
    };
    
    /**
     * 
     * @param {Array[Spawnable]} mod_container
     * @returns {float}
     */
    this.Spawnable.calculateSpawnchance = function (spawnables) {
        var sum_spawnweight = 0;
        
        $.each(spawnables, function (_, mod) {
            sum_spawnweight += mod.spawnweight;
        });
        
        return $.map(spawnables, function (mod) {
            mod.spawnchance = mod.spawnweight / sum_spawnweight;
            return mod;
        });
    };
    
    // Convention
    this.Spawnable.UNSCANNED = 0;
    this.Spawnable.SUCCESS = 1;
})();