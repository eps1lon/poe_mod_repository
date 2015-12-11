/* global Mod, Item, Currency, ByteSet, this, Applicable, Transmute */
/* jshint bitwise: false */

(function (__undefined) {
    /**
     * class Alchemy extends Currency
     * 
     * ingame representation of Orb of Alchemy
     * mod generation most likely not accurate because we just roll 4-6 mods
     * and correlate #prefixs/suffixes to eache other if the ratio >= 3:1
     */
    this.Alchemy = Currency.extend({
        /**
         * @constructor
         * @param {type} all_mods
         * @returns {Alchemy}
         */
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
            this.klass = "Alchemy";
        },
        /**
         * adds 4-6
         * @param {Item} item
         * @returns {Boolean}
         */
        applyTo: function (item) {
            var i;
            var new_mods;
            var prefixes, suffixes;
            
            if (this.applicableTo(item)) {
                // upgrade to rare
                item.rarity = Item.RARITY.RARE;

                for (i = 1, new_mods = Math.rand(4, 6); i <= new_mods; ++i) {
                    item.addMod(this.chooseMod(item));
                }
                
                prefixes = item.getPrefixes().length;
                suffixes = item.getSuffixes().length;
                
                // correct differences between #prefixes, #suffixes >= 2
                for (i = 1, new_mods = Math.max(0, Math.abs(prefixes - suffixes) - 1); i <= new_mods; ++i) {
                    item.addMod(this.chooseMod(item));
                }
                
                return true;
            }
            
            return false;
        },
        /**
         * maps mod::applicableTo as if it were already magic
         * 
         * @param {Item} item
         * @param {byte} success whitelist
         * @returns {Array}
         */
        map: function (item, success) {
            // simulate upgrade
            var old_rarity = item.rarity;
            item.rarity = Item.RARITY.RARE;
            var mods = this._super(item, success);
            item.rarity = old_rarity;

            return mods;
        },
        /**
         * greps mod::applicableTo as if it were already rare
         * @param {type} item
         * @param {type} success
         * @returns {Array}
         */
        mods: function (item, success) {
            // simulate upgrade
            var old_rarity = item.rarity;
            item.rarity = Item.RARITY.RARE;
            var mods = this._super(item, success);
            item.rarity = old_rarity;

            return mods;
        },
        /**
         * 
         * @param {Item} baseitem
         * @param {byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (baseitem, success) {
            this._super(baseitem, success);
            // remove SUCCESS byte
            this.applicable_byte &= ~Applicable.SUCCESS;
            
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            if (baseitem.rarity !== Item.RARITY.NORMAL) {
                this.applicable_byte |= Alchemy.APPLICABLE_BYTE.NOT_WHITE;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        /**
         *
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, 
                                 Alchemy.APPLICABLE_BYTE, 
                                 Alchemy.APPLICABLE_BYTE.SUCCESS, 
                                 "Alchemy.applicable_byte");
        }
    });
    
    this.Alchemy.APPLICABLE_BYTE = {
        // Currency
        UNSCANNED: 0,
        SUCCESS: 1,
        NOT_AN_ITEM: 2,
        // extended
        NOT_WHITE: 4
    };
})();