/* global Class */

(function (__undefined) {
    this.Applicable = Class.extend({
        init: function () {
            this.applicable_byte = Applicable.SUCCESS;
        },
        applicableTo: function (mod_container) {
            
        },
        resetApplicable: function () {
            
        },
        applicableByteHuman: function () {
            
        }
    });
    
    this.Applicable.map = function (mod_collection, mod_container) {
        return $.map(mod_collection.slice(), function (mod) {
            if (mod.applicableTo) {
                mod.applicableTo(mod_container);
            }
            return mod;
        });
    };
    
    this.Applicable.mods = function (mod_collection, mod_container, success) {
        return $.grep(mod_collection.slice(), function (mod) {
            return mod.applicableTo && mod.applicableTo(mod_container, success);
        });
    };
    
    this.Applicable.UNSCANNED = 0;
    this.Applicable.SUCCESS = 1;
})();