/* global Class */

(function (__undefined) {
    this.Applicable = Class.extend({
        init: function () {
            this.applicable_byte = Applicable.SUCCESS;
        },
        applicableTo: function (mod_container) {
            
        }
    });
    
    this.Applicable.map = function (mod_collection, mod_container) {
        return $.map(mod_collection.slice(), function (mod) {
            mod.applicableTo(mod_container);
            return mod;
        });
    };
    
    this.Applicable.mods = function (mod_collection, mod_container) {
        return $.grep(mod_collection.slice(), function (mod) {
            return mod.applicableTo(mod_container);
        });
    };
    
    this.Applicable.UNSCANNED = 0;
    this.Applicable.SUCCESS = 1;
})();