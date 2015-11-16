/* global Mod, this, Rollable, Spawnable */

(function (__undefined) {
    /**
     * RollableMod extends Mod impliements Rollable
     */
    this.RollableMod = Mod.extend({
        init: function (props) {
            this._super(props);
            
            // Spawnable
            this.spawnweight = 0;
            this.spawnchance = null;
            this.spawnable_byte = 0;
            
            // Applicable
            this.applicable_byte = 0;
            
            // Rollable
            this.rollable_byte = 0;
        },
        spawnableOn: function (mod_container) {
            var spawnweight_tags = $(this.valueAsArray("SpawnWeight_TagsKeys")).filter(mod_container.getTags()).toArray();
            
            if (spawnweight_tags.length === 0) {
                this.spawnable_byte = RollableMod.ROLLABLE_BYTE.NO_MATCHING_TAGS;
                return 0;
            }

            // first spawnweight_tag to  match any item_tag gets to choose
            // the spawnweight
            this.spawnweight = this.valueAsArray("SpawnWeight_Values")[this.valueAsArray("SpawnWeight_TagsKeys").indexOf(spawnweight_tags[0])];
            
            if (this.spawnweight <= 0) {
                this.spawnweight = 0;
                this.spawnable_byte |= RollableMod.ROLLABLE_BYTE.SPAWNWEIGHT_ZERO;
            }
            
            if (!this.spawnable_byte) {
                this.spawnable_byte = Spawnable.SUCCESS;         
            }
            
            // to bool
            return !!(this.spawnable_byte & Spawnable.SUCCESS);
        },
        applicableTo: function (mod_container) {
            var open_prefix = mod_container.prefixes().length < mod_container.maxPrefixes();
            var open_suffix = mod_container.suffixes().length < mod_container.maxSuffixes();
            
            if (mod_container.domain !== __undefined && this.getProp("Domain") != mod_container.domain) {
                this.applicable_byte |= RollableMod.ROLLABLE_BYTE.WRONG_DOMAIN;
            }

            if (this.isPrefix() && !open_prefix || this.isSuffix() && !open_suffix) {
                this.applicable_byte |= RollableMod.ROLLABLE_BYTE.AFFIX_FULL;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            // to bool
            return !!(this.applicable_byte & Applicable.SUCCESS);
        },
        rollableOn: function (mod_container) {
            this.applicableTo(mod_container);
            this.spawnableOn(mod_container);
            
            this.rollable_byte = this.spawnable_byte | this.applicable_byte;
            
            if (!this.rollable_byte) {
                this.rollable_byte = Rollable.SUCCESS;
            }
            
            return !!(this.rollable_byte & Rollable.SUCCESS);
        }
    });
    
    this.RollableMod.SPAWNABLE_BYTE = {
        UNSCANNED: 0, // per convention 
        NO_FAILURE: 1,
        NO_MATCHING_TAGS: 64,
        SPAWNWEIGHT_ZERO: 128
    };
    
    this.RollableMod.APPLICABLE_BYTE = {
        UNSCANNED: 0, // per convention 
        NO_FAILURE: 1, 
        // Applicable
        AFFIX_FULL: 2,
        NO_MATCHING_RARITY: 4,
        NO_MATCHING_ITEMCLASS: 8,
        ALREADY_PRESENT: 16,
        WRONG_DOMAIN: 32
    };
    
    this.RollableMod.ROLLABLE_BYTE = $.extend({}, this.RollableMod.APPLICABLE_BYTE, this.RollableMod.SPAWNABLE_BYTE);
})();