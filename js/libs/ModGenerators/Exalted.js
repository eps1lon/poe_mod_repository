/* global Currency, Transmute, Applicable, ByteSet, this, Item */

(function (__undefined) {
    this.Exalted = Currency.extend({
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
        },
        applyTo: function (item) { 
            if (this.applicableTo(item)) {
                item.addMod(this.chooseMod(item));
            }
        },
        applicableTo: function (baseitem, success) {
            this._super(baseitem, success);
            // remove SUCCESS byte
            this.applicable_byte &= ~Applicable.SUCCESS;
            
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            if (baseitem.rarity !== Item.RARITY.RARE) {
                this.applicable_byte |= Exalted.APPLICABLE_BYTE.NOT_RARE;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !!(this.applicable_byte & success);
        },
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, Exalted.APPLICABLE_BYTE, Exalted.APPLICABLE_BYTE.SUCCESS);
        }
    });
    
    this.Exalted.APPLICABLE_BYTE = {
        // Currency
        UNSCANNED: 0,
        SUCCESS: 1,
        NOT_AN_ITEM: 2,
        // extended
        NOT_RARE: 4
    };
})();