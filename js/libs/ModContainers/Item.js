(function (__undefined) {
    var ModContainer = require('./ModContainer');
    var MetaData = require('../MetaData');
    var Mod = require('../mods/Mod');
    var ValueRange = require('../ValueRange');
    var GgpkEntry = require('../GgpkEntry');
    var ItemImplicits = require('./ItemImplicits');
    var ApplicableMod = require('../mods/ApplicableMod');
    
    require('../concerns/String');
    
    if ($ === __undefined) {
        var $ = require('../jquery/jquery_node');
    }
    
    /**
     * 
     * Item Class extends @link ModContainer
     * 
     * represents an ingame item (boots, maps, rings for example)
     * the class only represents the explicits and is a fascade for an 
     * additional implicit container
     */
    var Item = ModContainer.extend({
        /**
         * @constructor
         * @param {Object} props for @link GgpkEntry
         * @returns {Item}
         */
        init: function (props) {
            var that = this;
            if (Item.meta_data === null) {
                console.error("pls init meta data");
                return null;
            }
            
            // explicits
            this._super();
            
            // default
            this.rarity      = Item.RARITY.NORMAL;
            this.item_level  = Item.MAX_ILVL;
            this.random_name = "Random Name";
            this.corrupted   = false;
            this.mirrored    = false;
            
            // parse entry
            this.entry = new GgpkEntry(props);
            
            // get meta data key
            // path.split(/[\\/]/).pop() := basename 
            var clazz = this.entry.getProp("InheritsFrom").split(/[\\/]/).pop();
            
            // meta data exists?
            this.meta_data = MetaData.build(clazz, Item.meta_data);
            
            // implicits
            this.implicits = new ItemImplicits([]);
            $.each(this.entry.valueAsArray("Implicit_ModsKeys"), function (_, mod_key) {
                if (!that.implicits.addMod(new ApplicableMod(Mod.mods[mod_key]))) {
                    console.log("could not add", mod_key);
                }
            });
        },
        /**
         * adds a mod if theres room for it
         * no sophisticated domain check. only if affix type is full or not
         * 
         * @override
         * @param {Mod} mod
         * @returns {Boolean} true on success
         */
        addMod: function (mod) {
            if (!(mod instanceof Mod)) {
                console.error('mod must be instance of `Mod`');
                return false;
            }
            
            if (mod.isPrefix() && this.getPrefixes().length < this.maxPrefixes() || 
                    mod.isSuffix() && this.getSuffixes().length < this.maxSuffixes()
            ) {
                return this._super(mod);
            }
            return false;
        },
        /**
         * @param {Mod} mod
         * @returns {Boolean} true on success
         */
        addImplicits: function (mod) {
            return this.implicits.addMod(mod);
        },
        /**
         * ItemImplicts fascade
         * @returns {ModContainer@call;removeAllMods}
         */
        removeAllImplicits: function () {
            return this.implicits.removeAllMods();
        },
        /**
         * ItemImplicits fascade
         * @param {Mod} mod
         * @returns {ModContainer@call;removeMod}
         */
        removeImplicits: function (mod) {
            return this.implicits.removeMod(mod);
        },
        /**
         * ItemImplicits fascade
         * @param {Number} primary
         * @returns {ModContainer@call;getMod}
         */
        getImplicit: function (primary) {
            return this.implicits.getMod(primary);
        },
        /**
         * ItemImplicits fascade
         * @param {Number} primary
         * @returns {ModContainer@call;inMods}
         */
        inImplicits: function (primary) {
            return this.implicits.inMods(primary);
        },
        /**
         * adds a new tag to the item if its not already presen
         * 
         * @param {int} tag_key
         * @returns {Boolean} true on success
         */
        addTag: function (tag_key) {
            if (this.tags.indexOf(tag_key) === -1) {
                this.tags.push(tag_key);
                return true;
            }
            return false;
        },
        /**
         * removes an existing tag
         * 
         * @param {int} tag_key
         * @returns {Boolean} true on success
         */
        removeTag: function (tag_key) {
            var index = this.tags.indexOf(tag_key);
            if (index !== -1) {
                this.tags = this.tags.splice(index, 1);
                return tag_key;
            }
            return false;
        },
        /**
         * returns tags of item + tags from mods
         * @returns {Array}
         */
        getTags: function () {
            return $.unique(this._super().concat(this.meta_data.props.tags, this.entry.valueAsArray("TagsKeys")));
        },
        /**
         * returns the max possible number of the given generation type
         * 
         * @override
         * @param {Mod} mod
         * @returns {Number} max number or -1 if not possible at all
         */
        maxModsOfType: function (mod) {
            var generation_type = +mod.getProp("GenerationType");
            
            switch (generation_type) {
                case Mod.MOD_TYPE.PREFIX:
                    return this.maxPrefixes();
                case Mod.MOD_TYPE.SUFFIX:
                    return this.maxSuffixes();
                case Mod.MOD_TYPE.VAAL:
                case Mod.MOD_TYPE.ENCHANTMENT:
                case Mod.MOD_TYPE.TALISMAN:
                    return this.implicits.maxModsOfType(mod);
            }
            
            return -1;
        },
        /**
         * maximum number of prefixes
         * 
         * @returns {Number}
         */
        maxPrefixes: function () {
            switch (this.rarity) {
                case Item.RARITY.NORMAL:
                    return 0;
                case Item.RARITY.MAGIC:
                    return 1;
                case Item.RARITY.RARE:
                case Item.RARITY.SHOWCASE:
                    if (this.meta_data.isA("AbstractJewel")) {
                        return 2;
                    }
                    return 3;
                case Item.RARITY.UNIQUE:
                    return Number.POSITIVE_INFINITY;
            }
        },
        /**
         * maximum number of suffixes (=prefixes)
         * 
         * @returns {String}
         */
        maxSuffixes: function () {
            return this.maxPrefixes();
        },
        /**
         * equiv mod domain
         * 
         * @returns {Mod.DOMAIN.*}
         */
        modDomainEquiv: function () {
            if (this.meta_data.isA("AbstractJewel")) {
                return Mod.DOMAIN.JEWEL;
            }
            if (this.meta_data.isA("AbstractFlask")) {
                return Mod.DOMAIN.FLASK;
            }
            if (this.meta_data.isA("AbstractMap")) {
                return Mod.DOMAIN.MAP;
            }
            return Mod.DOMAIN.ITEM;
        },
        /**
         * checks if the domains are equiv
         * 
         * @param {Mod.DOMAIN.*} mod_domain
         * @returns {Boolean} true if in domain
         */
        inDomainOf: function (mod_domain) {
            switch (mod_domain) {
                case Mod.DOMAIN.MASTER:
                    return this.inDomainOf(Mod.DOMAIN.ITEM);
                default:
                    return mod_domain === this.modDomainEquiv();
            }
        },
        getImplicits: function () {
            return this.implicits.asArray();
        },
        getAllMods: function () {
            return this.asArray().concat(this.getImplicits());
        },
        /**
         * name of the base_item
         * @returns {String}
         */
        baseName: function () {
            if (this.rarity === Item.RARITY.MAGIC) {
                return "";
            }
            return this.entry.getProp("Name");
        },
        /**
         * actual item name
         * @returns {String}
         */
        itemName: function () {
            switch (this.rarity) {
                case Item.RARITY.MAGIC:
                    var name = "";
                    // prefix
                    if (this.getPrefixes().length) {
                        name += this.getPrefixes()[0].getProp("Name") + " ";
                    }
                    // + base_name
                    name += this.entry.getProp("Name");
                    // + suffix
                    if (this.getSuffixes().length) {
                        name += " " + this.getSuffixes()[0].getProp("Name");
                    }
                    
                    return name;
                case Item.RARITY.RARE:
                    return this.random_name;
            }
            return '';
        },
        /**
         * primary key
         * @returns {Number}
         */
        primary: function () {
            return +this.entry.getProp("Rows");
        },
        /**
         * requirements to wear this item
         * 
         * @returns {Object} requirement desc => amount
         */
        requirements: function () {
            var requirements = {};
            
            $.each({
                Level: this.requiredLevel(),
                Str: this.entry.getProp("ReqStr"),
                Dex: this.entry.getProp("ReqDex"),
                Int: this.entry.getProp("ReqInt")
            }, function (key, requirement) {
                if (requirement > 0) {
                    requirements[key] = requirement;
                }
            });
            
            return requirements;
        },
        requiredLevel: function () {
            return Math.max.apply(Math, [+this.entry.getProp("DropLevel")].concat($.map(this.getAllMods(), function (mod) {
                return Math.floor(0.8 * +mod.getProp("Level"));
            })));
        },
        /**
         * string identifier of the item_class
         * 
         * @returns {String} key from @link Item.ITEMCLASSES
         */
        itemclassIdent: function () {
            var that = this;
            return $.map(Item.ITEMCLASSES, function (itemclass, ident) {
                if (+itemclass.PRIMARY === +that.entry.getProp("ItemClass")) {
                    return ident;
                }
                return null;
            })[0];
        },
        itemclassName: function () {
            return Item.ITEMCLASSES[this.itemclassIdent()]['Name'];
        },
        /**
         * string identifier of the item rarity
         * 
         * @returns {String} key from @link Item.RARITY
         */
        rarityIdent: function () {
            var that = this;
            return $.map(Item.RARITY, function (rarity, ident) {
                if (rarity === +that.rarity) {
                    return ident.toLowerCase();
                }
                return null;
            })[0];
        },
        /**
         * attempts to upgrade the rarity
         * 
         * @returns {Boolean} true on change in rarity
         */
        upgradeRarity: function () {
            switch (this.rarity) {
                case Item.RARITY.NORMAL:
                case Item.RARITY.SHOWCASE:
                    this.rarity = Item.RARITY.MAGIC;
                    return true;
                case Item.RARITY.MAGIC:
                    this.rarity = Item.RARITY.RARE;
                    return true;
            }
            
            return false;
        },
        /**
         * stats of mods combined
         * 
         * @returns {Object} stat_id => value
         */
        stats: function () {
            var stats = {};
            
            // flatten mods.statsJoined()
            $.each($.map(this.asArray().concat(this.getImplicits()), function (mod) {
                return mod.statsJoined();
            }), function (_, stat) {
                var id = stat.getProp("Id");
                // group by stat.Id
                if (stats[id]) {
                    stats[id].values.add(stat.values);
                } else {
                    stats[id] = stat;
                }
            });
            
            return stats;
        },
        /**
         * stats from the item with stats from mods applied
         * 
         * @returns {Object} desc => valuerange
         */
        localStats: function () {
            var stats = this.stats();
            var local_stats = {};
            
            // TODO quality
            
            if (this.meta_data.isA('AbstractWeapon')) {
                // added flat
                $.each({
                    "physical":  new ValueRange(+this.entry.getProp("DamageMin"),
                                                +this.entry.getProp("DamageMax")),
                    "fire": new ValueRange(0, 0),
                    "cold": new ValueRange(0, 0),
                    "lightning": new ValueRange(0, 0),
                    "chaos": new ValueRange(0, 0)
                }, function (source, damage) {
                    if (stats['local_minimum_added_' + source + '_damage']) {
                        damage.min = stats['local_minimum_added_' + source + '_damage'].values.add(damage.min);
                    }     

                    if (stats['local_maximum_added_' + source + '_damage']) {
                        damage.max = stats['local_maximum_added_' + source + '_damage'].values.add(damage.max);
                    } 

                    // TODO combine ele damage
                    if (!damage.isZero()) {
                        local_stats[source.ucfirst() + ' Damage'] = damage;
                    }
                });
                
                // TODO combine ele
                
                // apply increases
                local_stats['Physical Damage'] = 
                        Item.applyStat(local_stats['Physical Damage'],
                                       stats['local_physical_damage_+%'],
                                       0);
                
                // Crit
                local_stats['Critical Strike Chance'] = 
                        Item.applyStat(+this.entry.getProp('Critical') / 100,
                                       stats['local_critical_strike_chance_+%'],
                                       2).toString() + "%";
                                    
                // APS
                local_stats['Attacks Per Second'] = 
                        Item.applyStat(1000 / +this.entry.getProp("Speed"),
                                       stats['local_attack_speed_+%'],
                                       2);
            } else if (this.meta_data.isA('AbstractArmour')) {
                var that = this;
                // defences
                $.each({
                    // ComponentArmour => stat_name
                    Armour: "physical_damage_reduction",
                    Evasion: "evasion",
                    EnergyShield: "energy_shield"
                }, function (component, stat) {
                    // inital value
                    local_stats[component] = new ValueRange(+that.entry.getProp(component),
                                                            +that.entry.getProp(component));
                    
                    // added flat
                    if (stats['local_base_' + stat + '_rating']) {
                        local_stats[component] = local_stats[component].add(stats['local_base_' + stat + '_rating'].values);
                    }
                    
                    // increase
                    local_stats[component] = 
                            Item.applyStat(local_stats[component],
                                           stats['local_' + stat + '_rating_+%'],
                                           0);
                    
                    if (local_stats[component].isZero()) {
                        delete local_stats[component];
                    }
                });
            }
            
            // TODO color stats
            return local_stats;
        },
        isCorrupted: function () {
            return this.corrupted;
        },
        /**
         * sets corrupted flag
         * logs 
         * @returns {undefined}error if already corrupted
         */
        corrupt: function () {
            if (this.isCorrupted()) {
                console.error("invalid state:", this, "is already corrupted");
            } else {
                this.corrupted = true;
            }
        },
        isMirrored: function () {
            return this.mirrored;
        },
        /**
         * sets mirrored flag
         * logs error if already mirrored
         */
        mirror: function () {
            if (this.isMirrored()) {
                console.error("invalid state:", this, "is already mirrored");
            } else {
                this.mirrored = true;
            }
        }
    });
    
    /**
     * takes a increased stat and applies it to the value
     * 
     * @param {ValueRange|Number} value
     * @param {Stat} stat
     * @param {Number} precision
     * @returns {ValueRange}
     */
    Item.applyStat = function (value, stat, precision) {
        var result = null;
        
        if (stat === __undefined) {
            result = value;
        } else {
            // 100% increased := 2 = (100% / 100) + 1
            var multiplier = stat.values.multiply(1 / 100).add(1);


            if (value instanceof ValueRange) {
                result = value.multiply(multiplier);
            } else {
                result = multiplier.multiply(value);
            }
        }
        
        return result.toFixed(precision);
    };
    
    /**
     * meta data object uninitialized
     */
    Item.meta_data = null;
    
    /**
     * all possible rarities
     */
    Item.RARITY = {
        NORMAL: 1,
        MAGIC: 2,
        RARE: 3,
        UNIQUE: 4,
        SHOWCASE: 5
    };
    
    /**
     * maximum item level
     */
    Item.MAX_ILVL = 100;
    
    Item.ITEMCLASSES = {};
    $.each(require('../../data/itemclasses.json'), function (_, props) {
        if (!props['Name']) {
            return true;
        }
        
        var ident = props['Name'].replace(/ /g, "_").toUpperCase();
        Item.ITEMCLASSES[ident] = {
            PRIMARY: +props['primary'],
            Name: props['Name']
        };
    });
    
    module.exports = Item;
}).call(this);

