/* jshint bitwise:false */

(function (__undefined) {
    var ModGenerator = require('./ModGenerator');
    var Applicable = require('../Applicable');
    var RollableMod = require('../mods/RollableMod');
    var Item = require('../ModContainers/Item');
    
    var $ = require('../jquery/jquery_node');
    var ByteSet = require('../ByteSet');
    
    /**
     * abstract class Currency extends ModGenerator
     * 
     * abstract representation of ingame currency which only accepts
     * prefixes, suffixes and implicits
     */
    var Currency = ModGenerator.extend({
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
                return mod.SpawnWeight_TagsKeys !== "" && 
                        and_filter(mod);
            });
            
            // Applicable
            this.applicable_byte = Currency.APPLICABLE_BYTE.clone();
            this.resetApplicable();
        },
        /**
         * @abstract
         * @param {ModContainer} mod_container
         * @returns {Boolean}
         */
        applyTo: function (mod_container) {
            console.error("didnt override abstract function applyTo(mod_container)");
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
         * @param {Item} item
         * @param {byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (item, success) {
            this.resetApplicable();
            
            if (!(item instanceof Item)) {
                this.applicable_byte.enable('NOT_AN_ITEM');
            }
            
            if (item.isCorrupted()) {
                this.applicable_byte.enable('CORRUPTED');
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success).anySet();
        },
        /**
         *
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte
                                 , "Currency.applicable_byte");
        },
        /**
         *
         * @returns {ByteSet.human}
         */
        applicableCached: function () {
            return !this.applicable_byte.anySet();
        },
        name: function () {
            return "AbstractCurrency";
        }
    });
    
    Currency.APPLICABLE_BYTE = Applicable.BYTESET.clone();
    Currency.APPLICABLE_BYTE.add("NOT_AN_ITEM");
    Currency.APPLICABLE_BYTE.add("CORRUPTED");
    Currency.APPLICABLE_BYTE.add("MIRRORED"); 
    
    module.exports = Currency;
}).call(this);