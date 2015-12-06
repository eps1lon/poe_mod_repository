/* global this, Spawnable, ByteSet, ApplicableMod, RollableMod */
/* jshint bitwise:false */

(function (__undefined) {
    /**
     * class RollableMod extends ApplicableMod impliements Spawnable
     */
    this.RollableMod = ApplicableMod.extend({
        /**
         * 
         * @param {Object} props for GgpkEntry
         * @returns {undefined}
         */
        init: function (props) {
            this._super(props);
            
            // Spawnable
            this.resetSpawnable();
            
            this.rollable = RollableMod.UNSCANNED;
        },
        /**
         * 
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function() {
            return ByteSet.human(this.applicable_byte, RollableMod.APPLICABLE_BYTE, RollableMod.APPLICABLE_BYTE.SUCCESS, "RollableMod.applicable_byte");
        },
        /**
         * checks if spawnable and sets the spawnweight
         * 
         * @param {ModContainer} mod_container
         * @param {byte} success whitelist
         * @returns {Boolean}
         */
        spawnableOn: function (mod_container, success) {
            if (success === __undefined) {
                success = Spawnable.SUCCESS;
            } else {
                success |= Spawnable.SUCCESS;
            }
            
            var spawnweight_tags = $(this.valueAsArray("SpawnWeight_TagsKeys")).filter(mod_container.getTags()).toArray();
            // reset
            this.resetSpawnable();
            
            if (spawnweight_tags.length === 0) {
                this.spawnable_byte = RollableMod.SPAWNABLE_BYTE.NO_MATCHING_TAGS;
                return false;
            }

            // first spawnweight_tag to  match any item_tag gets to choose
            // the spawnweight
            this.spawnweight = this.valueAsArray("SpawnWeight_Values")[this.valueAsArray("SpawnWeight_TagsKeys").indexOf(spawnweight_tags[0])];
            
            if (this.spawnweight <= 0) {
                this.spawnweight = 0;
                this.spawnable_byte |= RollableMod.SPAWNABLE_BYTE.SPAWNWEIGHT_ZERO;
            }
            
            if (!this.spawnable_byte) {
                this.spawnable_byte = Spawnable.SUCCESS;         
            }
            
            return !ByteSet.byteBlacklisted(this.spawnable_byte, success);
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
            
            if (this.spawnchance === null) {
                return 'null';
            }
            
            var spawnchance = 0.0;
            
            // spawnchance is basically zero if its not applicable
            if (this.applicableCached()) {
                spawnchance = this.spawnchance;
            }

            return (spawnchance * 100).toFixed(precision) + "%";
        },
        resetSpawnable: function () {
            this.spawnweight = 0;
            this.spawnchance = null;
            this.spawnable_byte = Spawnable.UNSCANNED;
        },
        spawnableByteHuman: function() {
            return ByteSet.human(this.spawnable_byte, RollableMod.SPAWNABLE_BYTE, RollableMod.SPAWNABLE_BYTE.SUCCESS, "RollableMod.spawnable_byte");
        },
        spawnableCached: function () {
            return !ByteSet.byteBlacklisted(this.spawnable_byte, Spawnable.SUCCESS);
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
                args: [this.props]
            };
        },
        rollableCached: function () {
            return this.spawnableCached() && this.applicableCached();
        }
    });
    
    this.RollableMod.SPAWNABLE_BYTE = {
        UNSCANNED: 0, // per convention 
        SUCCESS: 1,
        NO_MATCHING_TAGS: 2,
        SPAWNWEIGHT_ZERO: 4
    };
    
    this.RollableMod.APPLICABLE_BYTE = ApplicableMod.APPLICABLE_BYTE;
    
    this.RollableMod.UNSCANNED = 0;
    this.RollableMod.SUCCESS = true;
})();