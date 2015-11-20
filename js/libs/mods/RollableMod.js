/* global Mod, this, Rollable, Spawnable, Applicable */

(function (__undefined) {
    /**
     * RollableMod extends Mod impliements Rollable, Serializeable
     */
    this.RollableMod = Mod.extend({
        init: function (props) {
            this._super(props);
            
            // Spawnable
            this.resetSpawnable();
            
            // Applicable
            this.resetApplicable();
            
            // Rollable
            this.rollable_byte = 0;
        },
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
                this.spawnable_byte = RollableMod.ROLLABLE_BYTE.NO_MATCHING_TAGS;
                return false;
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
            return !!(this.spawnable_byte & success);
        },
        humanSpawnchance: function (precision) {
            if (precision === __undefined) {
                precision = 2;
            }
            
            if (this.spawnchance === null) {
                return 'null';
            }
            return "0.0%";
            return (this.spawnchance * 100).toPrecision(4) + "%";
        },
        resetSpawnable: function () {
            this.spawnweight = 0;
            this.spawnchance = null;
            this.spawnable_byte = Spawnable.UNSCANNED;
        },
        applicableTo: function (baseitem, success) {
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            // reset
            this.resetApplicable();
            
            var max_mods_in_domain_of = this.maxModsInDomainOf(baseitem);
            if (this.getProp("Domain") != baseitem.domain || max_mods_in_domain_of === -1) {
                this.applicable_byte |= RollableMod.ROLLABLE_BYTE.WRONG_DOMAIN;
            }

            if (baseitem.numberOfModsOfType(+this.getProp("GenerationType")) >= max_mods_in_domain_of) {
                this.applicable_byte |= RollableMod.ROLLABLE_BYTE.DOMAIN_FULL;
            }
            
            if (+this.getProp("Level") > baseitem.item_level) {
                this.applicable_byte |= RollableMod.ROLLABLE_BYTE.LOWER_ILVL;
            }
            
            var correct_groups = $.map(baseitem.mods, function (mod) { 
                return mod.getProp("CorrectGroup");
            });
            
            if (correct_groups.indexOf(this.getProp("CorrectGroup")) !== -1) {
                this.applicable_byte |= RollableMod.ROLLABLE_BYTE.ALREADY_PRESENT;
            } 
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            // to bool
            return !!(this.applicable_byte & success);
        },
        resetApplicable: function () {
            this.applicable_byte = Applicable.UNSCANNED;
        },
        rollableOn: function (mod_container, success) {
            if (success === __undefined) {
                success = Rollable.SUCCESS;
            } else {
                success |= Rollable.SUCCESS;
            }
            
            this.applicableTo(mod_container);
            this.spawnableOn(mod_container);
            
            this.rollable_byte = this.spawnable_byte | this.applicable_byte;
            
            if (!this.rollable_byte) {
                this.rollable_byte = Rollable.SUCCESS;
            }
            
            return !!(this.rollable_byte & success);
        },
        serialize: function () {
            return {
                klass: "RollableMod",
                args: [this.props]
            };
        }
    });
    
    this.RollableMod.SPAWNABLE_BYTE = {
        UNSCANNED: 0, // per convention 
        SUCCESS: 1,
        NO_MATCHING_TAGS: 64,
        SPAWNWEIGHT_ZERO: 128
    };
    
    this.RollableMod.APPLICABLE_BYTE = {
        UNSCANNED: 0, // per convention 
        SUCCESS: 1, 
        // Applicable
        DOMAIN_FULL: 2,
        NO_MATCHING_RARITY: 4,
        NO_MATCHING_ITEMCLASS: 8,
        ALREADY_PRESENT: 16,
        WRONG_DOMAIN: 32,
        LOWER_ILVL: 256
    };
    
    this.RollableMod.ROLLABLE_BYTE = $.extend({}, this.RollableMod.APPLICABLE_BYTE, this.RollableMod.SPAWNABLE_BYTE);
})();