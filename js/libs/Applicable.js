/* global Class */

(function (__undefined) {
    /**
     * interface Applicable
     */
    this.Applicable = Class.extend({
        init: function () {
            this.applicable_byte = Applicable.SUCCESS;
        },
        applicableTo: function (mod_container) {
            
        },
        resetApplicable: function () {
            
        },
        applicableByteHuman: function () {
            
        },
        applicableCached: function () {
            
        }
    });
    
    this.Applicable.map = function (mod_collection, mod_container) {
        return $.map(mod_collection.slice(), function (mod) {
            if (Applicable.implementedBy(mod)) {
                mod.applicableTo(mod_container);
            }
            return mod;
        });
    };
    
    this.Applicable.mods = function (mod_collection, mod_container, success) {
        return $.grep(mod_collection.slice(), function (mod) {
            return Applicable.implementedBy(mod) && mod.applicableTo(mod_container, success);
        });
    };
    
    // interface pattern
    this.Applicable.implementedBy = function (clazz) {
        return  clazz.applicableTo !== __undefined;
    };
    
    this.Applicable.UNSCANNED = 0;
    this.Applicable.SUCCESS = 1;
})();