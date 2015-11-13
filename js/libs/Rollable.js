(function (__undefined) {
    /**
     * Interface Rollable extends Spawnable, Applicable
     */
    this.Rollable = Class.extend({
        init: function () {
            this.rollable_byte = Rollable.SUCCESS;
        },
        rollableOn: function (mod_container) {
            
        }
    });
    
    this.Rollable.map = function (mod_collection, mod_container) {
        return $.map(mod_collection.slice(), function (mod) {
            mod.rollableOn(mod_container);
            return mod;
        });
    };
    
    this.Rollable.mods = function (mod_collection, mod_container) {
        return $.grep(mod_collection.slice(), function (mod) {
            return mod.rollableOn(mod_container);
        });
    };
    
    // Convention
    this.Rollable.UNSCANNED = 0;
    this.Rollable.SUCCESS = 1;
})();