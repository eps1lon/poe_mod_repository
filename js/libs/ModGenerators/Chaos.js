/* jshint bitwise:false */

(function (__undefined) {
    var Currency = require('./Currency');
    var Transmute = require('./Transmute');
    var Alchemy = require('./Alchemy');
    var Scouring = require('./Scouring');
    var Exalted = require('./Exalted');
    var Item = require('../ModContainers/Item');
    
    var ByteSet = require('../ByteSet');
    /**
     * class Chaos extends Currency
     * 
     * represantation of Chaos Orb
     */
    var Chaos = Currency.extend({
        /**
         * @constructor
         * @param {Array} all_mods
         * @returns {Chaos}
         */
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
            this.klass = "Chaos";
            
            // Applicable
            this.applicable_byte = Chaos.APPLICABLE_BYTE.clone();
            this.resetApplicable();
        },
        /**
         * adds one random property
         * 
         * @param {Item} item
         * @returns {Boolean} @link Item::addMod
         */
        applyTo: function (item) { 
            if (this.applicableTo(item)) {
                // TODO actually considers *_cannot_be_changed?
                // granted via scouring but is this true for ingame alts?
                new Scouring().applyTo(item);
                // no complete scour?
                if (!(new Alchemy(this.available_mods).applyTo(item))) {
                    // TODO correlate count
                    new Exalted(this.available_mods).applyTo(item);
                }
                
                return true;
            }
            
            return false;
        },
        /**
         * item needs to be rare
         * 
         * @param {Item} baseitem
         * @param {Byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (baseitem, success) {
            this._super(baseitem, success);
            
            if (baseitem.rarity !== Item.RARITY.RARE) {
                this.applicable_byte.enable('NOT_RARE');
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success).anySet();
        },
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte
                                 , "Chaos.applicable_byte");
        },
        name: function () {
            return "Chaos Orb";
        }
    });
    
    Chaos.APPLICABLE_BYTE = Currency.APPLICABLE_BYTE.clone();
    Chaos.APPLICABLE_BYTE.add('NOT_RARE');
    Chaos.APPLICABLE_BYTE.reset();
    
    module.exports = Chaos;
}).call(this);