/* jshint bitwise:false */

(function (__undefined) {
    var ApplicableMod = require('./ApplicableMod');
    var Applicable = require('../Applicable');
    var GgpkEntry = require('../GgpkEntry');
    
    var ByteSet = require('../concerns/ByteSet');
    var $ = require('../jquery/jquery_node');
    
    /**
     * class MasterMod extends ApplicableMod
     * 
     * mod from a masterbench
     */
    var MasterMod = ApplicableMod.extend({
        init: function (mod_props, bench_props) {
            this._super(mod_props);

            this.bench = new GgpkEntry(bench_props);
        },
        /**
         * modname with basic stats
         * @returns {String}
         */
        name: function () {
            return this.getProp("Name") + 
                    "(" + this.bench.getProp("MasterNameShort") + " Level: " + this.bench.getProp("MasterLevel") + ")";
        },
        /**
         * applicable logic
         * 
         * @param {Item} item
         * @param {byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (item, success) {
            var base_item_classes;
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            this._super(item, success);
            
            base_item_classes = this.bench.valueAsArray("BaseItemClassesKeys");
            if (base_item_classes.length > 0 && base_item_classes.indexOf(+item.entry.getProp("ItemClass")) === -1) {
                this.applicable_byte |= MasterMod.APPLICABLE_BYTE.WRONG_ITEMCLASS;
            }
            
            // grep MasterMods and set failure if we cant multimod
            if ($.grep(item.mods, function (mod) {
                return mod instanceof MasterMod;
            }).length > 0 && item.inMods(MasterMod.METAMOD.MULTIMOD) === -1) {
                this.applicable_byte |= MasterMod.APPLICABLE_BYTE.NO_MULTIMOD;
            }
            
            // remove SUCCESS Bit from super if additional failure bits set
            if ((this.applicable_byte & Applicable.SUCCESS) &&  this.applicable_byte > Applicable.SUCCESS) {
                this.applicable_byte ^= Applicable.SUCCESS;
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        serialize: function () {
            return {
                klass: "MasterMod",
                args: [this.props, this.bench.props],
                constructor: MasterMod
            };
        },
        applicableByteHuman: function() {
            return ByteSet.human(this.applicable_byte, MasterMod.APPLICABLE_BYTE, MasterMod.APPLICABLE_BYTE.SUCCESS, "MasterMod.applicable_byte");
        }
    });
    
    MasterMod.APPLICABLE_BYTE = {
        // ApplicableMod
        UNSCANNED: 0, // per convention 
        SUCCESS: 1, 
        DOMAIN_FULL: 2,
        ALREADY_PRESENT: 4,
        WRONG_DOMAIN: 8,
        LOWER_ILVL: 16,
        ABOVE_LLD_LEVEL: 32,
        // MasterMod
        WRONG_ITEMCLASS: 64,
        NO_MULTIMOD: 128
    };
    
    MasterMod.METAMOD = require('./meta_mods');
    
    // table `craftingbenchoptions`
    MasterMod.craftingbenchoptions = null;
    
    module.exports = MasterMod;
}).call(this);