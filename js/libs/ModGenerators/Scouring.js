/* jshint bitwise:false */

(function (__undefined) {
    var Currency = require('./Currency');
    var Item = require('../ModContainers/Item');
    var MasterMod = require('../mods/MasterMod');
    var $ = require('../jquery/jquery_node');
    var ByteSet = require('../ByteSet');
    
    /**
     * class Scouring extends @link Currency
     */
    var Scouring = Currency.extend({
        /**
         * no mods need for Scouring. it does the exact opposite of generating mods
         * 
         * @constructor
         * @returns {Scouring}
         */
        init: function () {
            this._super([]);
            this.klass = "Scouring";
            
            // Applicable
            this.applicable_byte = Scouring.APPLICABLE_BYTE.clone();
            this.resetApplicable();
        },
        /**
         * applies Orb of Scouring to an item
         * considers locked affixes metamods
         * 
         * @param {Item} item
         * @returns {Boolean} true on success
         */
        applyTo: function (item) { 
            var locked_prefixes, locked_suffixes;
            var remaining_prefixes, remaining_suffixes;
            
            if (this.applicableTo(item)) {
                locked_prefixes = item.inMods(MasterMod.METAMOD.LOCKED_PREFIXES) !== -1;
                locked_suffixes = item.inMods(MasterMod.METAMOD.LOCKED_SUFFIXES) !== -1;
                
                $.each(item.getAffixes(), function (_, mod) {
                     if (mod.isPrefix() && !locked_prefixes) {
                         item.removeMod(mod);
                     } else if (mod.isSuffix() && !locked_suffixes) {
                         item.removeMod(mod);
                     }
                });
                
                // set correct rarity
                remaining_prefixes = item.getPrefixes().length;
                remaining_suffixes = item.getSuffixes().length;
                
                if (remaining_prefixes === 0 && remaining_suffixes === 0) {
                    item.rarity = Item.RARITY.NORMAL;
                } else if (remaining_prefixes > 1 || remaining_suffixes > 1) {
                    item.rarity = Item.RARITY.RARE;
                } else {
                    item.rarity = Item.RARITY.MAGIC;
                }

                return true;
            }
            return false;
        },
        /**
         * checks if normal or unique rarity and returns false
         * 
         * @param {Item} baseitem
         * @param {type} success whitelisted @link Scouring.APPLICABLE_BYTE that is considered a success
         * @returns {Boolean} true on success
         */
        applicableTo: function (baseitem, success) {
            this._super(baseitem, success);
            
            switch (baseitem.rarity) {
                case Item.RARITY.NORMAL:
                    this.applicable_byte.enable('ALREADY_WHITE');
                    break;
                case Item.RARITY.UNIQUE:
                    this.applicable_byte.enable('UNIQUE');
                    break;
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success).anySet();
        },
        /**
         * 
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte
                                 , "Scouring.applicable_byte");
        },
        name: function () {
            return "Orb of Scouring";
        }
    });
    
    /**
     * failure bits
     */
    Scouring.APPLICABLE_BYTE = Currency.APPLICABLE_BYTE.clone();
    Scouring.APPLICABLE_BYTE.add('ALREADY_WHITE');
    Scouring.APPLICABLE_BYTE.add('UNIQUE');
    Scouring.APPLICABLE_BYTE.reset();
    
    module.exports = Scouring;
}).call(this);