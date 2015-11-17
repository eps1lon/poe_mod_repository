/* global this, ItemClass, GgpkEntry */

(function (__undefined) {
    /**
     * extends GgpkEntry implements Localizeable
     */
    this.Mod = GgpkEntry.extend({
        init: function (props) {
            this._super(props);
        },
        isPrefix: function () {
            return +this.getProp("GenerationType") === Mod.MOD_TYPE.PREFIX;
        },
        isSuffix: function () {
            return +this.getProp("GenerationType") === Mod.MOD_TYPE.SUFFIX;
        },
        isImplicit: function () {
            return +this.getProp("GenerationType") === Mod.MOD_TYPE.IMPLICIT;
        },
        isAffix: function () {
            return this.isPrefix() || this.isSuffix();
        },
        statsJoined: function () {
            var that = this;
            return $.map(this.valueAsArray("Stats"), function (row, i) {
                if (row.toString().toLowerCase() === 'null') {
                    // continue
                    return null;
                }
                
                var stat = new Stat(Mod.all_stats[row]);
                stat.values = [
                    +that.getProp("Stat" + (i + 1) + "Min"),
                    +that.getProp("Stat" + (i + 1) + "Max")
                ];
                
                return stat;
            });
        },
        maxModsInDomainOf: function (item_class) {
            if (!(item_class instanceof ItemClass)) {
                console.log(item_class, "not instanceof ItemClass");
                return -1;
            }
            
            // domain
            var domain_rule = Mod.DOMAIN_RULES[item_class.domain];
            
            switch (typeof domain_rule) {
                case "number": // single rule for hole domain
                    return domain_rule;
                case "object":
                    // GenerationType
                    domain_rule = domain_rule[this.getProp("GenerationType")];
                    switch (typeof domain_rule) {
                        case "number": // single rule for hole GenerationType
                            return domain_rule;
                        case "object":
                            // Rarity
                            domain_rule = domain_rule[item_class.rarity];
                            if (domain_rule !== __undefined) {
                                return domain_rule;
                            }
                    }
            }
            
            return -1;
        },
        t: function () {
            var stats = this.statsJoined();
            return $.map(stats, function (stat) {
                return stat.t(stats, Mod.localization);
            }).join("\n");
        }
    });
    
    this.Mod.MOD_TYPE = {
        PREFIX: 1,
        SUFFIX: 2,
        UNIQUE: 3,
        NEMESIS: 4,
        IMPLICIT: 5,
        BLOODLINES: 6,
        TORMENT: 7,
        TEMPEST: 8
    };
    
    this.Mod.DOMAIN = {
        ITEM: 1,
        FLASK: 2,
        MONSTER: 3,
        STRONGBOX: 4,
        MAP: 5,
        STANCE: 9,
        MASTER: 10,
        JEWEL: 11
    };
    
    /*
    this.Mod.DOMAIN_RULES = {};
    this.Mod.DOMAIN_RULES[this.Mod.DOMAIN.ITEM] = {};
    this.Mod.DOMAIN_RULES[this.Mod.DOMAIN.ITEM][this.Mod.MOD_TYPE.PREFIX] = {};
    this.Mod.DOMAIN_RULES[this.Mod.DOMAIN.ITEM][this.Mod.MOD_TYPE.PREFIX][ItemClass.RARITY.MAGIC] = 1;
    this.Mod.DOMAIN_RULES[this.Mod.DOMAIN.ITEM][this.Mod.MOD_TYPE.PREFIX][ItemClass.RARITY.RARE] = 3;
    this.Mod.DOMAIN_RULES[this.Mod.DOMAIN.ITEM][this.Mod.MOD_TYPE.PREFIX][ItemClass.RARITY.SHOWCASE] = 3;
    this.Mod.DOMAIN_RULES[this.Mod.DOMAIN.ITEM][this.Mod.MOD_TYPE.PREFIX][ItemClass.RARITY.UNIQUE] = inf;//*/
            
    // never use ModType => null because typeof null === typeof {}
    // resolved const to make it more clear
    this.Mod.DOMAIN_RULES = {
        1: { // Item
            1: { // Prefix
                1: 0, // normal
                2: 1, // magic
                3: 3, // rare
                5: 3 // showcase
            },
            2: { // Suffix = Prefix
                1: 0, // normal
                2: 1, // magic
                3: 3, // rare
                5: 3 // showcase
            },
            5: 1 // Implicit
        },
        5: { // Map
            1: { // Prefix
                1: 0, // normal
                2: 1, // magic
                3: 3, // rare
                5: 3 // showcase
            },
            2: { // Suffix = Prefix
                1: 0, // normal
                2: 1, // magic
                3: 3, // rare
                5: 3 // showcase
            },
            5: 0 // Implicit
        },
        10: 1, // Master
        11: { // Jewel
            1: { // Prefix
                1: 0, // normal
                2: 1, // magic
                3: 2, // rare
                5: 2 // showcase
            },
            2: { // Suffix = Prefix
                1: 0, // normal
                2: 1, // magic
                3: 2, // rare
                5: 2 // showcase
            },
            5: 1 // Implicit
        }
    };
    
    this.Mod.localization = null;
    this.Mod.all_stats = null;
})();

