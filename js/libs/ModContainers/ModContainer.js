/* global this, Class, Mod */

(function (__undefined) {
    // Interface pattern
    /*
     * ModContainer class
     * require Class, jQuery
     */
    this.ModContainer = Class.extend({
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
        removeAllMods: function () {
            this.mods = [];
        },
        removeMod: function (old_mod) {  
            var index = this.inMods(old_mod.getProp("Rows"));
            if (index !== -1) {
                this.mods.splice(index, 1);
                return index;
            }
            return false;
        },
        getMod: function (primary) {
            var index = this.inMods(primary);
            
            if (index !== -1) {
                return this.mods[index];
            }
            return null;
        },
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
        getTagsWithProps: function (all_tags) {
            var tags = this.getTags();
            return $.grep(all_tags, function (tag_props) {
                return tags.indexOf(+tag_props.Rows) !== -1;
            });
        },
        prefixes: function () {
            return $.grep(this.mods, function (mod) {
                return mod.isPrefix();
            });
        },
        suffixes: function () {
            return $.grep(this.mods, function (mod) {
                return mod.isSuffix();
            });
        },
        implicits: function () {
            return $.grep(this.mods, function (mod) {
                return mod.isImplicit();
            });
        },
        affixes: function () {
            // rather order the mods than mix em up
            return this.prefixes().concat(this.suffixes());
        },
        asArray: function () {
            return this.mods;
        },
        numberOfModsOfType: function (mod_type) {
            return $.grep(this.mods, function (mod) {
                return +mod.getProp("GenerationType") === mod_type;
            }).length;
        },
        hasRoomFor: function (mod) {
            return this.numberOfModsOfType(+mod.getProp("GenerationType")) < this.maxModsOfType(mod);
        },
        maxModsOfType: function (mod) {
            console.log("override abstract maxModsOfType");
            return -1;
        }
    }); 
})();