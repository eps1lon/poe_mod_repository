/* global Applicable, ByteSet, this */

(function (__undefined) {
    /**
     * Applicable extends Mod impliements Applicable, Serializeable
     */
    this.ApplicableMod = Mod.extend({
        init: function (props) {
            this._super(props);
            
            // Applicable
            this.resetApplicable();
        },
        applicableTo: function (item, success) {
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            // reset
            this.resetApplicable();
            
            if (!item.inDomainOf(+this.getProp("Domain"))) {
                this.applicable_byte |= ApplicableMod.APPLICABLE_BYTE.WRONG_DOMAIN;
            } else if (!item.hasRoomFor(this)) {
                this.applicable_byte |= ApplicableMod.APPLICABLE_BYTE.DOMAIN_FULL;
            }
                       
            if (+this.getProp("Level") > item.item_level) {
                this.applicable_byte |= ApplicableMod.APPLICABLE_BYTE.LOWER_ILVL;
            }
            
            var correct_groups = $.map(item.mods, function (mod) { 
                return mod.getProp("CorrectGroup");
            });
            
            if (correct_groups.indexOf(this.getProp("CorrectGroup")) !== -1) {
                this.applicable_byte |= ApplicableMod.APPLICABLE_BYTE.ALREADY_PRESENT;
            } 
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        applicableCached: function () {
            return !ByteSet.byteBlacklisted(this.applicable_byte, Applicable.SUCCESS);
        },
        resetApplicable: function () {
            this.applicable_byte = Applicable.UNSCANNED;
        },
        applicableByteHuman: function() {
            return ByteSet.human(this.applicable_byte, ApplicableMod.APPLICABLE_BYTE, ApplicableMod.APPLICABLE_BYTE.SUCCESS, "RollableMod.applicable_byte");
        },
        serialize: function () {
            return {
                klass: "ApplicableMod",
                args: [this.props]
            };
        },
        name: function () {
            return this.getProp("Name");
        },
        rollableCached: function () {
            return this.applicableCached();
        }
    });
    
    this.ApplicableMod.APPLICABLE_BYTE = {
        UNSCANNED: 0, // per convention 
        SUCCESS: 1, 
        // Applicable
        DOMAIN_FULL: 2,
        ALREADY_PRESENT: 4,
        WRONG_DOMAIN: 8,
        LOWER_ILVL: 16
    };
})();