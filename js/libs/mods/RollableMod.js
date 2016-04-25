/* jshint bitwise:false */

(function (__undefined) {
    var ApplicableMod = require('./ApplicableMod');
    var Spawnable = require('../Spawnable');
    
    var $ = require('../jquery/jquery_node');
    var ByteSet = require('../ByteSet');
    
    /**
     * class RollableMod extends ApplicableMod impliements Spawnable
     */
    var RollableMod = ApplicableMod.extend({
        /**
         * 
         * @param {Object} props for GgpkEntry
         * @returns {undefined}
         */
        init: function (props) {
            this._super(props);
            
            // Spawnable
            this.spawnable_byte = RollableMod.SPAWNABLE_BYTE.clone();
            this.resetSpawnable();
            
            this.rollable = null;
        },
        /**
         * 
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function() {
            return this.applicable_byte.human("RollableMod.applicable_byte");
        },
        /**
         * checks if spawnable and sets the spawnweight
         * 
         * @param {ModContainer} mod_container
         * @param {byte} success whitelist
         * @returns {Boolean}
         */
        spawnableOn: function (mod_container, success) {
            var spawnweight_tags = $(this.valueAsArray("SpawnWeight_TagsKeys")).filter(mod_container.getTags()).toArray();
            // reset
            this.resetSpawnable();
            
            if (spawnweight_tags.length === 0) {
                this.spawnable_byte.enable('NO_MATCHING_TAGS');
                return false;
            }

            // first spawnweight_tag to  match any item_tag gets to choose
            // the spawnweight
            this.spawnweight = this.valueAsArray("SpawnWeight_Values")[this.valueAsArray("SpawnWeight_TagsKeys").indexOf(spawnweight_tags[0])];
            
            if (this.spawnweight <= 0) {
                this.spawnweight = 0;
                this.spawnable_byte.enable('SPAWNWEIGHT_ZERO');
            }
            
            return !ByteSet.byteBlacklisted(this.spawnable_byte, success).anySet();
        },
        /**
         * spawnchance in [%]
         * @param {Number} precision
         * @returns {String}
         */
        humanSpawnchance: function (precision) {
            if (precision === __undefined) {
                precision = 2;
            }
            
            var spawnchance = 0.0;

            // spawnchance is basically zero if its not applicable
            if (this.spawnchance !== null && this.applicableCached()) {
                spawnchance = this.spawnchance;
            }

            return (spawnchance * 100).toFixed(precision) + "%";
        },
        resetSpawnable: function () {
            this.spawnweight = 0;
            this.spawnchance = null;
            this.spawnable_byte.reset();
        },
        spawnableByteHuman: function() {
            return this.spawnable_byte.human("RollableMod.spawnable_byte");
        },
        spawnableCached: function () {
            return !this.spawnable_byte.anySet();
        },
        rollableOn: function (mod_container) {
            this.rollable = this.applicableTo(mod_container) && 
                            this.spawnableOn(mod_container) ;
            
            return this.rollable;
        },
        /**
         * 
         * @returns {Object} for Serializeable.deserialize
         */
        serialize: function () {
            return {
                klass: "RollableMod",
                args: [this.props],
                constructor: RollableMod
            };
        },
        rollableCached: function () {
            return this.spawnableCached() && this.applicableCached();
        }
    });
    
    RollableMod.SPAWNABLE_BYTE = Spawnable.BYTESET.clone();
    RollableMod.SPAWNABLE_BYTE.add('NO_MATCHING_TAGS');
    RollableMod.SPAWNABLE_BYTE.add('SPAWNWEIGHT_ZERO');
    RollableMod.SPAWNABLE_BYTE.reset();
    
    RollableMod.APPLICABLE_BYTE = ApplicableMod.APPLICABLE_BYTE.clone();
    RollableMod.APPLICABLE_BYTE.reset();

    module.exports = RollableMod;
}).call(this);