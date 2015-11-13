/* global Class, Mod, ModInContext, this, ModGeneratorException, Applicable */

(function (__undefined) {
    /*
     * abstract Class ModGenerator
     */
    this.ModGenerator = Class.extend({
        /**
         * 
         * @returns {ModGenerator}
         */
        init: function (mod_collection, mod_klass) {
            this.uses = Number.POSITIVE_INFINITY;
            
            if (mod_collection[0] instanceof mod_klass) {
                // array<Mod>
                this.available_mods = mod_collection;
            } else {
                // array<Object>
                this.available_mods = $.map(mod_collection, function (mod_props) {
                    return new mod_klass(mod_props);
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
            return this.available_mods;
        },
        mapApplicable: function (mod_container) {
            return $.map(this.getAvailableMods().slice(), function (mod) {
                mod.applicableTo(mod_container);
                return mod;
            });
        },
        applicableMods: function (mod_container) {
            return $.grep(this.getAvailableMods().slice(), function (mod) {
                return mod.applicableTo(mod_container);
            });
        },
        mapRollable: function (mod_container) {
            return $.map(this.getAvailableMods().slice(), function (mod) {
                mod.rollableOn(mod_container);
                return mod;
            });
        },
        /**
         * 
         * @param {ModContainer} mod_container
         * @returns {Array}
         */
        rollableMods: function (mod_container) {
            return $.grep(this.getAvailableMods().slice(), function (mod) {
                return mod.rollableOn(mod_container);
            });
        },
        chooseRollableMod: function (mod_container, rng) {
            if (rng === __undefined) {
                rng = Math.random;
            }
            var n = rng();
            
            var rollable_mods = this.rollableMods(mod_container);
            
            // @TODO spawnweight
            return rollable_mods[Math.floor(n * (rollable_mods.length - 1))];
        }
    });
})();

