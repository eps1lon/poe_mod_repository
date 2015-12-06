/* global RollableMod, Mod, ModGenerator, ByteSet, this, Item, Applicable, Currency */
/* jshint bitwise:false */

(function (__undefined) {
    /**
     * abstract class Currency extends ModGenerator
     * 
     * abstract representation of ingame currency which only accepts
     * prefixes, suffixes and implicits
     */
    this.Currency = ModGenerator.extend({
        /**
         * 
         * @param {Array} all_mods
         * @param {Function} and_filter additional filter function for $.map
         * @returns {ModGenerator}
         */
        init: function (all_mods, and_filter) {
            if (and_filter === __undefined) {
                // dummy filter
                and_filter = function () { return true; };
            }
            
            this._super(all_mods, RollableMod, function (mod) {
                return [Mod.MOD_TYPE.PREFIX, Mod.MOD_TYPE.SUFFIX, Mod.MOD_TYPE.IMPLICIT].indexOf(+mod.GenerationType) !== -1 && 
                        mod.SpawnWeight_TagsKeys !== "" && 
                        and_filter(mod);
            });
        },
        /**
         * @abstract
         * @param {ModContainer} mod_container
         * @returns {Boolean}
         */
        applyTo: function (mod_container) {
            return false;
        },
        /**
         * maps Mod::applicableTo and Mod::spawnableOn to all available mods
         * 
         * @param {Item} item
         * @param {byte} success whitelist
         * @returns {Array}
         */
        map: function (item, success) {
            return $.map(this.getAvailableMods(), function (mod) {
                mod.applicableTo(item, success);
                mod.spawnableOn(item);
                
                return mod;
            });
        },
        /**
         * greps Mod::applicableTo and Mod::spawnableOn to all available mods
         * @param {Item} item
         * @param {byte} success
         * @returns {Array}
         */
        mods: function (item, success) {
            return $.grep(this.getAvailableMods(), function (mod) {
                return mod.applicableTo(item, success) && 
                        mod.spawnableOn(item);
            });
        },
        /**
         * currency only applies to items
         * 
         * @param {ModContainer} mod_container
         * @param {byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (mod_container, success) {
            this.resetApplicable();
            
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            if (!(mod_container instanceof Item)) {
                this.applicable_byte |= Currency.APPLICABLE_BYTE.NOT_AN_ITEM;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        /**
         * sets the class back to unscanned
         * @returns {void}
         */
        resetApplicable: function () {
            this.applicable_byte = Applicable.UNSCANNED;
        },
        /**
         *
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, Currency.APPLICABLE_BYTE, Currency.APPLICABLE_BYTE.SUCCESS);
        },
        /**
         *
         * @returns {ByteSet.human}
         */
        applicableCached: function () {
            return !ByteSet.byteBlacklisted(this.applicable_byte, Applicable.SUCCESS);
        }
    });
    
    this.Currency.APPLICABLE_BYTE = {
        // Convention of Applicable
        UNSCANNED: 0,
        SUCCESS: 1,
        // Currency
        NOT_AN_ITEM: 2
    };
})();