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
            
            this.tags = [0];
        },
        addMod: function (new_mod) {
            // TODO check if correct_group already present, only in item
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
                this.mods = this.mods.splice(index, 1);
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
            return $.unique($.map(this.mods, function (mod) {
                return mod.valueAsArray("TagsKeys");
            }));
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
        }
    }); 
    
    this.ModContainer.METAMOD = {
        LOCKED_PREFIXES: 4294,
        LOCKED_SUFFIXES: 4295,
        MULTIMOD: 4298
    };
})();