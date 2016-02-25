(function (__undefined) {
    'use strict';
    
    var Class = require("../Inheritance");
    var Mod = require("../mods/Mod");
    
    if ($ === __undefined) {
        var $ = require('../jquery/jquery_node');
    }
    
    /*
     * ModContainer class
     * 
     * Container for @link Mod
     */
    var ModContainer = Class.extend({
        /**
         * @constructor
         * @param {Array} mods all mods
         * @returns {ModContainer}
         */
        init: function (mods) {
            if (mods === __undefined) {
                this.mods = [];
            } else {
                this.mods = mods;
            }
            /**
             * @var this.mods Array<Mod>
             */
            
            this.tags = [];
        },
        /**
         * adds a new non-existing mod
         * 
         * @param {Mod} new_mod
         * @returns {Boolean} true on success
         */
        addMod: function (new_mod) {
            if (!(new_mod instanceof Mod)) {
                return false;
            }
            if (this.inMods(new_mod.getProp("Rows")) === -1) {
                this.mods.push(new_mod);
                return true;
            }
            return false;
        },
        /**
         * truncates mods
         * @returns {void}
         */
        removeAllMods: function () {
            this.mods = [];
        },
        /**
         * removes an existing mod
         * 
         * @param {type} old_mod
         * @returns {Number|Boolean} false if non-existing
         */
        removeMod: function (old_mod) {  
            var index = this.inMods(old_mod.getProp("Rows"));
            if (index !== -1) {
                this.mods.splice(index, 1);
                return index;
            }
            return false;
        },
        /**
         * gets a mod by primary
         * 
         * @param {type} primary
         * @returns {Mod} null if not existing
         */
        getMod: function (primary) {
            var index = this.inMods(primary);
            
            if (index !== -1) {
                return this.mods[index];
            }
            return null;
        },
        /**
         * checks if a mod is in the container
         * 
         * @param {Number} primary primary of the mod
         * @returns {Number} index of the mods
         */
        inMods: function (primary) {
            var index = -1;
            
            $.each(this.mods, function (i, mod) {
                if (+mod.getProp("Rows") === +primary) {
                    index = i;
                    return false;
                }
            });
            
            return index;
        },
        /**
         * returns tags of the mods in the container
         * @returns {Array}
         */
        getTags: function () {
            // jQuery map already flattens
            return $.unique($.map(this.mods, function (mod) {
                return mod.valueAsArray("TagsKeys");
            }));
        },
        /**
         * intersects all tags with the ones on the item
         * 
         * @param {Array} all_tags
         * @returns {Array} tags from the item with their properties
         */
        getTagsWithProps: function (all_tags) {
            var tags = this.getTags();
            return $.grep(all_tags, function (tag_props) {
                return tags.indexOf(+tag_props.Rows) !== -1;
            });
        },
        /**
         * all prefix mods
         * 
         * @returns {Array}
         */
        getPrefixes: function () {
            return $.grep(this.mods, function (mod) {
                return mod.isPrefix();
            });
        },
        /**
         * all suffix mods
         * 
         * @returns {Array}
         */
        getSuffixes: function () {
            return $.grep(this.mods, function (mod) {
                return mod.isSuffix();
            });
        },
        /**
         * suffixes and prefixes
         * 
         * @returns {Array}
         */
        getAffixes: function () {
            // rather order the mods than mix em up
            return this.getPrefixes().concat(this.getSuffixes());
        },
        /**
         * all mods 
         */
        asArray: function () {
            return this.mods;
        },
        /**
         * 
         * @param {Number} mod_type searched GenerationType
         * @returns {Number}
         */
        numberOfModsOfType: function (mod_type) {
            return $.grep(this.mods, function (mod) {
                return +mod.getProp("GenerationType") === mod_type;
            }).length;
        },
        /**
         * checks if theres more place for a mod with their generationtype
         * 
         * @param {Mod} mod
         * @returns {Boolean} true if room for
         */
        hasRoomFor: function (mod) {
            return this.numberOfModsOfType(+mod.getProp("GenerationType")) < this.maxModsOfType(mod);
        },
        /**
         * @abstract
         * @param {type} mod
         * @returns {Number}
         */
        maxModsOfType: function (mod) {
            console.log("override abstract maxModsOfType");
            return -1;
        }
    }); 
    
    module.exports = ModContainer;
}).call(this);