/* global Class, Mod, ModInContext, this, ModGeneratorException, Applicable */

(function (__undefined) {
    /*
     * abstract Class ModGenerator
     */
    this.ModGenerator = Class.extend({
        /**
         * 
         * @param {Array[mods]} mod_collection
         * @param {String} mod_klass
         * @returns {undefined}
         */
        init: function (mod_collection, mod_klass, filter) {
            this.uses = Number.POSITIVE_INFINITY;
            
            if (filter === __undefined) {
                // dummy filter
                filter = function () { return true; };
            }
            
            // already filtered?
            if (mod_collection[0] instanceof mod_klass) {
                this.available_mods = mod_collection;
            } else {
                this.available_mods = $.map(mod_collection, function (mod_props) {
                    if (filter(mod_props)) {
                        return new mod_klass(mod_props);
                    }
                    return null;
                });
            }
            
        },
        /**
         * abstract
         * @param {ModContainer} mod_container
         * @returns {Boolean}
         */
        applyTo: function (mod_container) {
            
        },
        /**
         * 
         * @returns {Array}
         */
        getAvailableMods: function () {
            return this.available_mods.slice();
        }
    });
})();

