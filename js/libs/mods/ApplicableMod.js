/* jshint bitwise:false */

(function (__undefined) {
    var Mod = require('./Mod');
    var Applicable = require('../Applicable');
    var META_MODS = require('./meta_mods');
    
    var ByteSet = require('../ByteSet');
    var $ = require('../jquery/jquery_node');
    
    /**
     * class Applicable extends Mod impliements Applicable, Serializeable
     */
    var ApplicableMod = Mod.extend({
        /**
         * 
         * @param {Object} props for GgpkEntry
         * @returns {undefined}
         */
        init: function (props) {
            this._super(props);
            
            // Applicable
            this.applicable_byte = ApplicableMod.APPLICABLE_BYTE.clone();
            this.resetApplicable();
        },
        /**
         * applicable logic
         * 
         * @param {Item} item
         * @param {byte} success
         * @returns {Boolean} true if applicable
         */
        applicableTo: function (item, success) {            
            // reset
            this.resetApplicable();
            
            if (!item.inDomainOf(+this.getProp("Domain"))) {
                this.applicable_byte.enable('WRONG_DOMAIN');
            } else if (!item.hasRoomFor(this)) {
                this.applicable_byte.enable('DOMAIN_FULL');
            }
                       
            if (+this.getProp("Level") > item.item_level) {
                this.applicable_byte.enable('LOWER_ILVL');
            }
            
            var correct_groups = $.map(item.mods, function (mod) { 
                return mod.getProp("CorrectGroup");
            });
            
            if (correct_groups.indexOf(this.getProp("CorrectGroup")) !== -1) {
                this.applicable_byte.enable('ALREADY_PRESENT');
            } 
            
            if (+this.getProp("Level") > 28 && item.inMods(META_MODS.LLD_MOD) !== -1) {
                this.applicable_byte.enable('ABOVE_LLD_LEVEL');
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success).anySet();
        },
        /**
         * 
         * @returns {!applicable_byte.anySet}
         */
        applicableCached: function () {
            return !this.applicable_byte.anySet();
        },
        /**
         * 
         * @returns {void}
         */
        resetApplicable: function () {
            this.applicable_byte.reset();
        },
        /**
         * 
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function() {
            return ByteSet.human(this.applicable_byte
                                 , "ApplicableMod.applicable_byte");
        },
        /**
         * 
         * @returns {Object} for Serializeable.deserialize
         */
        serialize: function () {
            return {
                klass: "ApplicableMod",
                args: [this.props],
                constructor: ApplicableMod
            };
        },
        name: function () {
            return this.getProp("Name");
        },
        rollableCached: function () {
            return this.applicableCached();
        }
    });
    
    ApplicableMod.APPLICABLE_BYTE = Applicable.BYTESET.clone();
    ApplicableMod.APPLICABLE_BYTE.add('DOMAIN_FULL');
    ApplicableMod.APPLICABLE_BYTE.add('ALREADY_PRESENT');
    ApplicableMod.APPLICABLE_BYTE.add('WRONG_DOMAIN');
    ApplicableMod.APPLICABLE_BYTE.add('LOWER_ILVL');
    ApplicableMod.APPLICABLE_BYTE.add('ABOVE_LLD_LEVEL');
    ApplicableMod.APPLICABLE_BYTE.reset();
    
    module.exports = ApplicableMod;
}).call(this);