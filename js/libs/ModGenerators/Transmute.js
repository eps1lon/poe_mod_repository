/* global Mod, ModGenerator, Item, Currency, ByteSet, this, Applicable */

(function (__undefined) {
    this.Transmute = Currency.extend({
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
        },
        applyTo: function (item) {
            if (this.applicableTo(item)) {
                var mod = this.chooseMod(item);
                
                // TODO 2 mods
                
                // upgrade to rare
                item.rarity = Item.RARITY.MAGIC;
                
                item.addMod(mod);
            }
        },
        map: function (item, success) {
            if (this.applicableTo(item)) {
                // simulate upgrade
                item.rarity = Item.RARITY.MAGIC;
                var mods = this._super(item, success);
                item.rarity = Item.RARITY.NORMAL;
                
                return mods;
            }
            
            return [];
        },
        mods: function (item, success) {
            if (this.applicableTo(item)) {
                // simulate upgrade
                item.rarity = Item.RARITY.MAGIC;
                var mods = this._super(item, success);
                item.rarity = Item.RARITY.NORMAL;
                
                return mods;
            }
            
            return [];
        },
        /**
         * 
         * @param {ModContainer} mod_container
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
                this.applicable_byte |= Transmute.APPLICABLE_BYTE.NOT_WHITE;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !!(this.applicable_byte & success);
        },
        /**
         *
         * @returns {String}
         */
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, Transmute.APPLICABLE_BYTE, Transmute.APPLICABLE_BYTE.SUCCESS);
        }
    });
    
    this.Transmute.APPLICABLE_BYTE = {
        // Currency
        UNSCANNED: 0,
        SUCCESS: 1,
        NOT_AN_ITEM: 2,
        // extended
        NOT_WHITE: 4
    };
    
    this.Transmute.mod_filter = function (mod_props) {
        // prefix/suffix only
        return [Mod.MOD_TYPE.PREFIX, Mod.MOD_TYPE.SUFFIX].indexOf(+mod_props["GenerationType"]) !== -1;
    };
})();