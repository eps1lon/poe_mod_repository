(function (__undefined) {
    var Class = require('./Inheritance');
    
    /**
     * Interface
     */
    var Spawnable = Class.extend({
        init: function () {
            this.spawnweight_cached = 0;
            this.spawnchance = null;
            this.spawnable_byte = Spawnable.SUCCESS;
        },
        spawnableOn: function (mod_container) {
            
        },
        humanSpawnchance: function (precision) {
        },
        resetSpawnable: function () {
            
        },
        spawnableByteHuman: function () {
            
        },
        spawnableCached: function () {
            
        }
    });
    
    Spawnable.map = function (mod_collection, mod_container) {
        return $.map(mod_collection.slice(), function (mod) {
            if (Spawnable.implementedBy(mod)) {
                mod.spawnableOn(mod_container);
            }
            return mod;
        });
    };
    
    Spawnable.mods = function (mod_collection, mod_container, success) {
        return $.grep(mod_collection.slice(), function (mod) {
            return !Spawnable.implementedBy(mod) || mod.spawnableOn(mod_container, success);
        });
    };
    
    // interface pattern
    Spawnable.implementedBy = function (clazz) {
        return  clazz.spawnableOn !== __undefined;
    };
    
    /**
     * 
     * @param {Array<Spawnable>} spawnables
     * @param {Function} if_cb optional callback to filter mods
     * @returns {float}
     */
    Spawnable.calculateSpawnchance = function (spawnables, if_cb) {
        var sum_spawnweight = 0;
        if (typeof if_cb !== 'function') {
            if_cb  = function () { return true; };
        }
        
        $.each(spawnables, function (_, mod) {
            if (Spawnable.implementedBy(mod) && if_cb(mod)) {
                sum_spawnweight += mod.spawnweight;
            }
        });
        
        return $.map(spawnables, function (mod) {
            if (Spawnable.implementedBy(mod) && mod.spawnweight !== null && if_cb(mod)) {
                mod.spawnchance = mod.spawnweight / sum_spawnweight;
            }
            
            return mod;
        });
    };
    
    // Convention
    Spawnable.UNSCANNED = 0;
    Spawnable.SUCCESS = 1;
    
    module.exports = Spawnable;
}).call(this);